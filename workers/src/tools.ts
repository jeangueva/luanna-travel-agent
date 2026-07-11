import { tool } from "ai";
import { z } from "zod";
import { createWebviewToken } from "./auth";
import { fetchWithTimeout } from "./http";
import {
  sendKapsoCtaUrl,
  sendKapsoFlow,
  sendKapsoLocationRequest,
  sendKapsoSticker,
} from "./kapso";
import {
  addWatchlistItem,
  createClickRedirect,
  getPreferences,
  getUserEngagement,
  recordPriceObservation,
  upsertPreferences,
  type ClickKind,
  type Sql,
} from "./db";

// Approximate USD→PEN rate for display only ("~S/ X aprox"). Travelpayouts
// prices are in USD; we show an approximate soles figure alongside. Update
// this when the rate drifts materially. Not used for any billing/logic.
const USD_TO_PEN = 3.75;
const usdToPen = (usd: number): number => Math.round(usd * USD_TO_PEN);

function genClickId(): string {
  // URL-safe 8-char id from crypto-random bytes
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[b % 62])
    .join("");
}

export interface ClickContext {
  sql: Sql;
  userId: number;
  baseUrl: string;
}

export async function wrapClickUrl(
  ctx: ClickContext | null,
  kind: ClickKind,
  originalUrl: string,
): Promise<string> {
  if (!ctx || ctx.userId <= 0 || !originalUrl) return originalUrl;
  const id = genClickId();
  try {
    await createClickRedirect(ctx.sql, {
      id,
      userId: ctx.userId,
      originalUrl,
      kind,
    });
    return `${ctx.baseUrl}/r/${id}`;
  } catch (err) {
    // Click logging never breaks the user reply — fall back to the raw URL.
    console.error("wrapClickUrl failed", err);
    return originalUrl;
  }
}

function dedupeCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const trimmed = v.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function removeCaseInsensitive(list: string[], toRemove: string[]): string[] {
  const set = new Set(toRemove.map((s) => s.trim().toLowerCase()));
  return list.filter((v) => !set.has(v.toLowerCase()));
}

export function makeAddFavoritePlacesTool(args: {
  sql: Sql;
  userId: number;
}) {
  return tool({
    description:
      "Agrega países y/o ciudades a la lista de lugares favoritos del usuario. " +
      "Úsala cuando el usuario diga 'agrega X a mis favoritos', 'me interesa Y', 'guarda Z', 'agrégame N'. " +
      "Puedes pasar 'countries', 'cities' o ambos. Hace dedupe case-insensitive y conserva lo previo.",
    inputSchema: z.object({
      countries: z.array(z.string()).optional().describe("Países a agregar"),
      cities: z.array(z.string()).optional().describe("Ciudades a agregar"),
    }),
    execute: async ({ countries, cities }) => {
      const current = await getPreferences(args.sql, args.userId);
      const merged = {
        ...current,
        countries: dedupeCaseInsensitive([
          ...current.countries,
          ...(countries ?? []),
        ]),
        cities: dedupeCaseInsensitive([
          ...current.cities,
          ...(cities ?? []),
        ]),
      };
      await upsertPreferences(args.sql, args.userId, merged);
      return {
        ok: true,
        countries: merged.countries,
        cities: merged.cities,
      };
    },
  });
}

export function makeRemoveFavoritePlacesTool(args: {
  sql: Sql;
  userId: number;
}) {
  return tool({
    description:
      "Quita países y/o ciudades de los favoritos del usuario. " +
      "Úsala cuando el usuario diga 'quita X', 'borra Y', 'ya no me interesa Z'.",
    inputSchema: z.object({
      countries: z.array(z.string()).optional(),
      cities: z.array(z.string()).optional(),
    }),
    execute: async ({ countries, cities }) => {
      const current = await getPreferences(args.sql, args.userId);
      const merged = {
        ...current,
        countries: removeCaseInsensitive(current.countries, countries ?? []),
        cities: removeCaseInsensitive(current.cities, cities ?? []),
      };
      await upsertPreferences(args.sql, args.userId, merged);
      return {
        ok: true,
        countries: merged.countries,
        cities: merged.cities,
      };
    },
  });
}

export interface TravelpayoutsEnv {
  TRAVELPAYOUTS_TOKEN: string;
  TRAVELPAYOUTS_MARKER: string;
}

// Hotel price source, switchable at runtime. "amadeus" pulls real offers from
// the Amadeus Self-Service API (independent of the Travelpayouts Hotels Data
// API approval); anything else (default) uses the Hotellook price cache. The
// booking link stays the Travelpayouts affiliate URL in all cases, so bookings
// always monetize through TP — Amadeus only supplies display prices.
export interface HotelProviderOpts {
  provider?: string;
  amadeus?: { clientId: string; clientSecret: string; baseURL: string };
}

interface HotelRow {
  name: string | null;
  stars: number | null;
  price_from_usd: number | null;
  price_from_pen_approx: number | null;
  price_avg_usd: number | null;
  location: string | null;
  country: string | null;
}

// OAuth2 client-credentials token for Amadeus. Fetched per search (Workers are
// stateless); bounded + best-effort. Returns null on any failure.
async function amadeusToken(cfg: {
  clientId: string;
  clientSecret: string;
  baseURL: string;
}): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(
      `${cfg.baseURL}/v1/security/oauth2/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body:
          `grant_type=client_credentials` +
          `&client_id=${encodeURIComponent(cfg.clientId)}` +
          `&client_secret=${encodeURIComponent(cfg.clientSecret)}`,
      },
      { dep: "amadeus:token", timeoutMs: 6000 },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { access_token?: string };
    return j.access_token ?? null;
  } catch {
    return null;
  }
}

// Real hotel offers with prices from Amadeus for a resolved city (IATA) code.
// Two hops: hotels-by-city -> hotel-offers. Returns [] when the city has no
// offers, null when the API is unreachable/unauthorized (caller falls back).
async function amadeusHotelSearch(
  cfg: { clientId: string; clientSecret: string; baseURL: string },
  cityCode: string,
  checkin: string,
  checkout: string,
  adults: number,
): Promise<HotelRow[] | null> {
  const token = await amadeusToken(cfg);
  if (!token) return null;
  const auth = { Authorization: `Bearer ${token}` };
  try {
    const listUrl = new URL(
      `${cfg.baseURL}/v1/reference-data/locations/hotels/by-city`,
    );
    listUrl.searchParams.set("cityCode", cityCode);
    listUrl.searchParams.set("radius", "20");
    listUrl.searchParams.set("radiusUnit", "KM");
    listUrl.searchParams.set("hotelSource", "ALL");
    const lres = await fetchWithTimeout(
      listUrl.toString(),
      { headers: auth },
      { dep: "amadeus:hotels_by_city", timeoutMs: 7000 },
    );
    if (!lres.ok) return null;
    const ldata = (await lres.json()) as { data?: Array<{ hotelId?: string }> };
    const ids = (ldata.data ?? [])
      .map((h) => h.hotelId)
      .filter((x): x is string => !!x)
      .slice(0, 25);
    if (ids.length === 0) return [];

    const offUrl = new URL(`${cfg.baseURL}/v3/shopping/hotel-offers`);
    offUrl.searchParams.set("hotelIds", ids.join(","));
    offUrl.searchParams.set("checkInDate", checkin);
    offUrl.searchParams.set("checkOutDate", checkout);
    offUrl.searchParams.set("adults", String(adults));
    offUrl.searchParams.set("currency", "USD");
    offUrl.searchParams.set("bestRateOnly", "true");
    const ores = await fetchWithTimeout(
      offUrl.toString(),
      { headers: auth },
      { dep: "amadeus:hotel_offers", timeoutMs: 9000 },
    );
    if (!ores.ok) return [];
    const odata = (await ores.json()) as {
      data?: Array<{
        hotel?: { name?: string; rating?: string; cityCode?: string };
        offers?: Array<{ price?: { total?: string } }>;
      }>;
    };
    return (odata.data ?? [])
      .map((d): HotelRow => {
        const total = Number(d.offers?.[0]?.price?.total);
        const price = Number.isFinite(total) ? Math.round(total) : null;
        const stars = Number(d.hotel?.rating);
        return {
          name: d.hotel?.name ?? null,
          stars: Number.isFinite(stars) ? stars : null,
          price_from_usd: price,
          price_from_pen_approx: price != null ? usdToPen(price) : null,
          price_avg_usd: null,
          location: d.hotel?.cityCode ?? null,
          country: null,
        };
      })
      .filter((h) => h.price_from_usd != null)
      .sort((a, b) => (a.price_from_usd ?? 0) - (b.price_from_usd ?? 0))
      .slice(0, 5);
  } catch {
    return null;
  }
}

export function makeSuggestItineraryTool() {
  return tool({
    description:
      "Sugiere un plan de viaje resumido para un destino: qué hacer cada día, comida típica, transporte, presupuesto aproximado. " +
      "Úsala cuando el usuario, después de ver vuelos/hoteles, pida 'qué hago en X', 'arma un plan', 'itinerario', 'qué hacer en X' o similar. " +
      "Devuelve hints estructurados que tú debes formatear como respuesta corta de WhatsApp (3-6 líneas, emojis).",
    inputSchema: z.object({
      destination: z.string().min(2).describe("Ciudad destino, ej. 'Madrid'"),
      days: z
        .number()
        .int()
        .min(1)
        .max(14)
        .default(5)
        .describe("Cuántos días dura el viaje"),
      style: z
        .enum(["relajado", "aventura", "cultural", "gastronomico", "mixto"])
        .optional()
        .describe("Estilo de viaje preferido (opcional)"),
    }),
    execute: async ({ destination, days, style }) => {
      return {
        destination,
        days,
        style: style ?? "mixto",
        hint:
          "Devuelve al usuario un plan ${days} días en ${destination} con bullets cortos (máx 1 línea por día), 1 tip de comida típica, 1 de transporte, y rango de presupuesto en USD. Mantén el tono cómplice y warm de Luanna. Usa emojis 🗺️ 🍝 🚇 💸.",
        format_example:
          "Día 1: barrio histórico + atardecer\\nDía 2: museo + parque\\n...\\n🍝 No te pierdas la X\\n🚇 Usa la app Y para metro\\n💸 Presupuesto: $A-$B/día",
      };
    },
  });
}

// Requests a FULL multi-day itinerary (web page + PDF), modeled on Planny's
// "Crear viaje". This tool is LIGHTWEIGHT on purpose: it only captures WHAT to
// build and returns immediately. Composing the full plan is heavy (10-40s) and
// would blow the synchronous reply budget, so the actual generation +
// persistence + PDF delivery runs in the BACKGROUND after this turn's reply
// (see generateAndDeliverItinerary). The user gets an instant "lo estoy
// armando ⏳" and the link/PDF arrive a moment later (WhatsApp: pushed; web:
// appears via history polling).
//
// OPT-IN ONLY: call ONLY after the user explicitly confirms they want the full
// itinerary ("sí, ármame el plan", "genérame el viaje completo"). A quick chat
// suggestion uses suggest_itinerary instead.
export interface ItineraryRequest {
  destination: string;
  days?: number;
  style?: string[];
  notes?: string;
}

export function makeStartItineraryTool(args: {
  onRequest: (req: ItineraryRequest) => void;
}) {
  return tool({
    description:
      "Inicia la generación del ITINERARIO COMPLETO de viaje (página web + PDF). " +
      "Úsala SOLO cuando el usuario confirma explícitamente que quiere su plan completo ('sí, ármame el itinerario', 'genérame el viaje'). " +
      "NO la uses para una sugerencia rápida (para eso está suggest_itinerary). " +
      "El plan se arma en segundo plano y el link + PDF llegan en un momento; NO inventes ni incluyas ningún link tú mismo.",
    inputSchema: z.object({
      destination: z
        .string()
        .min(2)
        .describe("Destino principal del viaje, ej 'Cusco', 'París'"),
      days: z
        .number()
        .int()
        .min(1)
        .max(60)
        .optional()
        .describe("Cuántos días dura el viaje (si el usuario lo dijo)"),
      style: z
        .array(z.string())
        .optional()
        .describe("Estilo/preferencias: fotografia, aventura, comida, economico, relajado"),
      notes: z
        .string()
        .optional()
        .describe("Cualquier detalle relevante del usuario (fechas, grupo, presupuesto, intereses)"),
    }),
    execute: async (req) => {
      args.onRequest(req);
      return {
        ok: true,
        hint:
          "Dile al usuario, cálida y MUY breve, que ya estás armando su itinerario completo y que se lo mandas en un momentito ⏳. " +
          "NO incluyas ningún link todavía — el link real y el PDF llegan aparte cuando termine.",
      };
    },
  });
}

// Sticker moods → served from luanna.app/stickers/<mood>.webp
const STICKER_MOODS = ["deal", "alert", "thanks"] as const;

export function makeSendStickerTool(args: {
  apiKey: string;
  phoneNumberId: string;
  to: string;
  baseUrl: string;
}) {
  return tool({
    description:
      "Envía un sticker de Luanna. DEBES llamarla (además del texto) en estos momentos: " +
      "mood 'thanks' cuando el usuario agradece o se despide (gracias / thank you / obrigado / chau); " +
      "mood 'alert' cuando confirmas que creaste una alerta de precio; " +
      "mood 'deal' cuando muestras un vuelo/oferta muy barata que entusiasma. " +
      "Tope máx 1 por conversación, no repitas. Fuera de esos momentos no la uses.",
    inputSchema: z.object({
      mood: z
        .enum(STICKER_MOODS)
        .describe("Tipo de sticker según el momento: deal | alert | thanks"),
    }),
    execute: async ({ mood }) => {
      await sendKapsoSticker({
        apiKey: args.apiKey,
        phoneNumberId: args.phoneNumberId,
        to: args.to,
        link: `${args.baseUrl}/stickers/${mood}.webp`,
      });
      return { ok: true, mood };
    },
  });
}

export function makeRequestLocationTool(args: {
  apiKey: string;
  phoneNumberId: string;
  to: string;
}) {
  return tool({
    description:
      "Envía el mensaje nativo de WhatsApp que pide la ubicación del usuario con un botón 'Enviar ubicación' (1 tap, abre el selector del sistema). " +
      "Úsala SOLO cuando necesites saber desde qué ciudad sale el usuario y no la tengas: en vez de pedirle que escriba su ciudad, llama esta tool. " +
      "Cuando comparta el pin, el sistema detecta el aeropuerto más cercano y guarda su origen automáticamente. " +
      "Tras llamarla, tu respuesta debe ser UNA línea breve (ej 'También puedes escribirme tu ciudad si prefieres 🙂'). NO la uses si ya conoces su origen.",
    inputSchema: z.object({}),
    execute: async () => {
      await sendKapsoLocationRequest({
        apiKey: args.apiKey,
        phoneNumberId: args.phoneNumberId,
        to: args.to,
        bodyText:
          "¿Desde dónde sales? Toca el botón y comparte tu ubicación, yo detecto tu aeropuerto más cercano 📍",
      });
      return {
        ok: true,
        hint:
          "El botón nativo ya fue enviado. Responde con UNA línea breve ofreciendo la alternativa de escribir la ciudad. No repitas la pregunta.",
      };
    },
  });
}

export function makeMyRewardsTool(args: { sql: Sql; userId: number }) {
  return tool({
    description:
      "Consulta los puntos y nivel del usuario en el programa de viajero frecuente de Luanna. " +
      "Úsala cuando pregunte por 'mis puntos', 'mi nivel', 'recompensas' o 'beneficios'. " +
      "Los puntos se ganan usando Luanna: días activos (+2), clicks en vuelos/hoteles (+5) y alertas creadas (+10). " +
      "Niveles: Explorador → Viajero (40 pts) → Trotamundos (120 pts).",
    inputSchema: z.object({}),
    execute: async () => {
      const eng = await getUserEngagement(args.sql, args.userId);
      return {
        points: eng.points,
        level: eng.level,
        level_name: eng.level_name,
        next_level_points: eng.next_level_points,
        breakdown: {
          active_days: eng.active_days,
          flight_hotel_clicks: eng.clicks,
          alerts_created: eng.alerts,
        },
      };
    },
  });
}

export function makeTripPrepTool() {
  return tool({
    description:
      "Da info práctica de preparación de viaje para un destino: si necesita visa, mejor época para ir, clima y presupuesto diario aproximado. " +
      "Úsala cuando el usuario pregunte '¿necesito visa?', '¿cuándo es mejor ir a X?', '¿qué clima hace?', '¿cuánto cuesta el día en X?' o pida 'tips para mi viaje a X'. " +
      "Devuelve hints estructurados que TÚ formateas como respuesta corta de WhatsApp.",
    inputSchema: z.object({
      destination: z.string().min(2).describe("Ciudad o país destino, ej 'Madrid', 'Japón'"),
      from_country: z
        .string()
        .optional()
        .describe("País/nacionalidad del usuario para la visa (ej 'Perú'). Si no lo sabes, asume el país de su origen guardado."),
      topics: z
        .array(z.enum(["visa", "mejor_epoca", "clima", "presupuesto"]))
        .optional()
        .describe("Qué temas cubrir. Si se omite, cubre los relevantes a lo que preguntó."),
    }),
    execute: async ({ destination, from_country, topics }) => {
      return {
        destination,
        from_country: from_country ?? null,
        topics: topics ?? ["visa", "mejor_epoca", "clima", "presupuesto"],
        hint:
          `Da info breve y útil de viaje a ${destination}` +
          (from_country ? ` para alguien de ${from_country}` : "") +
          `: visa (si la necesita y tipo), mejor época para ir, clima general y presupuesto diario aprox en USD. ` +
          `Formato WhatsApp: 3-5 líneas, 1 dato por línea con emoji (🛂 🗓️ 🌦️ 💸). Tono cálido de Luanna.`,
        visa_disclaimer:
          "REGLA DURA: si mencionas visa, agrega SIEMPRE al final: 'Confírmalo con la embajada/consulado, las reglas cambian 🙏'. NUNCA afirmes requisitos de visa como definitivos.",
      };
    },
  });
}

export function makeSaveUserNameTool(args: { sql: Sql; userId: number }) {
  return tool({
    description:
      "Guarda el nombre del usuario cuando lo comparte. Llámala apenas el usuario diga 'soy X', 'me llamo X', o responda 'X' cuando le preguntes el nombre. Si solo dice 'hola' u otra cosa, NO la llames.",
    inputSchema: z.object({
      name: z
        .string()
        .min(1)
        .max(80)
        .describe("Nombre o apodo del usuario, máx 80 chars. Solo el primer nombre o apodo, no oraciones."),
    }),
    execute: async ({ name }) => {
      const cleaned = name.trim().replace(/[\r\n\t]/g, " ").slice(0, 80);
      if (!cleaned) return { saved: false };
      await args.sql`UPDATE users SET name = ${cleaned} WHERE id = ${args.userId}`;
      return { saved: true, name: cleaned };
    },
  });
}

export function makeAddWatchlistTool(args: { sql: Sql; userId: number }) {
  return tool({
    description:
      "Crea una alerta de precio: Luanna chequea periódicamente este destino y avisa al usuario cuando el vuelo baja de precio. " +
      "Úsala cuando el usuario diga cosas como 'avísame si bajan los vuelos a X', 'monitoréalo', 'mándame ofertas a X', 'quiero saber cuándo X esté barato'. " +
      "Solo necesitas origen y destino. El precio máximo es OPCIONAL: si el usuario lo menciona, pásalo; si no, créala igual SIN pedírselo. " +
      "Devuelve un id de la alerta creada.",
    inputSchema: z.object({
      destination: z.string().describe("Nombre del destino (ej: 'Madrid')"),
      destination_iata: z.string().length(3).describe("Código IATA del destino"),
      origin_iata: z.string().length(3).describe("Código IATA del origen"),
      max_price_usd: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Precio máximo en USD (OPCIONAL, solo si el usuario lo da)"),
      frequency_days: z
        .number()
        .int()
        .min(1)
        .max(30)
        .optional()
        .describe("Cada cuántos días chequear (default 7)"),
    }),
    execute: async ({
      destination,
      destination_iata,
      origin_iata,
      max_price_usd,
      frequency_days,
    }) => {
      const { id } = await addWatchlistItem(args.sql, args.userId, {
        // No cap given → store an effectively-unlimited sentinel so the cron
        // always alerts on real price drops (it uses drop detection, not this
        // value). Matches the web /api/watchlist behavior.
        destination,
        destination_iata: destination_iata.toUpperCase(),
        origin_iata: origin_iata.toUpperCase(),
        max_price: max_price_usd ?? 999_999,
        currency: "USD",
        frequency_days,
      });
      return { id, ok: true };
    },
  });
}

export function makePreferencesLinkTool(args: {
  userId: number;
  baseUrl: string;
  signingKey: string;
}) {
  return tool({
    description:
      "Genera un link único y privado para que el usuario configure sus preferencias de viaje (origen, países/ciudades favoritas, presupuesto, estilo). " +
      "Úsalo cuando el usuario quiera personalizar sus recomendaciones, ver/editar su perfil, o decir 'configura', 'mis preferencias', etc. " +
      "El link expira en 7 días. Devuelve la URL para que la pegues en tu respuesta.",
    inputSchema: z.object({}),
    execute: async () => {
      const token = await createWebviewToken(args.userId, args.signingKey);
      const url = `${args.baseUrl}/webview/prefs?token=${encodeURIComponent(token)}`;
      return { url };
    },
  });
}

export function makePreferencesCtaTool(args: {
  apiKey: string;
  phoneNumberId: string;
  to: string;
  userId: number;
  baseUrl: string;
  signingKey: string;
}) {
  return tool({
    description:
      "Envía un botón nativo de WhatsApp que abre el webview de preferencias dentro del chat (Chrome Custom Tabs en Android, in-app browser en iOS). " +
      "Úsala cuando el usuario quiera configurar sus preferencias o alertas, o decir 'configura', 'mis preferencias', 'mis alertas', etc. " +
      "Después de invocarla, responde con un mensaje breve indicando que toque el botón abajo.",
    inputSchema: z.object({}),
    execute: async () => {
      const token = await createWebviewToken(args.userId, args.signingKey);
      const url = `${args.baseUrl}/webview/prefs?token=${encodeURIComponent(token)}`;
      await sendKapsoCtaUrl({
        apiKey: args.apiKey,
        phoneNumberId: args.phoneNumberId,
        to: args.to,
        bodyText: "Configura tus preferencias y alertas — el botón te abre el panel dentro de WhatsApp 🎯",
        buttonText: "Abrir panel",
        url,
        footerText: "Solo tú puedes ver este link",
      });
      return { ok: true };
    },
  });
}

export function makePreferencesFlowTool(args: {
  apiKey: string;
  phoneNumberId: string;
  to: string;
  flowId: string;
  draft?: boolean;
}) {
  return tool({
    description:
      "Abre el formulario nativo de WhatsApp para que el usuario configure sus preferencias de viaje (origen, países/ciudades favoritas, presupuesto, estilo). " +
      "Úsala cuando el usuario quiera personalizar, configurar perfil, ver/editar gustos, o pida 'configura', 'preferencias', 'guarda mis gustos'. " +
      "Aparece como un botón dentro del chat (no es un link externo). Tras invocarla, responde con un mensaje breve de confirmación.",
    inputSchema: z.object({}),
    execute: async () => {
      await sendKapsoFlow({
        apiKey: args.apiKey,
        phoneNumberId: args.phoneNumberId,
        to: args.to,
        flowId: args.flowId,
        bodyText: "Configura tus preferencias para que te recomiende mejor 🎯",
        cta: "Configurar",
        screen: "PREFERENCES",
        draft: args.draft,
      });
      return { ok: true };
    },
  });
}

interface TravelpayoutsFlight {
  origin: string;
  destination: string;
  price: number;
  airline: string;
  flight_number: string | number;
  departure_at: string;
  return_at?: string;
  transfers: number;
  return_transfers?: number;
  duration_to?: number;
  duration_back?: number;
  link?: string;
}

// Resolve a user-supplied place (city name OR IATA, any language) to a
// Travelpayouts city/airport code via the public autocomplete. The model is
// unreliable at IATA for secondary cities (Cusco→CUZ, Punta Cana→PUJ) and
// multi-airport metros (Buenos Aires, London), which is a top cause of empty
// flight results. Canonicalizing server-side removes that guesswork. Prefers a
// city (metro) code so multi-airport cities resolve to the whole metro. Returns
// null when nothing matches. Bounded + best-effort — never throws.
async function resolvePlaceCode(query: string): Promise<string | null> {
  const q = query.trim();
  if (!q) return null;
  const url = new URL("https://autocomplete.travelpayouts.com/places2");
  url.searchParams.set("term", q);
  url.searchParams.set("locale", "es");
  url.searchParams.append("types[]", "city");
  url.searchParams.append("types[]", "airport");
  try {
    const res = await fetchWithTimeout(
      url.toString(),
      {},
      { dep: "travelpayouts:autocomplete", timeoutMs: 4000 },
    );
    if (!res.ok) return null;
    const arr = (await res.json()) as Array<{ code?: string; type?: string }>;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const city = arr.find((p) => p.type === "city" && p.code);
    return city?.code ?? arr.find((p) => p.code)?.code ?? null;
  } catch {
    return null;
  }
}

// Already a clean 3-letter code? Use it directly if autocomplete is unreachable.
function fallbackIata(raw: string): string | null {
  return /^[A-Za-z]{3}$/.test(raw.trim()) ? raw.trim().toUpperCase() : null;
}

export function makeFlightSearchTool(
  env: TravelpayoutsEnv,
  click?: ClickContext,
) {
  return tool({
    description:
      "Busca vuelos baratos. Devuelve hasta 5 opciones ordenadas por precio (USD). " +
      "Para origen y destino pasa la CIUDAD tal como la dijo el usuario (ej: 'Lima', 'Madrid', 'Cusco', 'Punta Cana') o un código IATA si lo sabes — el tool resuelve el código correcto solo. " +
      "Si NO sabes las fechas, NO pases ni departure_date ni departure_month — el tool escanea los próximos 6 meses solo. " +
      "Si el usuario menciona un mes específico, pasa 'departure_month' (YYYY-MM). " +
      "Si tiene fecha exacta, pasa 'departure_date' (YYYY-MM-DD). " +
      "Para vuelo redondo, agrega 'return_date' (YYYY-MM-DD).",
    inputSchema: z.object({
      origin: z.string().min(2).describe("Ciudad o código IATA del origen (ej: 'Lima' o 'LIM')"),
      destination: z.string().min(2).describe("Ciudad o código IATA del destino (ej: 'Madrid' o 'MAD')"),
      departure_date: z
        .string()
        .optional()
        .describe("Fecha exacta YYYY-MM-DD (solo si el usuario la dio)"),
      departure_month: z
        .string()
        .optional()
        .describe("Mes específico YYYY-MM (solo si el usuario mencionó un mes)"),
      return_date: z.string().optional().describe("YYYY-MM-DD para ida y vuelta (solo si el usuario dio fecha de retorno)"),
      one_way: z
        .boolean()
        .optional()
        .describe(
          "true SOLO si el usuario pide explícitamente solo ida. Por defecto (omitido) busca IDA Y VUELTA.",
        ),
      airline: z
        .string()
        .length(2)
        .optional()
        .describe(
          "Código IATA de 2 letras de la aerolínea, SOLO si el usuario pide una específica. Ej: LATAM→LA, Avianca→AV, Sky→H2, JetSMART→JA, Iberia→IB, American→AA, Copa→CM, Aeroméxico→AM. Filtra los resultados a esa aerolínea.",
        ),
      passengers: z
        .number()
        .int()
        .min(1)
        .max(9)
        .optional()
        .describe(
          "Número de pasajeros, SOLO si el usuario lo menciona (ej '2 personas', 'somos 3'). Si se pasa, además del precio por persona se devuelve el total del grupo. Si se omite, el precio es por persona.",
        ),
    }),
    execute: async ({
      origin,
      destination,
      departure_date,
      departure_month,
      return_date,
      one_way,
      airline,
      passengers,
    }) => {
      const baseHeaders = { "X-Access-Token": env.TRAVELPAYOUTS_TOKEN };

      // Canonicalize origin/destination to real IATA/metro codes before
      // searching. Removes the "wrong code → empty results" failure mode.
      const [originResolved, destResolved] = await Promise.all([
        resolvePlaceCode(origin),
        resolvePlaceCode(destination),
      ]);
      const originIata = originResolved ?? fallbackIata(origin);
      const destIata = destResolved ?? fallbackIata(destination);
      if (!originIata || !destIata) {
        const which = !originIata ? "el origen" : "el destino";
        return {
          flights: [],
          error: "place_unresolved",
          note: `No pude identificar ${which} ("${!originIata ? origin : destination}"). Pídele al usuario que confirme la ciudad o el aeropuerto.`,
        };
      }

      // Default to round-trip. Aviasales returns round-trip itineraries (with
      // a return_at it picks) when one_way=false, even if the user didn't give
      // a return date. Only search one-way when explicitly requested.
      const oneWay = one_way ?? false;
      // When filtering by a specific airline, pull a wider pool so enough of
      // that carrier's flights survive the filter; otherwise 5 is plenty.
      const fetchLimit = airline ? "100" : "5";
      const buildUrl = (departureAt?: string): string => {
        const url = new URL(
          "https://api.travelpayouts.com/aviasales/v3/prices_for_dates",
        );
        url.searchParams.set("origin", originIata);
        url.searchParams.set("destination", destIata);
        if (departureAt) url.searchParams.set("departure_at", departureAt);
        if (return_date) url.searchParams.set("return_at", return_date);
        url.searchParams.set("one_way", oneWay ? "true" : "false");
        url.searchParams.set("currency", "usd");
        url.searchParams.set("sorting", "price");
        url.searchParams.set("limit", fetchLimit);
        url.searchParams.set("unique", "false");
        return url.toString();
      };
      const byAirline = (list: TravelpayoutsFlight[]): TravelpayoutsFlight[] =>
        airline
          ? list.filter(
              (f) => (f.airline ?? "").toUpperCase() === airline.toUpperCase(),
            )
          : list;
      const fetchOne = async (
        departureAt: string | undefined,
      ): Promise<TravelpayoutsFlight[]> => {
        // Bounded per window: the no-date path fans out to 6 of these in
        // parallel, so one slow Travelpayouts response must not stall the whole
        // turn. A timed-out/failed window degrades to no results for that month
        // instead of hanging — the other windows still return.
        try {
          const res = await fetchWithTimeout(
            buildUrl(departureAt),
            { headers: baseHeaders },
            { dep: "travelpayouts:flights", timeoutMs: 8000 },
          );
          if (!res.ok) return [];
          const json = (await res.json()) as { data?: TravelpayoutsFlight[] };
          return json.data ?? [];
        } catch {
          return [];
        }
      };

      // ── Resolve which date windows to query, widening on empty ─────────
      // prices_for_dates is a CACHED endpoint: a specific exact date often hits
      // an empty cache cell even when flights exist. So we cascade:
      //   exact date → its month → full 6-month scan
      // Only the first non-empty step is used. This is the other top cause of
      // "no encontré vuelos" — a single empty cell, never widened.
      const single = async (dep: string): Promise<TravelpayoutsFlight[]> =>
        byAirline(await fetchOne(dep))
          .sort((a, b) => a.price - b.price)
          .slice(0, 5);
      const scanSixMonths = async (): Promise<TravelpayoutsFlight[]> => {
        const now = new Date();
        const months: string[] = [];
        for (let i = 0; i < 6; i++) {
          const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
          const yyyy = d.getUTCFullYear();
          const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
          months.push(`${yyyy}-${mm}`);
        }
        const batches = await Promise.all(months.map((m) => fetchOne(m)));
        const merged = byAirline(batches.flat());
        const seen = new Set<string>();
        return merged
          .sort((a, b) => a.price - b.price)
          .filter((f) => {
            const k = `${f.price}|${f.departure_at}|${f.airline}|${f.flight_number}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          })
          .slice(0, 5);
      };

      let raw: TravelpayoutsFlight[] = [];
      let scannedMonths = 1;
      let widened = false;
      if (departure_date) {
        raw = await single(departure_date);
        if (raw.length === 0) {
          // Exact date empty → widen to the whole month.
          raw = await single(departure_date.slice(0, 7));
          widened = raw.length > 0;
        }
      } else if (departure_month) {
        raw = await single(departure_month);
      }
      if (raw.length === 0) {
        // Still nothing (or no date given) → scan the next 6 months.
        raw = await scanSixMonths();
        scannedMonths = 6;
        widened = widened || !!(departure_date || departure_month);
      }

      // Record the cheapest observation for the route so the watchlist cron
      // can detect actual price drops over time. Fire-and-forget — analytics
      // never blocks the user's reply.
      const cheapest = raw[0];
      if (cheapest && click?.sql) {
        recordPriceObservation(click.sql, {
          originIata,
          destinationIata: destIata,
          priceUsd: cheapest.price,
          source: "tool_search",
        }).catch(() => { /* never break the reply */ });
      }
      const pax = passengers ?? 1;
      const flights = await Promise.all(
        raw.map(async (f) => {
          const longUrl = f.link
            ? `https://www.aviasales.com${f.link}${f.link.includes("?") ? "&" : "?"}marker=${env.TRAVELPAYOUTS_MARKER}`
            : null;
          return {
            // Per-person price in both currencies (PEN is approximate, display-only).
            price_usd: f.price,
            price_pen_approx: usdToPen(f.price),
            // Group total only when the user specified passenger count (>1).
            ...(pax > 1
              ? {
                  passengers: pax,
                  total_usd: f.price * pax,
                  total_pen_approx: usdToPen(f.price * pax),
                }
              : {}),
            airline: f.airline,
            flight_number: f.flight_number,
            departure_at: f.departure_at,
            return_at: f.return_at,
            transfers: f.transfers,
            return_transfers: f.return_transfers,
            duration_minutes_outbound: f.duration_to,
            duration_minutes_return: f.duration_back,
            link: longUrl ? await wrapClickUrl(click ?? null, "flight", longUrl) : null,
          };
        }),
      );
      return {
        flights,
        resolved_origin: originIata,
        resolved_destination: destIata,
        scanned_months: scannedMonths,
        // True when the user's exact date/month had nothing and we broadened the
        // window. The model should tell the user the shown options are for other
        // dates, not their requested one.
        widened_search: widened,
        ...(flights.length === 0
          ? { note: "No hay precios en cache para esta ruta ni en los próximos 6 meses. Sugiérele al usuario otra fecha, un aeropuerto cercano, o confirmar origen/destino." }
          : {}),
        currency_note: "price_pen_approx es aproximado (~3.75 PEN/USD), solo referencia.",
      };
    },
  });
}

interface HotellookCacheRow {
  hotelId?: number;
  hotelName?: string;
  location?: { name?: string; country?: string };
  priceFrom?: number;
  priceAvg?: number;
  stars?: number;
}

// Direct platform search URLs. Not affiliate-monetized, but they always work
// and land the user on real inventory — used as the value fallback while the
// scraper service / TP Hotels Data API aren't live. Wrapped through /r/ like
// every other link so clicks are tracked and WhatsApp gets a short URL.
function buildAirbnbSearchUrl(args: {
  city: string;
  checkin: string;
  checkout: string;
  adults: number;
}): string {
  const url = new URL(
    `https://www.airbnb.com/s/${encodeURIComponent(args.city)}/homes`,
  );
  url.searchParams.set("checkin", args.checkin);
  url.searchParams.set("checkout", args.checkout);
  url.searchParams.set("adults", String(args.adults));
  return url.toString();
}

function buildBookingSearchUrl(args: {
  city: string;
  checkin: string;
  checkout: string;
  adults: number;
}): string {
  const url = new URL("https://www.booking.com/searchresults.html");
  url.searchParams.set("ss", args.city);
  url.searchParams.set("checkin", args.checkin);
  url.searchParams.set("checkout", args.checkout);
  url.searchParams.set("group_adults", String(args.adults));
  url.searchParams.set("no_rooms", "1");
  return url.toString();
}

function buildHotelSearchUrl(args: {
  city: string;
  checkin: string;
  checkout: string;
  adults: number;
  marker: string;
}): string {
  const inner = new URL("https://search.hotellook.com/");
  inner.searchParams.set("destination", args.city);
  inner.searchParams.set("checkIn", args.checkin);
  inner.searchParams.set("checkOut", args.checkout);
  inner.searchParams.set("adults", String(args.adults));
  inner.searchParams.set("currency", "usd");
  const wrapped = new URL("https://tp.media/r");
  wrapped.searchParams.set("marker", args.marker);
  wrapped.searchParams.set("trs", "");
  wrapped.searchParams.set("p", "4115");
  wrapped.searchParams.set("u", inner.toString());
  wrapped.searchParams.set("campaign_id", "101");
  return wrapped.toString();
}

export function makeHotelSearchTool(
  env: TravelpayoutsEnv,
  click?: ClickContext,
  hotelOpts?: HotelProviderOpts,
) {
  return tool({
    description:
      "Busca hoteles en una ciudad. SIEMPRE devuelve un 'search_url' (link Hotellook con marker afiliado) y un 'booking_url' (búsqueda directa en Booking.com con ciudad/fechas prellenadas); cuando hay datos en cache, además hasta 5 opciones con precio promedio (USD). Si no hay precios, el booking_url es la respuesta: compártelo con seguridad, sin disculparte. " +
      "El nombre de la ciudad debe ir en inglés o español ('Madrid', 'Cancun', 'Buenos Aires'). " +
      "Las fechas son YYYY-MM-DD. Si el usuario no las da, pídele check-in y check-out exactos antes de llamar.",
    inputSchema: z.object({
      city: z.string().min(2).describe("Ciudad (ej: 'Madrid', 'Cancun')"),
      checkin: z.string().describe("Check-in YYYY-MM-DD"),
      checkout: z.string().describe("Check-out YYYY-MM-DD"),
      adults: z
        .number()
        .int()
        .min(1)
        .max(8)
        .default(2)
        .describe("Número de huéspedes adultos"),
    }),
    execute: async ({ city, checkin, checkout, adults }) => {
      const url = new URL("https://engine.hotellook.com/api/v2/cache.json");
      url.searchParams.set("location", city);
      url.searchParams.set("checkIn", checkin);
      url.searchParams.set("checkOut", checkout);
      url.searchParams.set("adults", String(adults));
      url.searchParams.set("currency", "usd");
      url.searchParams.set("limit", "10");
      url.searchParams.set("token", env.TRAVELPAYOUTS_TOKEN);

      const longSearch = buildHotelSearchUrl({
        city,
        checkin,
        checkout,
        adults,
        marker: env.TRAVELPAYOUTS_MARKER,
      });
      const [search_url, booking_url] = await Promise.all([
        wrapClickUrl(click ?? null, "hotel", longSearch),
        wrapClickUrl(
          click ?? null,
          "hotel",
          buildBookingSearchUrl({ city, checkin, checkout, adults }),
        ),
      ]);

      // When no prices come back, the links ARE the product: the affiliate
      // Hotellook search plus a direct Booking.com search with the user's city
      // + dates prefilled. Frame them that way + give the model useful
      // orientation to add (zones, typical price band, a tip) so the reply feels
      // complete — WITHOUT inventing exact prices, apologizing, or spamming the
      // link. (#4: enrich the link fallback.)
      const linkOnly = {
        hotels: [] as unknown[],
        search_url,
        booking_url,
        note:
          "Sin muestras de precio para esta búsqueda. NO te disculpes ni digas que hubo un error: entrega el booking_url TAL CUAL (ya lleva ciudad y fechas) para que el usuario vea los hoteles disponibles, y menciona el search_url como comparador alternativo. Para que sea útil, agrega 1-2 líneas de contexto real de la ciudad: mejores zonas donde alojarse y un RANGO típico de precio por noche (aclara que es aproximado, NO inventes precios exactos ni nombres de hoteles). UN solo mensaje.",
      };

      // Provider: Amadeus (real offers, independent of the TP Hotels Data API)
      // when enabled + configured; the booking link stays the TP affiliate URL.
      if (hotelOpts?.provider === "amadeus" && hotelOpts.amadeus) {
        const cityCode = (await resolvePlaceCode(city)) ?? fallbackIata(city);
        if (cityCode) {
          const rows = await amadeusHotelSearch(
            hotelOpts.amadeus,
            cityCode,
            checkin,
            checkout,
            adults,
          );
          if (rows && rows.length > 0) {
            return {
              hotels: rows,
              search_url,
              currency_note:
                "price_from_pen_approx es aproximado (~3.75 PEN/USD), solo referencia.",
            };
          }
        }
        // No offers / unreachable → clean link fallback (skip the dead cache).
        return linkOnly;
      }

      let res: Response;
      try {
        res = await fetchWithTimeout(
          url.toString(),
          {},
          { dep: "hotellook:cache", timeoutMs: 8000 },
        );
      } catch {
        return linkOnly;
      }
      if (!res.ok) {
        return linkOnly;
      }
      const json = (await res.json().catch(() => null)) as
        | HotellookCacheRow[]
        | null;
      if (!Array.isArray(json)) {
        return linkOnly;
      }
      const hotels = json
        .filter((h) => typeof h.priceFrom === "number" && h.priceFrom > 0)
        .sort((a, b) => (a.priceFrom ?? 0) - (b.priceFrom ?? 0))
        .slice(0, 5)
        .map((h) => ({
          name: h.hotelName ?? null,
          stars: h.stars ?? null,
          price_from_usd: h.priceFrom ?? null,
          price_from_pen_approx:
            typeof h.priceFrom === "number" ? usdToPen(h.priceFrom) : null,
          price_avg_usd: h.priceAvg ?? null,
          location: h.location?.name ?? null,
          country: h.location?.country ?? null,
        }));
      if (hotels.length === 0) return linkOnly;
      return {
        hotels,
        search_url,
        currency_note: "price_*_pen_approx es aproximado (~3.75 PEN/USD), solo referencia.",
      };
    },
  });
}

export interface StaysServiceOpts {
  serviceUrl?: string;
  apiKey?: string;
}

// Airbnb + Booking.com stays via the external Python scraping service. Used
// while the TP Hotels Data API is gated (needs 50k MAU). ALWAYS
// falls back to the TP vacation-rental search link (which monetizes) when the
// service is unset, slow, blocked, or empty — the user is never left without an
// option, and the model is told to present the link confidently.
export function makeStaysSearchTool(
  env: TravelpayoutsEnv,
  click?: ClickContext,
  stays?: StaysServiceOpts,
) {
  return tool({
    description:
      "Busca alojamientos en Airbnb y Booking (casas, departamentos, hoteles) en una ciudad para fechas dadas. Devuelve estadías con precio total y por noche + airbnb_url y booking_url (búsquedas directas con ciudad/fechas prellenadas) de respaldo. Cada estadía trae source (airbnb|booking) y rating_scale (Airbnb 0-5, Booking 0-10 — no compares ratings crudos entre fuentes). Úsala cuando el usuario pida departamento, casa, Airbnb, Booking o 'algo más económico'. Fechas YYYY-MM-DD; si no las da, pídeselas.",
    inputSchema: z.object({
      city: z.string().min(2).describe("Ciudad (ej: 'Cusco', 'Lisboa')"),
      checkin: z.string().describe("Check-in YYYY-MM-DD"),
      checkout: z.string().describe("Check-out YYYY-MM-DD"),
      adults: z.number().int().min(1).max(16).default(2),
    }),
    execute: async ({ city, checkin, checkout, adults }) => {
      const longSearch = buildHotelSearchUrl({
        city,
        checkin,
        checkout,
        adults,
        marker: env.TRAVELPAYOUTS_MARKER,
      });
      // Direct platform searches (Airbnb / Booking) with the user's exact city
      // + dates prefilled. These always resolve to real inventory, so the
      // fallback still gives the user something actionable instead of an
      // apology.
      const [search_url, airbnb_url, booking_url] = await Promise.all([
        wrapClickUrl(click ?? null, "hotel", longSearch),
        wrapClickUrl(
          click ?? null,
          "hotel",
          buildAirbnbSearchUrl({ city, checkin, checkout, adults }),
        ),
        wrapClickUrl(
          click ?? null,
          "hotel",
          buildBookingSearchUrl({ city, checkin, checkout, adults }),
        ),
      ]);
      const linkOnly = {
        stays: [] as unknown[],
        search_url,
        airbnb_url,
        booking_url,
        note:
          "Sin listados en vivo ahora. NO te disculpes ni menciones errores: entrega airbnb_url y booking_url TAL CUAL (ya llevan la ciudad y fechas del usuario) como la forma de ver departamentos/estadías — di que ahí puede ver las opciones disponibles con sus fechas. Agrega 1-2 líneas de contexto real de la ciudad (mejores zonas + rango de precio aproximado por noche, sin inventar precios exactos). UN solo mensaje.",
      };

      if (!stays?.serviceUrl || !stays.apiKey) return linkOnly;
      try {
        const res = await fetchWithTimeout(
          `${stays.serviceUrl.replace(/\/$/, "")}/search`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": stays.apiKey,
            },
            body: JSON.stringify({ city, checkin, checkout, adults }),
          },
          // Scraping is slow; bound it well under the reply budget and fall back.
          { dep: "stays:scrape", timeoutMs: 15000 },
        );
        if (!res.ok) return linkOnly;
        const data = (await res.json().catch(() => null)) as {
          stays?: Array<Record<string, unknown>>;
        } | null;
        const list = (data?.stays ?? []).slice(0, 5);
        if (list.length === 0) return linkOnly;
        return {
          stays: list,
          search_url,
          airbnb_url,
          booking_url,
          currency_note:
            "Precios en USD, referenciales. Ratings: Airbnb sobre 5, Booking sobre 10 (ver rating_scale).",
        };
      } catch {
        return linkOnly;
      }
    },
  });
}

export function makePackageLinkTool(
  env: TravelpayoutsEnv,
  click?: ClickContext,
) {
  return tool({
    description:
      "Devuelve links afiliados (con marker) para armar un paquete vuelo+hotel: uno para buscar el vuelo en Aviasales y otro para buscar hotel en Hotellook con las mismas fechas. " +
      "No devuelve un precio total — solo URLs reales para que el usuario compare. " +
      "Úsala cuando el usuario pida 'paquete', 'vuelo + hotel', 'todo incluido' o similar.",
    inputSchema: z.object({
      origin_iata: z
        .string()
        .length(3)
        .describe("IATA origen, 3 letras (ej: LIM)"),
      destination_iata: z
        .string()
        .length(3)
        .describe("IATA destino, 3 letras (ej: CUN)"),
      destination_city: z
        .string()
        .min(2)
        .describe("Ciudad del destino para buscar hotel (ej: 'Cancun')"),
      checkin: z
        .string()
        .describe("Fecha de salida / check-in YYYY-MM-DD"),
      checkout: z
        .string()
        .describe("Fecha de regreso / check-out YYYY-MM-DD"),
      adults: z
        .number()
        .int()
        .min(1)
        .max(8)
        .default(2)
        .describe("Número de viajeros adultos"),
    }),
    execute: async ({
      origin_iata,
      destination_iata,
      destination_city,
      checkin,
      checkout,
      adults,
    }) => {
      const toDDMM = (date: string): string | null => {
        const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return m ? `${m[3]}${m[2]}` : null;
      };
      const outDDMM = toDDMM(checkin);
      const backDDMM = toDDMM(checkout);
      const flightPath =
        outDDMM && backDDMM
          ? `${origin_iata.toUpperCase()}${outDDMM}${destination_iata.toUpperCase()}${backDDMM}${adults}`
          : null;
      const longFlight = flightPath
        ? `https://www.aviasales.com/search/${flightPath}?marker=${env.TRAVELPAYOUTS_MARKER}`
        : null;
      const longHotel = buildHotelSearchUrl({
        city: destination_city,
        checkin,
        checkout,
        adults,
        marker: env.TRAVELPAYOUTS_MARKER,
      });
      const flight_search_url = longFlight
        ? await wrapClickUrl(click ?? null, "package", longFlight)
        : null;
      const hotel_search_url = await wrapClickUrl(click ?? null, "package", longHotel);
      return {
        flight_search_url,
        hotel_search_url,
        note: "Travelpayouts no devuelve precio total combinado; el usuario compara en cada link.",
      };
    },
  });
}

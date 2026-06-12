import { tool } from "ai";
import { z } from "zod";
import { createWebviewToken } from "./auth";
import { sendKapsoCtaUrl, sendKapsoFlow, sendKapsoSticker } from "./kapso";
import {
  addWatchlistItem,
  claimPromoForLevel,
  createClickRedirect,
  getClaimedPromo,
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

export function makeMyRewardsTool(args: { sql: Sql; userId: number }) {
  return tool({
    description:
      "Consulta los puntos, nivel y recompensas del usuario en el programa de viajero frecuente de Luanna. " +
      "Úsala cuando pregunte por 'mis puntos', 'mi nivel', 'recompensas', 'premios', 'descuentos', 'promociones' o 'beneficios'. " +
      "Los puntos se ganan usando Luanna: días activos (+2), clicks en vuelos/hoteles (+5) y alertas creadas (+10). " +
      "Niveles: Explorador → Viajero (40 pts) → Trotamundos (120 pts). " +
      "Si hay un código promo disponible para su nivel, la tool lo reclama y te lo devuelve para que se lo entregues con emoción (uno por usuario).",
    inputSchema: z.object({}),
    execute: async () => {
      const eng = await getUserEngagement(args.sql, args.userId);
      const claimed = await getClaimedPromo(args.sql, args.userId);
      const promo = claimed ?? (await claimPromoForLevel(args.sql, args.userId, eng.level));
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
        promo: promo
          ? { code: promo.code, description: promo.description, already_claimed: !!claimed }
          : null,
        no_promo_note: promo
          ? null
          : "No hay códigos disponibles para su nivel ahora. Anímalo a seguir sumando puntos.",
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

export function makeFlightSearchTool(
  env: TravelpayoutsEnv,
  click?: ClickContext,
) {
  return tool({
    description:
      "Busca vuelos baratos. Devuelve hasta 5 opciones ordenadas por precio (USD). " +
      "Usa códigos IATA de 3 letras para origen y destino (ej: LIM, MAD, BCN, MEX, BOG, MIA, JFK). " +
      "Si NO sabes las fechas, NO pases ni departure_date ni departure_month — el tool escanea los próximos 6 meses solo. " +
      "Si el usuario menciona un mes específico, pasa 'departure_month' (YYYY-MM). " +
      "Si tiene fecha exacta, pasa 'departure_date' (YYYY-MM-DD). " +
      "Para vuelo redondo, agrega 'return_date' (YYYY-MM-DD).",
    inputSchema: z.object({
      origin: z.string().length(3).describe("IATA code, 3 letras"),
      destination: z.string().length(3).describe("IATA code, 3 letras"),
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
        url.searchParams.set("origin", origin.toUpperCase());
        url.searchParams.set("destination", destination.toUpperCase());
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
        const res = await fetch(buildUrl(departureAt), { headers: baseHeaders });
        if (!res.ok) return [];
        const json = (await res.json()) as { data?: TravelpayoutsFlight[] };
        return json.data ?? [];
      };

      // ── Resolve which date windows to query ──────────────────────────
      // 1. Exact date / single month → one call
      // 2. No date hint at all → fan out to next 6 months, merge, pick top 5
      let raw: TravelpayoutsFlight[];
      const departure = departure_date ?? departure_month;
      if (departure) {
        raw = byAirline(await fetchOne(departure))
          .sort((a, b) => a.price - b.price)
          .slice(0, 5);
      } else {
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
        // De-dup by (price, departure_at, airline) and sort by price
        const seen = new Set<string>();
        const unique = merged
          .sort((a, b) => a.price - b.price)
          .filter((f) => {
            const k = `${f.price}|${f.departure_at}|${f.airline}|${f.flight_number}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
        raw = unique.slice(0, 5);
      }

      // Record the cheapest observation for the route so the watchlist cron
      // can detect actual price drops over time. Fire-and-forget — analytics
      // never blocks the user's reply.
      const cheapest = raw[0];
      if (cheapest && click?.sql) {
        recordPriceObservation(click.sql, {
          originIata: origin.toUpperCase(),
          destinationIata: destination.toUpperCase(),
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
        scanned_months: departure ? 1 : 6,
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
) {
  return tool({
    description:
      "Busca hoteles baratos en una ciudad. Devuelve hasta 5 opciones con precio promedio (USD) más un link de búsqueda con marker afiliado para que el usuario compare en Hotellook. " +
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
      const search_url = await wrapClickUrl(click ?? null, "hotel", longSearch);

      const res = await fetch(url.toString());
      if (!res.ok) {
        return { error: `hotellook ${res.status}`, hotels: [], search_url };
      }
      const json = (await res.json().catch(() => null)) as
        | HotellookCacheRow[]
        | null;
      if (!Array.isArray(json)) {
        return { hotels: [], search_url };
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
      return {
        hotels,
        search_url,
        currency_note: "price_*_pen_approx es aproximado (~3.75 PEN/USD), solo referencia.",
      };
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

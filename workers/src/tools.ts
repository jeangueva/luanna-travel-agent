import { tool } from "ai";
import { z } from "zod";
import { createWebviewToken } from "./auth";
import { sendKapsoCtaUrl, sendKapsoFlow } from "./kapso";
import {
  addWatchlistItem,
  createClickRedirect,
  getPreferences,
  recordPriceObservation,
  upsertPreferences,
  type ClickKind,
  type Sql,
} from "./db";

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
      "Crea una alerta de precio: Luanna chequea periódicamente este destino y avisa al usuario cuando un vuelo cuesta menos que su límite. " +
      "Úsala cuando el usuario diga cosas como 'avísame si bajan los vuelos a X', 'monitoréalo', 'mándame ofertas a X', 'quiero saber cuándo X esté barato'. " +
      "Antes de llamarla pide y confirma: origen, destino y precio máximo en USD. " +
      "Devuelve un id de la alerta creada.",
    inputSchema: z.object({
      destination: z.string().describe("Nombre del destino (ej: 'Madrid')"),
      destination_iata: z.string().length(3).describe("Código IATA del destino"),
      origin_iata: z.string().length(3).describe("Código IATA del origen"),
      max_price_usd: z
        .number()
        .int()
        .positive()
        .describe("Precio máximo en USD que dispara la alerta"),
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
        destination,
        destination_iata: destination_iata.toUpperCase(),
        origin_iata: origin_iata.toUpperCase(),
        max_price: max_price_usd,
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
      "Si el usuario tiene fechas flexibles, pasa solo 'departure_month' (YYYY-MM). " +
      "Si tiene fecha exacta, pasa 'departure_date' (YYYY-MM-DD). " +
      "Para vuelo redondo, agrega 'return_date' (YYYY-MM-DD).",
    inputSchema: z.object({
      origin: z.string().length(3).describe("IATA code, 3 letras"),
      destination: z.string().length(3).describe("IATA code, 3 letras"),
      departure_date: z
        .string()
        .optional()
        .describe("Fecha exacta YYYY-MM-DD"),
      departure_month: z
        .string()
        .optional()
        .describe("Mes flexible YYYY-MM (cuando no hay fecha exacta)"),
      return_date: z.string().optional().describe("YYYY-MM-DD para ida y vuelta"),
    }),
    execute: async ({
      origin,
      destination,
      departure_date,
      departure_month,
      return_date,
    }) => {
      const url = new URL(
        "https://api.travelpayouts.com/aviasales/v3/prices_for_dates",
      );
      url.searchParams.set("origin", origin.toUpperCase());
      url.searchParams.set("destination", destination.toUpperCase());
      const departure = departure_date ?? departure_month;
      if (departure) url.searchParams.set("departure_at", departure);
      if (return_date) url.searchParams.set("return_at", return_date);
      url.searchParams.set("currency", "usd");
      url.searchParams.set("sorting", "price");
      url.searchParams.set("limit", "5");
      url.searchParams.set("unique", "false");

      const res = await fetch(url.toString(), {
        headers: { "X-Access-Token": env.TRAVELPAYOUTS_TOKEN },
      });
      if (!res.ok) {
        return { error: `travelpayouts ${res.status}`, flights: [] };
      }
      const json = (await res.json()) as {
        success?: boolean;
        data?: TravelpayoutsFlight[];
      };
      const raw = (json.data ?? []).slice(0, 5);
      // Record the cheapest observation for the route so the watchlist cron
      // can detect actual price drops over time.
      const cheapest = raw[0];
      if (cheapest && click?.sql) {
        try {
          await recordPriceObservation(click.sql, {
            originIata: origin.toUpperCase(),
            destinationIata: destination.toUpperCase(),
            priceUsd: cheapest.price,
            source: "tool_search",
          });
        } catch (e) { /* never break the reply */ }
      }
      const flights = await Promise.all(
        raw.map(async (f) => {
          const longUrl = f.link
            ? `https://www.aviasales.com${f.link}${f.link.includes("?") ? "&" : "?"}marker=${env.TRAVELPAYOUTS_MARKER}`
            : null;
          return {
            price_usd: f.price,
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
      return { flights };
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
          price_avg_usd: h.priceAvg ?? null,
          location: h.location?.name ?? null,
          country: h.location?.country ?? null,
        }));
      return { hotels, search_url };
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

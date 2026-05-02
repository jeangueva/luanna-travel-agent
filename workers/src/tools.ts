import { tool } from "ai";
import { z } from "zod";
import { createWebviewToken } from "./auth";
import { sendKapsoFlow } from "./kapso";
import {
  addWatchlistItem,
  getPreferences,
  upsertPreferences,
  type Sql,
} from "./db";

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

export function makeFlightSearchTool(env: TravelpayoutsEnv) {
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
      const flights = (json.data ?? []).slice(0, 5).map((f) => ({
        price_usd: f.price,
        airline: f.airline,
        flight_number: f.flight_number,
        departure_at: f.departure_at,
        return_at: f.return_at,
        transfers: f.transfers,
        return_transfers: f.return_transfers,
        duration_minutes_outbound: f.duration_to,
        duration_minutes_return: f.duration_back,
        link: f.link
          ? `https://www.aviasales.com${f.link}${f.link.includes("?") ? "&" : "?"}marker=${env.TRAVELPAYOUTS_MARKER}`
          : null,
      }));
      return { flights };
    },
  });
}

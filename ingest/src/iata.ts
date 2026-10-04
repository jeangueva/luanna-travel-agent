import { coordenadaPlausible, distanciaKm } from "./geocode.js";

/**
 * Aviasales busca por código IATA, no por nombre: "Cusco" no devuelve nada,
 * "CUZ" sí. El autocomplete público de Travelpayouts convierte nombre en
 * código, pero un nombre es ambiguo (Valencia, ES o VE; San José, CR o US) y
 * un código equivocado no falla: muestra precios de vuelos a otra ciudad en la
 * página de este evento.
 *
 * Por eso un candidato solo se acepta si queda a menos de RADIO_KM de la
 * coordenada de partida del evento, que ya pasó por la validación de Mapbox.
 * Si no hay candidato verificable el resultado es null, no una suposición: el
 * revisor fija el código a mano (PATCH /admin/eventos/:slug/iata) y la página
 * mientras tanto no ofrece vuelos.
 */
const ENDPOINT = "https://autocomplete.travelpayouts.com/places2";

/**
 * Un metro grande (Lima, Ciudad de México, Buenos Aires) cabe en este radio; una
 * homonimia entre países no. Si la sede queda lejos de toda ciudad con
 * aeropuerto, el catálogo prefiere no ofrecer vuelos a ofrecer los equivocados.
 */
export const RADIO_KM = 120;

interface Lugar {
  type?: string;
  code?: string;
  coordinates?: { lat?: number; lon?: number };
}

export async function resolverIata(
  entrada: {
    ciudad_sede: string | null;
    lat: number;
    lon: number;
  },
  fetchFn: typeof fetch = fetch,
): Promise<string | null> {
  const ciudad = entrada.ciudad_sede?.trim();
  if (!ciudad || !coordenadaPlausible(entrada.lat, entrada.lon)) return null;

  const url = new URL(ENDPOINT);
  url.searchParams.set("term", ciudad);
  url.searchParams.set("locale", "es");
  url.searchParams.append("types[]", "city");

  let lugares: Lugar[];
  try {
    const res = await fetchFn(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const cuerpo: unknown = await res.json();
    if (!Array.isArray(cuerpo)) return null;
    lugares = cuerpo as Lugar[];
  } catch {
    return null;
  }

  let mejor: { code: string; km: number } | null = null;
  for (const l of lugares) {
    const lat = l.coordinates?.lat;
    const lon = l.coordinates?.lon;
    if (l.type !== "city" || typeof l.code !== "string") continue;
    if (!/^[A-Z]{3}$/.test(l.code)) continue;
    if (!coordenadaPlausible(lat, lon)) continue;

    const km = distanciaKm(
      { lat: entrada.lat, lon: entrada.lon },
      { lat: lat as number, lon: lon as number },
    );
    if (km <= RADIO_KM && (!mejor || km < mejor.km)) mejor = { code: l.code, km };
  }
  return mejor?.code ?? null;
}

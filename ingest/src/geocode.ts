/**
 * Un modelo de lenguaje inventa coordenadas con la misma fluidez con la que
 * cita una fecha correcta, y una coordenada equivocada no falla: renderiza un
 * mapa perfecto del lugar equivocado, con hoteles del lugar equivocado. Por eso
 * las coordenadas del LLM son una pista, no un dato: se validan contra el
 * geocoder de Mapbox y, cuando discrepan, gana Mapbox.
 */
const ENDPOINT = "https://api.mapbox.com/search/geocode/v6/forward";

export interface Coordenada {
  lat: number;
  lon: number;
  fuente: "llm" | "mapbox";
}

/** Distancia en km entre dos puntos (haversine). */
export function distanciaKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function coordenadaPlausible(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180 &&
    // (0,0) es el "null island" que devuelve un modelo cuando no sabe.
    !(Math.abs(lat) < 0.01 && Math.abs(lon) < 0.01)
  );
}

export async function geocodificar(
  consulta: string,
  token: string,
  opts: { pais?: string | null; timeoutMs?: number } = {},
): Promise<{ lat: number; lon: number } | null> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("q", consulta);
  url.searchParams.set("limit", "1");
  url.searchParams.set("language", "es");
  url.searchParams.set("access_token", token);

  const res = await fetch(url, {
    signal: AbortSignal.timeout(opts.timeoutMs ?? 10000),
  });
  if (!res.ok) return null;

  const payload = (await res.json()) as {
    features?: Array<{ geometry?: { coordinates?: [number, number] } }>;
  };
  const coords = payload.features?.[0]?.geometry?.coordinates;
  if (!coords || coords.length !== 2) return null;
  const [lon, lat] = coords;
  return coordenadaPlausible(lat, lon) ? { lat, lon } : null;
}

/**
 * Tolerancia de 50 km: separa "el LLM ubicó bien la ciudad y afinó el punto de
 * partida" de "el LLM se equivocó de ciudad". Un circuito de ruta o un
 * triatlón caben de sobra en ese radio; una confusión de sede, no.
 */
export const TOLERANCIA_KM = 50;

export async function resolverCoordenadas(
  entrada: {
    lat: number | null;
    lon: number | null;
    lugar_partida: string | null;
    ciudad_sede: string | null;
    pais: string | null;
  },
  mapboxToken: string | undefined,
): Promise<Coordenada | null> {
  const delLlm = coordenadaPlausible(entrada.lat, entrada.lon)
    ? { lat: entrada.lat as number, lon: entrada.lon as number }
    : null;

  const consulta = [entrada.lugar_partida, entrada.ciudad_sede, entrada.pais]
    .filter(Boolean)
    .join(", ");

  if (!mapboxToken || !consulta) {
    // Sin geocoder no hay con qué contrastar: la coordenada del LLM pasa, pero
    // la fila queda en draft y con geo_fuente = "llm" para que la revisión
    // humana sepa que nadie la verificó.
    return delLlm ? { ...delLlm, fuente: "llm" } : null;
  }

  const deMapbox = await geocodificar(consulta, mapboxToken, {
    pais: entrada.pais,
  });
  if (!deMapbox) return delLlm ? { ...delLlm, fuente: "llm" } : null;
  if (!delLlm) return { ...deMapbox, fuente: "mapbox" };

  return distanciaKm(delLlm, deMapbox) <= TOLERANCIA_KM
    ? { ...delLlm, fuente: "llm" }
    : { ...deMapbox, fuente: "mapbox" };
}

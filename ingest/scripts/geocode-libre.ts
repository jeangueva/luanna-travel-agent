/**
 * Geocoder de respaldo sin API key, para poder sembrar los benchmarks antes de
 * que exista MAPBOX_TOKEN. Nominatim (OpenStreetMap) exige User-Agent
 * identificable y un máximo de 1 req/s; este script hace dos consultas, así
 * que cabe de sobra en su política de uso. El pipeline de producción NO lo
 * usa: allí manda Mapbox.
 */
const ENDPOINT = "https://nominatim.openstreetmap.org/search";

export async function geocodificarNominatim(
  consulta: string,
): Promise<{ lat: number; lon: number } | null> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("q", consulta);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");

  const res = await fetch(url, {
    headers: {
      "User-Agent": "luanna-eventos-seed/0.1 (https://luanna.app)",
      "Accept-Language": "es",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return null;

  const datos = (await res.json()) as Array<{ lat?: string; lon?: string }>;
  const primero = datos[0];
  if (!primero?.lat || !primero?.lon) return null;

  const lat = Number(primero.lat);
  const lon = Number(primero.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

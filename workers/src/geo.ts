// Geo helpers for origin detection.
//
// Two uses:
//  - Capa A: infer a likely origin city from the user's phone country code
//    (zero friction — we already have their E.164 number).
//  - Capa B: map a shared WhatsApp location (lat/lng) to the nearest airport
//    city via haversine.
//
// The table is intentionally small: main LATAM origin markets + key Peru
// domestic airports (our core market) + a few global hubs Latinos fly from.

export interface CityAirport {
  iata: string;
  city: string;
  country: string;
  /** E.164 calling code (no +). Marks the default origin for that country. */
  cc: string;
  lat: number;
  lng: number;
  /** Default origin for its calling code (used by phone-prefix inference). */
  primary?: boolean;
}

export const CITIES: CityAirport[] = [
  // Peru (core market — include main domestic airports for location pins)
  { iata: "LIM", city: "Lima", country: "Perú", cc: "51", lat: -12.02, lng: -77.11, primary: true },
  { iata: "CUZ", city: "Cusco", country: "Perú", cc: "51", lat: -13.54, lng: -71.94 },
  { iata: "AQP", city: "Arequipa", country: "Perú", cc: "51", lat: -16.34, lng: -71.58 },
  { iata: "TRU", city: "Trujillo", country: "Perú", cc: "51", lat: -8.08, lng: -79.11 },
  { iata: "PIU", city: "Piura", country: "Perú", cc: "51", lat: -5.21, lng: -80.62 },
  { iata: "CIX", city: "Chiclayo", country: "Perú", cc: "51", lat: -6.79, lng: -79.83 },
  { iata: "IQT", city: "Iquitos", country: "Perú", cc: "51", lat: -3.78, lng: -73.31 },
  { iata: "TPP", city: "Tarapoto", country: "Perú", cc: "51", lat: -6.51, lng: -76.37 },
  // Rest of LATAM
  { iata: "MEX", city: "Ciudad de México", country: "México", cc: "52", lat: 19.44, lng: -99.07, primary: true },
  { iata: "BOG", city: "Bogotá", country: "Colombia", cc: "57", lat: 4.7, lng: -74.15, primary: true },
  { iata: "SCL", city: "Santiago", country: "Chile", cc: "56", lat: -33.39, lng: -70.79, primary: true },
  { iata: "EZE", city: "Buenos Aires", country: "Argentina", cc: "54", lat: -34.82, lng: -58.54, primary: true },
  { iata: "GRU", city: "São Paulo", country: "Brasil", cc: "55", lat: -23.43, lng: -46.47, primary: true },
  { iata: "GIG", city: "Rio de Janeiro", country: "Brasil", cc: "55", lat: -22.81, lng: -43.25 },
  { iata: "UIO", city: "Quito", country: "Ecuador", cc: "593", lat: -0.13, lng: -78.36, primary: true },
  { iata: "GYE", city: "Guayaquil", country: "Ecuador", cc: "593", lat: -2.16, lng: -79.88 },
  { iata: "LPB", city: "La Paz", country: "Bolivia", cc: "591", lat: -16.51, lng: -68.19, primary: true },
  { iata: "CCS", city: "Caracas", country: "Venezuela", cc: "58", lat: 10.6, lng: -66.99, primary: true },
  { iata: "MVD", city: "Montevideo", country: "Uruguay", cc: "598", lat: -34.84, lng: -56.03, primary: true },
  { iata: "ASU", city: "Asunción", country: "Paraguay", cc: "595", lat: -25.24, lng: -57.52, primary: true },
  { iata: "PTY", city: "Ciudad de Panamá", country: "Panamá", cc: "507", lat: 9.07, lng: -79.38, primary: true },
  { iata: "SJO", city: "San José", country: "Costa Rica", cc: "506", lat: 9.99, lng: -84.2, primary: true },
  { iata: "GUA", city: "Ciudad de Guatemala", country: "Guatemala", cc: "502", lat: 14.58, lng: -90.52, primary: true },
  // Key corridors Latinos fly from
  { iata: "MIA", city: "Miami", country: "Estados Unidos", cc: "1", lat: 25.79, lng: -80.29, primary: true },
  { iata: "MAD", city: "Madrid", country: "España", cc: "34", lat: 40.49, lng: -3.57, primary: true },
];

// Calling codes present in the table, longest first for greedy prefix match.
const CALLING_CODES = Array.from(new Set(CITIES.map((c) => c.cc))).sort(
  (a, b) => b.length - a.length,
);

/**
 * Infer a likely origin city from an E.164 phone number's country code.
 * Returns null for web sessions (phone like "web:...") or unknown prefixes.
 */
export function inferOriginFromPhone(phone: string): CityAirport | null {
  if (!phone || phone.startsWith("web:")) return null;
  const digits = phone.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const cc = CALLING_CODES.find((code) => digits.startsWith(code));
  if (!cc) return null;
  return CITIES.find((c) => c.cc === cc && c.primary) ?? null;
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Nearest airport city to a shared lat/lng (Capa B). */
export function nearestAirport(lat: number, lng: number): CityAirport | null {
  let best: CityAirport | null = null;
  let bestKm = Infinity;
  for (const c of CITIES) {
    const km = haversineKm(lat, lng, c.lat, c.lng);
    if (km < bestKm) {
      bestKm = km;
      best = c;
    }
  }
  return best;
}

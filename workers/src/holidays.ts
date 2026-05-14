// Long-weekend / holiday calendar for the seasonal-push cron.
// Hand-maintained per country. Only includes holidays that fall on a Friday or
// Monday (real long-weekend triggers); regular weekday holidays are skipped
// because they don't drive flight demand the same way.
//
// Keep ~2 years rolling; older entries are ignored at runtime.

export interface Holiday {
  date: string;          // YYYY-MM-DD
  name: string;
  country_code: string;  // ISO 3166-1 alpha-2
}

export const HOLIDAYS: Holiday[] = [
  // ── Peru (PE) ──
  { date: "2026-07-28", name: "Fiestas Patrias", country_code: "PE" },
  { date: "2026-07-29", name: "Fiestas Patrias", country_code: "PE" },
  { date: "2026-10-08", name: "Combate de Angamos", country_code: "PE" },
  { date: "2026-11-01", name: "Día de Todos los Santos", country_code: "PE" },
  { date: "2026-12-25", name: "Navidad", country_code: "PE" },
  { date: "2027-01-01", name: "Año Nuevo", country_code: "PE" },
  { date: "2027-04-01", name: "Jueves Santo", country_code: "PE" },
  { date: "2027-04-02", name: "Viernes Santo", country_code: "PE" },

  // ── México (MX) ──
  { date: "2026-09-16", name: "Independencia", country_code: "MX" },
  { date: "2026-11-02", name: "Día de Muertos", country_code: "MX" },
  { date: "2026-11-16", name: "Revolución Mexicana", country_code: "MX" },
  { date: "2026-12-25", name: "Navidad", country_code: "MX" },
  { date: "2027-02-01", name: "Día de la Constitución", country_code: "MX" },

  // ── Colombia (CO) ──
  { date: "2026-07-20", name: "Día de la Independencia", country_code: "CO" },
  { date: "2026-08-07", name: "Batalla de Boyacá", country_code: "CO" },
  { date: "2026-10-12", name: "Día de la Raza", country_code: "CO" },
  { date: "2026-11-02", name: "Todos los Santos", country_code: "CO" },
  { date: "2026-11-16", name: "Independencia de Cartagena", country_code: "CO" },

  // ── Argentina (AR) ──
  { date: "2026-07-09", name: "Día de la Independencia", country_code: "AR" },
  { date: "2026-08-17", name: "Paso a la Inmortalidad de San Martín", country_code: "AR" },
  { date: "2026-10-12", name: "Día del Respeto a la Diversidad Cultural", country_code: "AR" },
  { date: "2026-12-08", name: "Inmaculada Concepción", country_code: "AR" },
  { date: "2026-12-25", name: "Navidad", country_code: "AR" },

  // ── Chile (CL) ──
  { date: "2026-09-18", name: "Fiestas Patrias", country_code: "CL" },
  { date: "2026-09-19", name: "Glorias del Ejército", country_code: "CL" },
  { date: "2026-10-12", name: "Encuentro de Dos Mundos", country_code: "CL" },
  { date: "2026-12-25", name: "Navidad", country_code: "CL" },

  // ── España (ES) ──
  { date: "2026-08-15", name: "Asunción", country_code: "ES" },
  { date: "2026-10-12", name: "Fiesta Nacional", country_code: "ES" },
  { date: "2026-11-01", name: "Todos los Santos", country_code: "ES" },
  { date: "2026-12-06", name: "Día de la Constitución", country_code: "ES" },
  { date: "2026-12-08", name: "Inmaculada", country_code: "ES" },
  { date: "2026-12-25", name: "Navidad", country_code: "ES" },

  // ── Estados Unidos (US) ──
  { date: "2026-07-04", name: "Independence Day", country_code: "US" },
  { date: "2026-09-07", name: "Labor Day", country_code: "US" },
  { date: "2026-11-26", name: "Thanksgiving", country_code: "US" },
  { date: "2026-12-25", name: "Christmas", country_code: "US" },
];

export function holidaysWithinDays(
  countryCode: string,
  fromIsoDate: string,
  windowDays: number,
): Holiday[] {
  const from = new Date(fromIsoDate);
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + windowDays);
  return HOLIDAYS.filter((h) => {
    if (h.country_code !== countryCode) return false;
    const d = new Date(h.date);
    return d >= from && d <= to;
  });
}

/**
 * Todo el manejo de fechas del sitio trabaja con "YYYY-MM-DD" y componentes de
 * calendario. `new Date("2026-11-07")` se interpreta como medianoche UTC, que
 * en cualquier zona al oeste de Greenwich es el 6: la carrera aparecería un día
 * antes de lo que es.
 */

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const MESES_CORTOS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function partes(iso: string): [number, number, number] {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return [y, m, d];
}

/** Medianoche local del día indicado. */
export function aFechaLocal(iso: string): Date {
  const [y, m, d] = partes(iso);
  return new Date(y, m - 1, d);
}

export function fechaLarga(iso: string): string {
  const [y, m, d] = partes(iso);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

export function fechaCorta(iso: string): string {
  const [y, m, d] = partes(iso);
  return `${d} ${MESES_CORTOS[m - 1]} ${y}`;
}

/** Aritmética de calendario pura: sin zona horaria ni horario de verano. */
export function sumarDias(iso: string, dias: number): string {
  const [y, m, d] = partes(iso);
  const t = new Date(Date.UTC(y, m - 1, d + dias));
  const mm = String(t.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(t.getUTCDate()).padStart(2, "0");
  return `${t.getUTCFullYear()}-${mm}-${dd}`;
}

/** Días de calendario entre el día de `ahora` y la fecha; negativo si ya pasó. */
export function diasFaltantes(iso: string, ahora: Date = new Date()): number {
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  return Math.round((aFechaLocal(iso).getTime() - hoy.getTime()) / 86400000);
}

/** ¿Existe en el calendario? `2026-02-30` pasa un regex pero no esta prueba. */
export function esFechaISOValida(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = partes(iso);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/**
 * Las fechas llegan como YYYY-MM-DD y describen un día civil en la sede, no un
 * instante. `new Date("2026-11-07")` las interpreta en UTC, así que en Lima
 * (UTC-5) el evento se muestra el 6 de noviembre. Componer la fecha a mano en
 * hora local evita ese corrimiento de un día.
 */
export function aFechaLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function fechaLarga(iso: string): string {
  const d = aFechaLocal(iso);
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

export function fechaCorta(iso: string): string {
  const d = aFechaLocal(iso);
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

/** Suma días en calendario local, sin cruzar por UTC. */
export function sumarDias(iso: string, dias: number): string {
  const d = aFechaLocal(iso);
  d.setDate(d.getDate() + dias);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function diasFaltantes(iso: string, desde = new Date()): number {
  const objetivo = aFechaLocal(iso).getTime();
  const hoy = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate()).getTime();
  return Math.round((objetivo - hoy) / 86400000);
}

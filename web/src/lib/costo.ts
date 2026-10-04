/**
 * Rango de inscripción para mostrar: "PEN 60–120" o "USD 95". Se escribe el
 * código ISO en vez de un símbolo: "$" es peso en seis países de la región y
 * dólar en otros, y en una página que compara eventos de toda Latinoamérica esa
 * ambigüedad es un dato equivocado.
 */
export function formatoCosto(
  min: number | null,
  max: number | null,
  moneda: string | null,
): string | null {
  if (!moneda || (min === null && max === null)) return null;
  const n = (v: number) =>
    v.toLocaleString("es", { maximumFractionDigits: v % 1 === 0 ? 0 : 2 });
  const lo = min ?? max!;
  const hi = max ?? min!;
  return lo === hi ? `${moneda} ${n(lo)}` : `${moneda} ${n(lo)}–${n(hi)}`;
}

export const ETIQUETA_PRECISION: Record<"aproximada" | "por_confirmar", string> = {
  aproximada: "Fecha aproximada",
  por_confirmar: "Fecha por confirmar",
};

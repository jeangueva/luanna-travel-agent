/**
 * El slug es la clave de conflicto del UPSERT y la URL pública, así que tiene
 * que ser estable entre corridas: dos domingos seguidos, el mismo evento debe
 * producir el mismo slug o cada corrida crea un duplicado y la página cambia
 * de dirección (y pierde su ranking).
 *
 * Estable = derivado solo del nombre oficial y el año, normalizando lo que el
 * LLM sí varía entre corridas: acentos, mayúsculas, puntuación y espacios.
 */
export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

export function slugEvento(nombreOficial: string, fechaInicio: string): string {
  const ano = fechaInicio.slice(0, 4);
  const base = slugify(nombreOficial);
  // Un nombre que ya termina en el año no lo repite ("maraton-lima-2026-2026").
  return base.endsWith(`-${ano}`) ? base : `${base}-${ano}`;
}

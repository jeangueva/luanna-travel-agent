import type { Evento, Tramo } from "./eventos-types";

/**
 * `jsonb_agg` no garantiza el orden en que quedaron los tramos, y en un
 * triatlón el orden ES la información: natación, T1, ciclismo, T2, carrera.
 * Ordenar acá evita depender de cómo Postgres devolvió el arreglo.
 */
const ORDEN: Record<Tramo["tipo"], number> = {
  natacion: 0,
  t1: 1,
  ciclismo: 2,
  t2: 3,
  carrera: 4,
};

/**
 * Un evento de una sola disciplina guarda su trazado en `ruta_gpx_url`; un
 * triatlón lo parte en `tramos`. El mapa consume una sola forma, y el tipo
 * decide el color de la línea, así que un maratón no puede salir pintado del
 * naranja del circuito de ciclismo.
 */
export function tramosDelEvento(evento: Evento): Tramo[] {
  if (evento.tramos.length > 0) {
    return [...evento.tramos].sort((a, b) => ORDEN[a.tipo] - ORDEN[b.tipo]);
  }
  if (!evento.ruta_gpx_url) return [];
  const tipo: Tramo["tipo"] =
    evento.categoria === "ciclismo"
      ? "ciclismo"
      : evento.categoria === "aguas_abiertas"
        ? "natacion"
        : "carrera";
  return [{ tipo, nombre: "Recorrido", gpx_url: evento.ruta_gpx_url }];
}

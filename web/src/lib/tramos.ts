import {
  TIPOS_TRAMO,
  type Categoria,
  type Evento,
  type TipoTramo,
  type Tramo,
} from "./eventos-types";

/**
 * Tipo del trazado cuando el evento trae un único GPX. En las disciplinas
 * combinadas se asume que ese archivo es el tramo más largo sobre la calle.
 */
const TRAMO_UNICO: Record<Categoria, TipoTramo> = {
  running: "carrera",
  trail_running: "carrera",
  cycling: "ciclismo",
  acuatlon: "carrera",
  duatlon: "ciclismo",
  acuabike: "ciclismo",
  triatlon: "ciclismo",
  aguas_abiertas: "natacion",
};

/**
 * Los tramos explícitos ganan sobre `ruta_gpx_url`, y salen en el orden de la
 * prueba (natación → T1 → ciclismo → T2 → carrera) sin importar cómo hayan
 * llegado: el orden de inserción depende de cuándo se subió cada archivo.
 */
export function tramosDelEvento(evento: Evento): Tramo[] {
  if (evento.tramos.length > 0) {
    return [...evento.tramos].sort(
      (a, b) => TIPOS_TRAMO.indexOf(a.tipo) - TIPOS_TRAMO.indexOf(b.tipo),
    );
  }
  if (evento.ruta_gpx_url) {
    return [
      {
        tipo: TRAMO_UNICO[evento.categoria],
        nombre: "Recorrido",
        gpx_url: evento.ruta_gpx_url,
      },
    ];
  }
  return [];
}

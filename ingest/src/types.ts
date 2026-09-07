export const CATEGORIAS = [
  "triatlon",
  "aguas_abiertas",
  "maraton",
  "ciclismo",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export function esCategoria(value: string): value is Categoria {
  return (CATEGORIAS as readonly string[]).includes(value);
}

export const TIPOS_TRAMO = [
  "natacion",
  "t1",
  "ciclismo",
  "t2",
  "carrera",
] as const;

export type TipoTramo = (typeof TIPOS_TRAMO)[number];

export interface Tramo {
  tipo: TipoTramo;
  nombre: string;
  gpx_url: string | null;
}

export interface ClimaProyectado {
  temp_min: number | null;
  temp_max: number | null;
  condicion: string | null;
}

/** Fila tal como vive en Postgres. */
export interface EventoDeportivo {
  id: string;
  slug: string;
  nombre_oficial: string;
  categoria: Categoria;
  fecha_inicio: string;
  ciudad_sede: string | null;
  pais: string | null;
  latitud_partida: number;
  longitud_partida: number;
  ruta_gpx_url: string | null;
  clima_proyectado: ClimaProyectado | null;
  estado_publicacion: "draft" | "published" | "rechazado";
  fuente_url: string | null;
  geo_fuente: "llm" | "mapbox" | "manual";
  confianza: number;
  descripcion: string | null;
  badges: string[];
  tramos: Tramo[];
  created_at: string;
  updated_at: string;
}

/** Lo que devuelve el LLM, antes de validar y geocodificar. */
export interface EventoExtraido {
  nombre_oficial: string;
  categoria: Categoria;
  fecha_inicio: string;
  ciudad_sede: string | null;
  pais: string | null;
  lugar_partida: string | null;
  latitud_partida: number | null;
  longitud_partida: number | null;
  fuente_url: string | null;
  descripcion: string | null;
  badges: string[];
  confianza: number;
}

export interface ResumenCorrida {
  queries: number;
  candidatos: number;
  insertados: number;
  actualizados: number;
  rechazados: number;
  errores: string[];
}

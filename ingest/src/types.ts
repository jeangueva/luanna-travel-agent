/**
 * Se espeja en web/src/lib/eventos-types.ts y en el CHECK de
 * workers/migrations/0019: las tres listas cambian juntas.
 */
export const CATEGORIAS = [
  "running",
  "trail_running",
  "cycling",
  "acuatlon",
  "duatlon",
  "acuabike",
  "triatlon",
  "aguas_abiertas",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export function esCategoria(value: string): value is Categoria {
  return (CATEGORIAS as readonly string[]).includes(value);
}

/**
 * Etiquetas que el extractor puede asignar (un evento lleva varias). Cerrada a
 * propósito: con texto libre el modelo inventa "ultra-maraton-epica" y el
 * filtro del hub se llena de variantes de lo mismo. Espejo de las claves de
 * ETIQUETAS_CONOCIDAS en web/src/lib/eventos-types.ts.
 */
export const ETIQUETAS_VALIDAS = [
  "5k",
  "10k",
  "21k",
  "media_maraton",
  "maraton",
  "ultra",
  "gran_fondo",
  "mtb",
  "ruta",
  "super_sprint",
  "sprint",
  "olimpico",
  "ironman_70_3",
  "ironman_full",
  "travesia",
] as const;

export type Etiqueta = (typeof ETIQUETAS_VALIDAS)[number];

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
  etiquetas: string[];
  fecha_inicio: string;
  fecha_fin: string | null;
  fecha_precision: "exacta" | "aproximada" | "por_confirmar";
  ciudad_sede: string | null;
  pais: string | null;
  aeropuerto_iata: string | null;
  latitud_partida: number;
  longitud_partida: number;
  ruta_gpx_url: string | null;
  clima_proyectado: ClimaProyectado | null;
  estado_publicacion: "draft" | "published" | "rechazado";
  fuente_url: string | null;
  geo_fuente: "llm" | "mapbox" | "nominatim" | "manual";
  costo_min: number | null;
  costo_max: number | null;
  moneda: string | null;
  costo_fuente_url: string | null;
  inscripcion_url: string | null;
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
  etiquetas: string[];
  fecha_inicio: string;
  ciudad_sede: string | null;
  pais: string | null;
  lugar_partida: string | null;
  latitud_partida: number | null;
  longitud_partida: number | null;
  fuente_url: string | null;
  descripcion: string | null;
  badges: string[];
  /** Rango de inscripción leído de la fuente; null si la fuente no da cifra. */
  costo_min: number | null;
  costo_max: number | null;
  /** ISO 4217 en mayúsculas (USD, PEN, MXN, COP, CLP, ARS, BRL…). */
  moneda: string | null;
  inscripcion_url: string | null;
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

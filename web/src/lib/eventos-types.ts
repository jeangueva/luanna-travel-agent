/**
 * Conjunto cerrado de disciplinas. Se espeja en ingest/src/types.ts y en el
 * CHECK de workers/migrations/0019: las tres listas cambian juntas o el cron
 * escribe filas que la base rechaza.
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

export const ETIQUETA_CATEGORIA: Record<Categoria, string> = {
  running: "Running",
  trail_running: "Trail running",
  cycling: "Ciclismo",
  acuatlon: "Acuatlón",
  duatlon: "Duatlón",
  acuabike: "Acuabike",
  triatlon: "Triatlón",
  aguas_abiertas: "Aguas abiertas",
};

export const DESCRIPCION_CATEGORIA: Record<Categoria, string> = {
  running:
    "Maratones, medias maratones y carreras de calle en Latinoamérica, con fecha, costo aproximado y vuelos a la sede.",
  trail_running:
    "Carreras de montaña y ultras en Latinoamérica: fechas, desnivel, costo de inscripción y cómo llegar.",
  cycling:
    "Granfondos, rutas y pruebas de ciclismo en Latinoamérica, con fechas, costo y vuelos a la sede.",
  acuatlon:
    "Acuatlón (natación y carrera): calendario, costo de inscripción y logística de viaje.",
  duatlon:
    "Duatlón (carrera, bicicleta, carrera): calendario, costo de inscripción y logística de viaje.",
  acuabike:
    "Acuabike (natación y bicicleta): calendario, costo de inscripción y logística de viaje.",
  triatlon:
    "Triatlones sprint, olímpicos, 70.3 e Ironman en Latinoamérica, con fechas, costo y vuelos a la sede.",
  aguas_abiertas:
    "Travesías y pruebas de natación en aguas abiertas: fechas, costo y alojamiento cerca de la partida.",
};

/**
 * Etiquetas conocidas (un evento puede llevar varias). El campo en base de
 * datos es texto libre para que el catálogo crezca sin migrar; esta tabla solo
 * le pone nombre legible a las que ya se usan.
 */
export const ETIQUETAS_CONOCIDAS: Record<string, string> = {
  "5k": "5K",
  "10k": "10K",
  "21k": "Media maratón",
  media_maraton: "Media maratón",
  maraton: "Maratón",
  ultra: "Ultra",
  gran_fondo: "Gran fondo",
  mtb: "MTB",
  ruta: "Ruta",
  super_sprint: "Super sprint",
  sprint: "Sprint",
  olimpico: "Olímpico",
  ironman_70_3: "Ironman 70.3",
  ironman_full: "Ironman",
  travesia: "Travesía",
};

export function nombreEtiqueta(clave: string): string {
  return (
    ETIQUETAS_CONOCIDAS[clave] ??
    clave.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
  );
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

/** El ciclismo conserva el #FF4500 que pide el PRD para el trazado principal. */
export const COLOR_TRAMO: Record<TipoTramo, string> = {
  natacion: "#0288D1",
  t1: "#7B1FA2",
  ciclismo: "#FF4500",
  t2: "#7B1FA2",
  carrera: "#2E7D32",
};

export interface ClimaProyectado {
  temp_min: number | null;
  temp_max: number | null;
  condicion: string | null;
}

/** Cuánto se puede confiar en `fecha_inicio`. */
export type FechaPrecision = "exacta" | "aproximada" | "por_confirmar";

export interface Evento {
  id: string;
  slug: string;
  nombre_oficial: string;
  categoria: Categoria;
  etiquetas: string[];
  fecha_inicio: string;
  fecha_fin: string | null;
  fecha_precision: FechaPrecision;
  ciudad_sede: string | null;
  pais: string | null;
  /** Código IATA de ciudad/metro del destino (LIM, CUZ, BUE…). */
  aeropuerto_iata: string | null;
  latitud_partida: number;
  longitud_partida: number;
  ruta_gpx_url: string | null;
  clima_proyectado: ClimaProyectado | null;
  fuente_url: string | null;
  descripcion: string | null;
  badges: string[];
  tramos: Tramo[];
  /** Rango aproximado de inscripción; null si ninguna fuente lo da. */
  costo_min: number | null;
  costo_max: number | null;
  moneda: string | null;
  inscripcion_url: string | null;
}

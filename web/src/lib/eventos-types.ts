export const CATEGORIAS = [
  "triatlon",
  "aguas_abiertas",
  "maraton",
  "ciclismo",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export const ETIQUETA_CATEGORIA: Record<Categoria, string> = {
  triatlon: "Triatlón",
  aguas_abiertas: "Aguas abiertas",
  maraton: "Maratón",
  ciclismo: "Ciclismo",
};

export const DESCRIPCION_CATEGORIA: Record<Categoria, string> = {
  triatlon:
    "Dónde dormir a distancia caminable del box de transición, para cada triatlón del calendario.",
  aguas_abiertas:
    "Travesías en mar y lago, con el alojamiento más cercano a la línea de salida en la playa.",
  maraton:
    "Maratones, medias y trail: hoteles a pie del arco de partida y del punto de llegada.",
  ciclismo:
    "Granfondos y clásicas de ruta, con la logística de la salida neutralizada resuelta.",
};

export function esCategoria(value: string): value is Categoria {
  return (CATEGORIAS as readonly string[]).includes(value);
}

export interface Tramo {
  tipo: "natacion" | "t1" | "ciclismo" | "t2" | "carrera";
  nombre: string;
  gpx_url: string | null;
}

export interface ClimaProyectado {
  temp_min: number | null;
  temp_max: number | null;
  condicion: string | null;
}

export interface Evento {
  id: string;
  slug: string;
  nombre_oficial: string;
  categoria: Categoria;
  /** YYYY-MM-DD */
  fecha_inicio: string;
  ciudad_sede: string | null;
  pais: string | null;
  latitud_partida: number;
  longitud_partida: number;
  ruta_gpx_url: string | null;
  clima_proyectado: ClimaProyectado | null;
  fuente_url: string | null;
  descripcion: string | null;
  badges: string[];
  tramos: Tramo[];
}

/** Colores de trazado por tramo, compartidos entre el mapa y su leyenda. */
export const COLOR_TRAMO: Record<Tramo["tipo"], string> = {
  natacion: "#0ea5e9",
  t1: "#a3a3a3",
  ciclismo: "#FF4500",
  t2: "#a3a3a3",
  carrera: "#16a34a",
};

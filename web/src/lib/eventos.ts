import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { Categoria, Evento, FechaPrecision } from "./eventos-types";

type Sql = NeonQueryFunction<false, false>;

/**
 * La columna DATE llega del driver de Neon como objeto `Date` en cuanto alguien
 * olvida el cast a texto. `String(fecha).slice(0, 10)` sobre eso da
 * "Fri Nov 0": la fecha visible, el <time datetime> y el startDate del JSON-LD
 * salen rotos. Las consultas ya hacen `to_char`; esto es el cinturón.
 */
export function aFechaISO(valor: string | Date): string {
  if (valor instanceof Date) {
    const mm = String(valor.getMonth() + 1).padStart(2, "0");
    const dd = String(valor.getDate()).padStart(2, "0");
    return `${valor.getFullYear()}-${mm}-${dd}`;
  }
  return valor.slice(0, 10);
}

let cliente: Sql | null = null;

function db(): Sql | null {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // Un build sin base de datos produce un sitio vacío, no un build roto: el
    // ISR vuelve a consultar en la primera visita real.
    console.warn("DATABASE_URL no está definida: el catálogo de eventos sale vacío.");
    return null;
  }
  cliente ??= neon(url);
  return cliente;
}

// `costo_*` es NUMERIC: el driver lo entrega como texto, de ahí el ::float8.
const COLUMNAS = `
  id, slug, nombre_oficial, categoria, etiquetas,
  to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
  to_char(fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
  fecha_precision, ciudad_sede, pais, aeropuerto_iata,
  latitud_partida, longitud_partida, ruta_gpx_url, clima_proyectado,
  fuente_url, descripcion, badges, tramos,
  costo_min::float8 AS costo_min, costo_max::float8 AS costo_max,
  moneda, inscripcion_url
`;

interface Fila {
  id: string;
  slug: string;
  nombre_oficial: string;
  categoria: Categoria;
  etiquetas: string[] | null;
  fecha_inicio: string | Date;
  fecha_fin: string | Date | null;
  fecha_precision: string | null;
  ciudad_sede: string | null;
  pais: string | null;
  aeropuerto_iata: string | null;
  latitud_partida: number | string;
  longitud_partida: number | string;
  ruta_gpx_url: string | null;
  clima_proyectado: Evento["clima_proyectado"];
  fuente_url: string | null;
  descripcion: string | null;
  badges: string[] | null;
  tramos: Evento["tramos"] | null;
  costo_min: number | string | null;
  costo_max: number | string | null;
  moneda: string | null;
  inscripcion_url: string | null;
}

const num = (v: number | string | null): number | null =>
  v === null || v === undefined ? null : Number(v);

function precision(v: string | null): FechaPrecision {
  return v === "aproximada" || v === "por_confirmar" ? v : "exacta";
}

function normalizar(f: Fila): Evento {
  return {
    id: f.id,
    slug: f.slug,
    nombre_oficial: f.nombre_oficial,
    categoria: f.categoria,
    etiquetas: f.etiquetas ?? [],
    fecha_inicio: aFechaISO(f.fecha_inicio),
    fecha_fin: f.fecha_fin ? aFechaISO(f.fecha_fin) : null,
    fecha_precision: precision(f.fecha_precision),
    ciudad_sede: f.ciudad_sede,
    pais: f.pais,
    aeropuerto_iata: f.aeropuerto_iata,
    latitud_partida: Number(f.latitud_partida),
    longitud_partida: Number(f.longitud_partida),
    ruta_gpx_url: f.ruta_gpx_url,
    clima_proyectado: f.clima_proyectado,
    fuente_url: f.fuente_url,
    descripcion: f.descripcion,
    badges: f.badges ?? [],
    tramos: f.tramos ?? [],
    costo_min: num(f.costo_min),
    costo_max: num(f.costo_max),
    moneda: f.moneda,
    inscripcion_url: f.inscripcion_url,
  };
}

// El driver de Neon solo acepta plantillas etiquetadas por defecto; `.query`
// admite el texto armado con las columnas compartidas.
async function consultar(sql: Sql, texto: string, params: unknown[]): Promise<Evento[]> {
  const filas = (await sql.query(texto, params)) as unknown as Fila[];
  return filas.map(normalizar);
}

/** Próximos eventos publicados, los más cercanos primero. */
export async function listarPublicados(limite: number): Promise<Evento[]> {
  const sql = db();
  if (!sql) return [];
  return consultar(
    sql,
    `SELECT ${COLUMNAS} FROM eventos_deportivos
     WHERE estado_publicacion = 'published' AND fecha_inicio >= CURRENT_DATE
     ORDER BY fecha_inicio ASC LIMIT $1`,
    [limite],
  );
}

export async function listarPorCategoria(categoria: Categoria): Promise<Evento[]> {
  const sql = db();
  if (!sql) return [];
  return consultar(
    sql,
    `SELECT ${COLUMNAS} FROM eventos_deportivos
     WHERE estado_publicacion = 'published' AND categoria = $1
       AND fecha_inicio >= CURRENT_DATE
     ORDER BY fecha_inicio ASC`,
    [categoria],
  );
}

/** Sin filtro de fecha: una edición pasada sigue siendo una URL válida. */
export async function obtenerEvento(
  categoria: Categoria,
  slug: string,
): Promise<Evento | null> {
  const sql = db();
  if (!sql) return null;
  const filas = await consultar(
    sql,
    `SELECT ${COLUMNAS} FROM eventos_deportivos
     WHERE estado_publicacion = 'published' AND categoria = $1 AND slug = $2
     LIMIT 1`,
    [categoria, slug],
  );
  return filas[0] ?? null;
}

/** Busca por slug a secas: el endpoint de vuelos no conoce la categoría. */
export async function obtenerEventoPorSlug(slug: string): Promise<Evento | null> {
  const sql = db();
  if (!sql) return null;
  const filas = await consultar(
    sql,
    `SELECT ${COLUMNAS} FROM eventos_deportivos
     WHERE estado_publicacion = 'published' AND slug = $1 LIMIT 1`,
    [slug],
  );
  return filas[0] ?? null;
}

/** Otros eventos de la misma disciplina, para enlazado interno. */
export async function relacionados(evento: Evento, limite = 3): Promise<Evento[]> {
  const sql = db();
  if (!sql) return [];
  return consultar(
    sql,
    `SELECT ${COLUMNAS} FROM eventos_deportivos
     WHERE estado_publicacion = 'published' AND categoria = $1 AND slug <> $2
       AND fecha_inicio >= CURRENT_DATE
     ORDER BY fecha_inicio ASC LIMIT $3`,
    [evento.categoria, evento.slug, limite],
  );
}

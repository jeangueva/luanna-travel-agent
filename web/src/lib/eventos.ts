import { neon } from "@neondatabase/serverless";
import {
  esCategoria,
  type Categoria,
  type Evento,
  type Tramo,
} from "./eventos-types";

/**
 * `DATABASE_URL` llega por dos caminos que terminan en el mismo lugar: los
 * archivos .env que vinext carga durante el build (prerender de
 * generateStaticParams) y, en runtime, el secreto de Workers — workerd puebla
 * `process.env` con vars y secrets cuando `nodejs_compat` está activo, que es
 * el caso de web/wrangler.jsonc. Por eso no hace falta un binding aparte.
 */
function databaseUrl(): string | null {
  return process.env.DATABASE_URL ?? null;
}

/**
 * El driver de Neon materializa una columna DATE como objeto `Date`, no como
 * texto: `String(fecha)` devuelve "Fri Nov 07 2026 00:00:00 GMT-0500", cuyo
 * `.slice(0, 10)` es "Fri Nov 0". Las consultas ya piden `to_char(...)` para
 * que llegue como texto ISO; esto es la red de seguridad por si alguna futura
 * consulta olvida el cast.
 */
export function aFechaISO(valor: unknown): string {
  if (valor instanceof Date) {
    const mm = String(valor.getMonth() + 1).padStart(2, "0");
    const dd = String(valor.getDate()).padStart(2, "0");
    return `${valor.getFullYear()}-${mm}-${dd}`;
  }
  return String(valor).slice(0, 10);
}

function toEvento(row: Record<string, unknown>): Evento | null {
  const categoria = String(row.categoria ?? "");
  if (!esCategoria(categoria)) return null;
  return {
    id: String(row.id),
    slug: String(row.slug),
    nombre_oficial: String(row.nombre_oficial),
    categoria: categoria as Categoria,
    fecha_inicio: aFechaISO(row.fecha_inicio),
    ciudad_sede: (row.ciudad_sede as string | null) ?? null,
    pais: (row.pais as string | null) ?? null,
    latitud_partida: Number(row.latitud_partida),
    longitud_partida: Number(row.longitud_partida),
    ruta_gpx_url: (row.ruta_gpx_url as string | null) ?? null,
    clima_proyectado: (row.clima_proyectado as Evento["clima_proyectado"]) ?? null,
    fuente_url: (row.fuente_url as string | null) ?? null,
    descripcion: (row.descripcion as string | null) ?? null,
    badges: Array.isArray(row.badges) ? (row.badges as string[]) : [],
    tramos: Array.isArray(row.tramos) ? (row.tramos as Tramo[]) : [],
  };
}

// `to_char` en vez de la columna cruda: DATE describe un día civil, y dejar
// que el driver lo convierta a Date arrastra la zona horaria del proceso a un
// dato que no tiene hora.
const COLUMNAS = `id, slug, nombre_oficial, categoria,
  to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio, ciudad_sede,
  pais, latitud_partida, longitud_partida, ruta_gpx_url, clima_proyectado,
  fuente_url, descripcion, badges, tramos`;

/**
 * Sin DATABASE_URL la plataforma devuelve listas vacías en vez de reventar: el
 * build tiene que pasar antes de que existan las credenciales, y una página de
 * categoría sin eventos es un estado legítimo, no un error 500.
 */
async function consultar(
  fn: (sql: ReturnType<typeof neon>) => Promise<unknown[]>,
): Promise<Evento[]> {
  const url = databaseUrl();
  if (!url) return [];
  try {
    const rows = await fn(neon(url));
    return (rows as Record<string, unknown>[])
      .map(toEvento)
      .filter((e): e is Evento => e !== null);
  } catch (err) {
    console.error("[eventos] consulta falló", err);
    return [];
  }
}

/** Solo eventos futuros: una carrera que ya ocurrió no resuelve ninguna logística. */
export function listarPublicados(limite = 500): Promise<Evento[]> {
  return consultar(
    (sql) =>
      sql`SELECT ${sql.unsafe(COLUMNAS)} FROM eventos_deportivos
          WHERE estado_publicacion = 'published' AND fecha_inicio >= CURRENT_DATE
          ORDER BY fecha_inicio ASC LIMIT ${limite}` as Promise<unknown[]>,
  );
}

export function listarPorCategoria(
  categoria: Categoria,
  limite = 200,
): Promise<Evento[]> {
  return consultar(
    (sql) =>
      sql`SELECT ${sql.unsafe(COLUMNAS)} FROM eventos_deportivos
          WHERE estado_publicacion = 'published'
            AND categoria = ${categoria}
            AND fecha_inicio >= CURRENT_DATE
          ORDER BY fecha_inicio ASC LIMIT ${limite}` as Promise<unknown[]>,
  );
}

export async function obtenerEvento(
  categoria: Categoria,
  slug: string,
): Promise<Evento | null> {
  const filas = await consultar(
    (sql) =>
      sql`SELECT ${sql.unsafe(COLUMNAS)} FROM eventos_deportivos
          WHERE estado_publicacion = 'published'
            AND categoria = ${categoria}
            AND slug = ${slug}
          LIMIT 1` as Promise<unknown[]>,
  );
  return filas[0] ?? null;
}

/** Otros eventos de la misma categoría, para enlazado interno. */
export async function relacionados(
  evento: Evento,
  limite = 3,
): Promise<Evento[]> {
  const todos = await listarPorCategoria(evento.categoria, limite + 1);
  return todos.filter((e) => e.slug !== evento.slug).slice(0, limite);
}

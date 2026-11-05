import { neon } from '@neondatabase/serverless'
import { esIdPortal, type Portal } from './portales'
import { validarMarca } from './marca'
import type { Evento, Resumen } from './medicion'
import { DURACION_ENLACE, hashToken, type Sujeto } from './portal-auth'

export const MAX_SEDES = 50
export const MAX_ENLACES_HORA = 3

/** Error de negocio que la API muestra tal cual. */
export class Rechazo extends Error { constructor(m: string, readonly status: number) { super(m) } }

/** Las sedes guardadas antes de existir la marca reciben la marca base. */
const conMarca = (portal: Record<string, unknown>) => ({ ...portal, marca: validarMarca(portal.marca) }) as Portal

function database() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL no configurada')
  return neon(url)
}

export async function listarPortales(quien: Sujeto): Promise<Portal[]> {
  const sql = database()
  const rows = quien === 'admin'
    ? await sql`SELECT id, config FROM ancla_portales ORDER BY updated_at DESC LIMIT 200`
    : await sql`SELECT id, config FROM ancla_portales WHERE cuenta_id = ${quien} ORDER BY updated_at DESC LIMIT 200`
  return rows.map(row => conMarca({ aeropuerto: '', ...row.config, id: row.id }))
}

/** Crea o actualiza. Una cuenta solo puede tocar sus sedes; el admin, todas. */
export async function guardarPortal(id: string, config: Omit<Portal, 'id'>, quien: Sujeto = 'admin'): Promise<Portal> {
  const sql = database()
  const json = JSON.stringify(config)
  if (quien === 'admin') {
    await sql`INSERT INTO ancla_portales (id, config) VALUES (${id}, ${json}::jsonb)
      ON CONFLICT (id) DO UPDATE SET config = EXCLUDED.config, updated_at = now()`
    return { ...config, id }
  }
  const actualizadas = await sql`UPDATE ancla_portales SET config = ${json}::jsonb, updated_at = now()
    WHERE id = ${id} AND cuenta_id = ${quien} RETURNING id`
  if (actualizadas.length) return { ...config, id }
  const [, creadas] = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtext(${'sedes:' + quien}))`,
    sql`INSERT INTO ancla_portales (id, config, cuenta_id)
    SELECT ${id}, ${json}::jsonb, ${quien}
    WHERE (SELECT count(*) FROM ancla_portales WHERE cuenta_id = ${quien}) < ${MAX_SEDES}
    ON CONFLICT (id) DO NOTHING RETURNING id`,
  ])
  if (creadas.length) return { ...config, id }
  const existe = await sql`SELECT 1 FROM ancla_portales WHERE id = ${id}`
  if (existe.length) throw new Rechazo('Esta sede no es tuya.', 403)
  throw new Rechazo(`Llegaste al máximo de ${MAX_SEDES} sedes. Escríbenos a hola@luanna.app si necesitas más.`, 429)
}

/** Guarda un enlace de acceso. Devuelve false si se pidieron demasiados en la última hora. */
export async function crearEnlace(email: string, token: string): Promise<boolean> {
  // Bloqueo por correo dentro de la transacción: peticiones simultáneas se esperan
  // y la segunda sentencia ve las filas de la anterior (READ COMMITTED).
  const sql = database()
  const [, rows] = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtext(${'enlace:' + email}))`,
    sql`INSERT INTO ancla_enlaces (token_hash, email, expira)
    SELECT ${hashToken(token)}, ${email}, now() + make_interval(secs => ${DURACION_ENLACE})
    WHERE (SELECT count(*) FROM ancla_enlaces WHERE email = ${email} AND creado > now() - interval '1 hour') < ${MAX_ENLACES_HORA}
    RETURNING email`,
  ])
  return rows.length > 0
}

/** Gasta el enlace (un solo uso) y devuelve la cuenta, creándola la primera vez. */
export async function consumirEnlace(token: string): Promise<string | null> {
  const sql = database()
  const usados = await sql`UPDATE ancla_enlaces SET usado = now()
    WHERE token_hash = ${hashToken(token)} AND usado IS NULL AND expira > now() RETURNING email`
  if (!usados.length) return null
  const email = usados[0].email as string
  const rows = await sql`INSERT INTO ancla_cuentas (email) VALUES (${email})
    ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id`
  return rows[0].id as string
}

export async function portalPublicado(id: string): Promise<Portal | null> {
  if (!esIdPortal(id)) return null
  const rows = await database()`SELECT id, config FROM ancla_portales
    WHERE id = ${id} AND config->>'publicado' = 'true' LIMIT 1`
  return rows[0] ? conMarca({ aeropuerto: '', ...rows[0].config, id: rows[0].id }) : null
}

/** Solo cuenta eventos de sedes publicadas, y cada tipo una vez por visita. */
export async function registrarEvento(e: Omit<Evento, 'ficha'>, visita: string): Promise<void> {
  await database()`INSERT INTO ancla_eventos (portal_id, tipo, idioma, incrustado, visita)
    SELECT id, ${e.tipo}, ${e.idioma}, ${e.incrustado}, ${visita} FROM ancla_portales
    WHERE id = ${e.portal} AND config->>'publicado' = 'true'
    ON CONFLICT (portal_id, visita, tipo) DO NOTHING`
}

/** Totales de los últimos 30 días por sede. */
export async function resumenEventos(quien: Sujeto): Promise<Record<string, Resumen>> {
  const sql = database()
  const rows = quien === 'admin'
    ? await sql`SELECT portal_id, tipo, count(*)::int AS n FROM ancla_eventos
      WHERE creado > now() - interval '30 days' GROUP BY portal_id, tipo`
    : await sql`SELECT e.portal_id, e.tipo, count(*)::int AS n FROM ancla_eventos e
      JOIN ancla_portales p ON p.id = e.portal_id AND p.cuenta_id = ${quien}
      WHERE e.creado > now() - interval '30 days' GROUP BY e.portal_id, e.tipo`
  const out: Record<string, Resumen> = {}
  for (const r of rows) {
    const t = (out[r.portal_id] ??= { vistas: 0, vuelos: 0, hoteles: 0 })
    if (r.tipo === 'vista') t.vistas = r.n; else if (r.tipo === 'vuelos') t.vuelos = r.n; else t.hoteles = r.n
  }
  return out
}

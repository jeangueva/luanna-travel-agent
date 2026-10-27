import { neon } from '@neondatabase/serverless'
import { esIdPortal, type Portal } from './portales'

function database() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL no configurada')
  return neon(url)
}

export async function listarPortales(): Promise<Portal[]> {
  const rows = await database()`SELECT id, config FROM ancla_portales ORDER BY updated_at DESC LIMIT 200`
  return rows.map(row => ({ aeropuerto: '', ...row.config, id: row.id }) as Portal)
}

export async function guardarPortal(id: string, config: Omit<Portal, 'id'>): Promise<Portal> {
  await database()`INSERT INTO ancla_portales (id, config)
    VALUES (${id}, ${JSON.stringify(config)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET config = EXCLUDED.config, updated_at = now()`
  return { ...config, id }
}

export async function portalPublicado(id: string): Promise<Portal | null> {
  if (!esIdPortal(id)) return null
  const rows = await database()`SELECT id, config FROM ancla_portales
    WHERE id = ${id} AND config->>'publicado' = 'true' LIMIT 1`
  return rows[0] ? { aeropuerto: '', ...rows[0].config, id: rows[0].id } as Portal : null
}

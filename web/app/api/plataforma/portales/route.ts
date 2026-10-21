import { autorizado, mismoOrigen } from '@/lib/portal-auth'
import { guardarPortal, listarPortales } from '@/lib/portal-store'
import { esIdPortal, validarPortal } from '@/lib/portales'

const headers = { 'Cache-Control': 'private, no-store' }

export async function GET(request: Request) {
  if (!autorizado(request)) return Response.json({ error: 'Inicia sesión.' }, { status: 401, headers })
  try {
    return Response.json({ portales: await listarPortales(), stay22: Boolean(process.env.NEXT_PUBLIC_STAY22_AID) }, { headers })
  } catch {
    return Response.json({ error: 'No se pudo cargar la base de datos. Revisa DATABASE_URL y la migración de portales.' }, { status: 503, headers })
  }
}

export async function POST(request: Request) {
  if (!autorizado(request)) return Response.json({ error: 'La sesión expiró. Vuelve a iniciar sesión.' }, { status: 401, headers })
  if (!mismoOrigen(request)) return Response.json({ error: 'Origen no permitido.' }, { status: 403, headers })
  const raw = await request.text()
  if (raw.length > 8192) return Response.json({ error: 'Solicitud demasiado grande.' }, { status: 413, headers })
  let config
  let id: string
  try {
    const input = JSON.parse(raw)
    config = validarPortal(input)
    if (input.id !== undefined && (typeof input.id !== 'string' || !esIdPortal(input.id))) throw new Error('Identificador inválido.')
    id = input.id ?? crypto.randomUUID()
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Datos inválidos.' }, { status: 400, headers })
  }
  try {
    return Response.json({ portal: await guardarPortal(id, config) }, { headers })
  } catch {
    return Response.json({ error: 'No se pudo guardar. Los datos del formulario siguen disponibles; revisa la conexión y vuelve a intentar.' }, { status: 503, headers })
  }
}

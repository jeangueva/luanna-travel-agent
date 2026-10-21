import { claveAdmin, COOKIE_PORTAL, crearSesion, DURACION_SESION, iguales, mismoOrigen } from '@/lib/portal-auth'

export async function POST(request: Request) {
  if (!mismoOrigen(request)) return Response.json({ error: 'Origen no permitido.' }, { status: 403 })
  const secret = claveAdmin()
  if (!secret) return Response.json({ error: 'Configura ANCLA_ADMIN_SECRET con al menos 32 caracteres aleatorios en el servidor.' }, { status: 503 })
  const raw = await request.text()
  if (raw.length > 4096) return Response.json({ error: 'Solicitud demasiado grande.' }, { status: 413 })
  let input
  try { input = JSON.parse(raw) } catch { return Response.json({ error: 'Solicitud inválida.' }, { status: 400 }) }
  if (typeof input?.clave !== 'string' || !iguales(input.clave, secret)) {
    return Response.json({ error: 'La clave no es válida.' }, { status: 401 })
  }
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return Response.json({ ok: true }, { headers: {
    'Cache-Control': 'no-store',
    'Set-Cookie': `${COOKIE_PORTAL}=${crearSesion(secret)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${DURACION_SESION}${secure}`,
  } })
}

export async function DELETE(request: Request) {
  if (!mismoOrigen(request)) return new Response(null, { status: 403 })
  return new Response(null, { status: 204, headers: {
    'Cache-Control': 'no-store',
    'Set-Cookie': `${COOKIE_PORTAL}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
  } })
}

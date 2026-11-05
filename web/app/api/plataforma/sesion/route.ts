import { claveAdmin, cookieSesion, COOKIE_PORTAL, crearSesion, esToken, iguales, mismoOrigen } from '@/lib/portal-auth'
import { consumirEnlace } from '@/lib/portal-store'

/** Entra con { token } (enlace del correo) o con { clave } (administrador). */
export async function POST(request: Request) {
  if (!mismoOrigen(request)) return Response.json({ error: 'Origen no permitido.' }, { status: 403 })
  const secret = claveAdmin()
  if (!secret) return Response.json({ error: 'Configura ANCLA_ADMIN_SECRET con al menos 32 caracteres aleatorios en el servidor.' }, { status: 503 })
  const raw = await request.text()
  if (raw.length > 4096) return Response.json({ error: 'Solicitud demasiado grande.' }, { status: 413 })
  let input
  try { input = JSON.parse(raw) } catch { return Response.json({ error: 'Solicitud inválida.' }, { status: 400 }) }
  let quien: string | null = null
  if (input?.token !== undefined) {
    if (!esToken(input.token)) return Response.json({ error: 'El enlace no es válido.' }, { status: 401 })
    try { quien = await consumirEnlace(input.token) }
    catch { return Response.json({ error: 'No pudimos verificar el enlace. Vuelve a intentar.' }, { status: 503 }) }
    if (!quien) return Response.json({ error: 'Este enlace ya se usó o venció. Pide uno nuevo.' }, { status: 401 })
  } else {
    if (typeof input?.clave !== 'string' || !iguales(input.clave, secret)) return Response.json({ error: 'La clave no es válida.' }, { status: 401 })
    quien = 'admin'
  }
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store', 'Set-Cookie': cookieSesion(request, crearSesion(secret, Date.now(), quien)) } })
}

export async function DELETE(request: Request) {
  if (!mismoOrigen(request)) return new Response(null, { status: 403 })
  return new Response(null, { status: 204, headers: {
    'Cache-Control': 'no-store',
    'Set-Cookie': `${COOKIE_PORTAL}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
  } })
}

import { claveAdmin, mismoOrigen, normalizarEmail, nuevoToken } from '@/lib/portal-auth'
import { crearEnlace } from '@/lib/portal-store'
import { correoConfigurado, enviarEnlace } from '@/lib/correo'

const headers = { 'Cache-Control': 'no-store' }

/** Pide un enlace de acceso. Responde igual exista o no la cuenta. */
export async function POST(request: Request) {
  if (!mismoOrigen(request)) return Response.json({ error: 'Origen no permitido.' }, { status: 403, headers })
  if (!claveAdmin() || !correoConfigurado()) return Response.json({ error: 'El acceso por correo todavía no está listo. Escríbenos a hola@luanna.app.' }, { status: 503, headers })
  const raw = await request.text()
  if (raw.length > 1024) return Response.json({ error: 'Solicitud demasiado grande.' }, { status: 413, headers })
  let email: string | null = null
  try { email = normalizarEmail(JSON.parse(raw)?.email) } catch { /* cae abajo */ }
  if (!email) return Response.json({ error: 'Escribe un correo válido, por ejemplo nombre@tunegocio.com.' }, { status: 400, headers })
  const token = nuevoToken()
  try {
    if (!(await crearEnlace(email, token))) return Response.json({ error: 'Ya te enviamos varios enlaces. Revisa tu correo o espera una hora.' }, { status: 429, headers })
    const origen = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
    await enviarEnlace(email, `${origen}/plataforma/entrar#${token}`)
  } catch (error) {
    console.error('enlace:', error instanceof Error ? error.message : error)
    return Response.json({ error: 'No pudimos enviar el correo. Vuelve a intentar en un momento.' }, { status: 503, headers })
  }
  return Response.json({ ok: true }, { headers })
}

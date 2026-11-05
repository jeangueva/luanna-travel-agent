import { mismoOrigen } from '@/lib/portal-auth'
import { validarEvento } from '@/lib/medicion'
import { registrarEvento } from '@/lib/portal-store'
import { visitaDeFicha } from '@/lib/ficha-visita'

/** Recibe eventos del portal público. Responde 204 aunque falle: medir nunca bloquea al visitante. */
export async function POST(request: Request) {
  if (!mismoOrigen(request)) return new Response(null, { status: 403 })
  const raw = await request.text()
  if (raw.length > 512) return new Response(null, { status: 413 })
  let evento
  try { evento = validarEvento(JSON.parse(raw)) } catch { return new Response(null, { status: 400 }) }
  // El origen solo frena a otras webs; la ficha firmada frena a los scripts.
  const visita = visitaDeFicha(evento.ficha, evento.portal)
  if (!visita) return new Response(null, { status: 403 })
  try { await registrarEvento(evento, visita) } catch { /* Sin base de datos, se pierde el evento y nada más. */ }
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}

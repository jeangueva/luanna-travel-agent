import { createHmac, randomBytes } from 'node:crypto'
import { claveAdmin, iguales } from './portal-auth'

/**
 * Ficha firmada que el portal entrega con cada carga. Sin ella no se cuenta
 * ningún evento, y con ella cada tipo cuenta una sola vez: un script no puede
 * inflar las cifras de una sede sin cargar la página una y otra vez.
 */
export const DURACION_FICHA = 2 * 60 * 60

const firma = (secret: string, portal: string, vence: string, visita: string) =>
  createHmac('sha256', secret).update(`ancla-evento:${portal}:${vence}:${visita}`).digest('hex')

export function crearFicha(portal: string, now = Date.now()): string | null {
  const secret = claveAdmin()
  if (!secret) return null
  const vence = String(Math.floor(now / 1000) + DURACION_FICHA)
  const visita = randomBytes(12).toString('hex')
  return `${vence}.${visita}.${firma(secret, portal, vence, visita)}`
}

/** Devuelve el id de la visita si la ficha es auténtica, vigente y de esa sede. */
export function visitaDeFicha(ficha: unknown, portal: string, now = Date.now()): string | null {
  const secret = claveAdmin()
  if (!secret || typeof ficha !== 'string' || !/^\d{10}\.[a-f0-9]{24}\.[a-f0-9]{64}$/.test(ficha)) return null
  const [vence, visita, recibida] = ficha.split('.')
  const ahora = Math.floor(now / 1000)
  if (Number(vence) <= ahora || Number(vence) > ahora + DURACION_FICHA) return null
  return iguales(recibida, firma(secret, portal, vence, visita)) ? visita : null
}

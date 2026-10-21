import { createHmac, createHash, timingSafeEqual } from 'node:crypto'

export const COOKIE_PORTAL = 'luanna_admin'
export const DURACION_SESION = 60 * 60 * 8

export function claveAdmin(): string | null {
  const value = process.env.ANCLA_ADMIN_SECRET
  return value && value.length >= 32 ? value : null
}

export function iguales(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest(),
  )
}

export function crearSesion(secret: string, now = Date.now()): string {
  const expiry = String(Math.floor(now / 1000) + DURACION_SESION)
  return `${expiry}.${createHmac('sha256', secret).update(`ancla-admin:${expiry}`).digest('hex')}`
}

export function sesionValida(token: string | undefined, secret: string | null, now = Date.now()): boolean {
  if (!token || !secret || !/^\d{10}\.[a-f0-9]{64}$/.test(token)) return false
  const [expiry, signature] = token.split('.')
  const seconds = Math.floor(now / 1000)
  if (Number(expiry) <= seconds || Number(expiry) > seconds + DURACION_SESION) return false
  return iguales(signature, createHmac('sha256', secret).update(`ancla-admin:${expiry}`).digest('hex'))
}

export function autorizado(request: Request): boolean {
  const token = request.headers.get('cookie')?.split(';')
    .map(value => value.trim()).find(value => value.startsWith(`${COOKIE_PORTAL}=`))
    ?.slice(COOKIE_PORTAL.length + 1)
  return sesionValida(token, claveAdmin())
}

export function mismoOrigen(request: Request): boolean {
  return request.headers.get('origin') === new URL(request.url).origin
}

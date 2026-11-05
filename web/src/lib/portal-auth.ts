import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export const COOKIE_PORTAL = 'luanna_admin'
export const DURACION_SESION = 60 * 60 * 24 * 14
export const DURACION_ENLACE = 60 * 20
/** Sujeto de la sesión: 'admin' (clave del servidor) o el id de una cuenta. */
export type Sujeto = 'admin' | string

export function claveAdmin(): string | null {
  const value = process.env.ANCLA_ADMIN_SECRET
  return value && value.length >= 32 ? value : null
}

export function iguales(a: string, b: string): boolean {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest())
}

const SUJETO = /^(admin|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/
const firmar = (secret: string, expiry: string, sujeto: string) =>
  createHmac('sha256', secret).update(`ancla-sesion:${sujeto}:${expiry}`).digest('hex')

export function crearSesion(secret: string, now = Date.now(), sujeto: Sujeto = 'admin'): string {
  if (!SUJETO.test(sujeto)) throw new Error('Sujeto inválido')
  const expiry = String(Math.floor(now / 1000) + DURACION_SESION)
  return `${expiry}.${sujeto}.${firmar(secret, expiry, sujeto)}`
}

export function sujetoDeSesion(token: string | undefined, secret: string | null, now = Date.now()): Sujeto | null {
  if (!token || !secret) return null
  const partes = token.split('.')
  if (partes.length !== 3) return null
  const [expiry, sujeto, firma] = partes
  if (!/^\d{10}$/.test(expiry) || !SUJETO.test(sujeto) || !/^[a-f0-9]{64}$/.test(firma)) return null
  const seconds = Math.floor(now / 1000)
  if (Number(expiry) <= seconds || Number(expiry) > seconds + DURACION_SESION) return null
  return iguales(firma, firmar(secret, expiry, sujeto)) ? sujeto : null
}

export const sesionValida = (token: string | undefined, secret: string | null, now = Date.now()) =>
  sujetoDeSesion(token, secret, now) !== null

export function leerCookie(header: string | null | undefined): string | undefined {
  return header?.split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE_PORTAL}=`))?.slice(COOKIE_PORTAL.length + 1)
}

/** Devuelve quién hace la petición, o null si no hay sesión válida. */
export function sujeto(request: Request): Sujeto | null {
  return sujetoDeSesion(leerCookie(request.headers.get('cookie')), claveAdmin())
}
export const autorizado = (request: Request) => sujeto(request) !== null

export function cookieSesion(request: Request, valor: string): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return `${COOKIE_PORTAL}=${valor}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${DURACION_SESION}${secure}`
}

export function mismoOrigen(request: Request): boolean {
  return request.headers.get('origin') === new URL(request.url).origin
}

export function normalizarEmail(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const email = valor.trim().toLowerCase()
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null
}

export const nuevoToken = () => randomBytes(32).toString('base64url')
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
export const esToken = (t: unknown): t is string => typeof t === 'string' && /^[A-Za-z0-9_-]{43}$/.test(t)

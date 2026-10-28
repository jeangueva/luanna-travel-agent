import test from 'node:test'
import assert from 'node:assert/strict'
import { validarPortal, esIdPortal } from '../src/lib/portales'
import { urlVuelos } from '../src/lib/afiliados'
import { elegirIdioma } from '../src/lib/portal-i18n'
import { crearSesion, sesionValida, mismoOrigen, DURACION_SESION } from '../src/lib/portal-auth'
import { POST as login, DELETE as logout } from '../app/api/plataforma/sesion/route'
import { GET as list, POST as save } from '../app/api/plataforma/portales/route'

const config = {
  organizacion: 'Organización de prueba', titulo: 'Encuentro',
  ciudad: 'Quito', vertical: 'evento', lat: 0, lon: -78.5,
  checkin: '2027-01-30', checkout: '2027-02-02', publicado: false,
}
const secret = 'test-only-secret-not-for-production-123456'

test('valida fechas de calendario y conserva coordenadas cero', () => {
  assert.equal(validarPortal(config).lat, 0)
  for (const patch of [
    { checkin: '2027-02-30' }, { checkout: '2027-01-30' },
    { checkout: '2028-01-30' }, { lat: NaN }, { lon: 181 },
    { lat: '0' }, { publicado: 'false' }, { vertical: 'otro' },
    { titulo: ' ' }, { organizacion: 'a'.repeat(121) },
  ]) assert.throws(() => validarPortal({ ...config, ...patch }))
  assert.throws(() => validarPortal(null))
  assert.equal('apiKey' in validarPortal({ ...config, apiKey: 'no guardar' }), false)
})

test('rechaza identificadores que no son UUID v4', () => {
  assert.equal(esIdPortal('a58bc2c0-8d73-453c-b3f0-f97e7e879351'), true)
  assert.equal(esIdPortal('../admin'), false)
  assert.equal(esIdPortal("' OR 1=1"), false)
})

test('sesiones firmadas expiran y rechazan firmas alteradas y claves rotadas', () => {
  const now = Date.UTC(2026, 9, 20)
  const token = crearSesion(secret, now)
  assert.equal(sesionValida(token, secret, now), true)
  assert.equal(sesionValida(token, secret, now + DURACION_SESION * 1000), false)
  assert.equal(sesionValida(token + '0', secret, now), false)
  assert.equal(sesionValida(token, secret + 'rotated', now), false)
  assert.equal(sesionValida(token, null, now), false)
  assert.equal(sesionValida('9999999999.' + 'a'.repeat(64), secret, now), false)
})

test('mutaciones exigen el origen de la aplicación', () => {
  assert.equal(mismoOrigen(new Request('https://luanna.test/api', { headers: { origin: 'https://evil.test' } })), false)
  assert.equal(mismoOrigen(new Request('https://luanna.test/api')), false)
  assert.equal(mismoOrigen(new Request('https://luanna.test/api', { headers: { origin: 'https://luanna.test' } })), true)
})

test('API privada rechaza acceso anónimo, valida entradas y crea cookies seguras', async () => {
  const original = process.env.ANCLA_ADMIN_SECRET
  process.env.ANCLA_ADMIN_SECRET = secret
  try {
    const request = (path: string, body: unknown, cookie?: string, origin = 'https://luanna.test') =>
      new Request(`https://luanna.test/api/plataforma/${path}`, {
        method: 'POST', headers: { origin, 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
        body: JSON.stringify(body),
      })
    assert.equal((await list(new Request('https://luanna.test/api/plataforma/portales'))).status, 401)
    assert.equal((await save(request('portales', config))).status, 401)
    assert.equal((await login(request('sesion', { clave: 'wrong' }))).status, 401)
    assert.equal((await login(request('sesion', { clave: secret }, undefined, 'https://evil.test'))).status, 403)
    const response = await login(request('sesion', { clave: secret }))
    assert.equal(response.status, 200)
    const cookie = response.headers.get('set-cookie')!
    assert.match(cookie, /HttpOnly/)
    assert.match(cookie, /SameSite=Strict/)
    assert.match(cookie, /Secure/)
    assert.equal((await save(request('portales', { ...config, lat: 200 }, cookie))).status, 400)
    assert.equal((await save(request('portales', config, cookie, 'https://evil.test'))).status, 403)
    assert.equal((await logout(request('sesion', {}))).headers.get('set-cookie')?.includes('Max-Age=0'), true)
    delete process.env.ANCLA_ADMIN_SECRET
    assert.equal((await login(request('sesion', { clave: secret }))).status, 503)
  } finally {
    if (original === undefined) delete process.env.ANCLA_ADMIN_SECRET
    else process.env.ANCLA_ADMIN_SECRET = original
  }
})

test('el aeropuerto es opcional, se normaliza y rechaza códigos inválidos', () => {
  assert.equal(validarPortal(config).aeropuerto, '')
  assert.equal(validarPortal({ ...config, aeropuerto: ' uio ' }).aeropuerto, 'UIO')
  assert.throws(() => validarPortal({ ...config, aeropuerto: 'QUITO' }), /3 letras/)
})

test('la búsqueda de vuelos lleva origen, destino, fechas y marker', () => {
  const url = urlVuelos({ marker: 'm1', origen: 'MEX', destino: 'UIO', ida: '2027-01-30', vuelta: '2027-02-02' })
  assert.equal(url, 'https://www.aviasales.com/search/MEX3001UIO02021?marker=m1')
})

test('el portal elige idioma por ?lang= y luego por el navegador', () => {
  assert.equal(elegirIdioma('en', 'es-PE,es'), 'en')
  assert.equal(elegirIdioma(undefined, 'en-US,en;q=0.9'), 'en')
  assert.equal(elegirIdioma(undefined, 'es-MX'), 'es')
  assert.equal(elegirIdioma(undefined, null), 'es')
  assert.equal(elegirIdioma('fr', 'de-DE'), 'en')
})

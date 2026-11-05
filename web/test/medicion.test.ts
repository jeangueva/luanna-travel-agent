import test from 'node:test'
import assert from 'node:assert/strict'
import { validarEvento } from '../src/lib/medicion'
import { crearFicha, visitaDeFicha, DURACION_FICHA } from '../src/lib/ficha-visita'
import { POST } from '../app/api/eventos/route'

process.env.ANCLA_ADMIN_SECRET = 'test-only-secret-not-for-production-123456'
const portal = 'ca70c75e-2cf6-4d98-bbf9-1f5e2e871790'
const otro = '3f1c2b7e-9a4d-4c3e-8b2a-1d5e6f7a8b9c'
const pedir = (cuerpo: unknown, origen = 'https://luanna.app') => new Request('https://luanna.app/api/eventos', {
  method: 'POST', headers: { origin: origen, 'content-type': 'application/json' }, body: JSON.stringify(cuerpo),
})

test('validarEvento exige ficha y tipos conocidos', () => {
  assert.deepEqual(validarEvento({ portal, tipo: 'vuelos', idioma: 'fr', incrustado: 'si', ficha: 'x' }), { portal, tipo: 'vuelos', idioma: 'es', incrustado: false, ficha: 'x' })
  assert.throws(() => validarEvento({ portal, tipo: 'vista' }))
  assert.throws(() => validarEvento({ portal, tipo: 'compra', ficha: 'x' }))
})

test('la ficha solo vale para su sede y mientras está vigente', () => {
  const ficha = crearFicha(portal)!
  assert.ok(visitaDeFicha(ficha, portal))
  assert.equal(visitaDeFicha(ficha, otro), null)
  assert.equal(visitaDeFicha(ficha, portal, Date.now() + (DURACION_FICHA + 5) * 1000), null)
  assert.equal(visitaDeFicha(ficha.slice(0, -1) + (ficha.endsWith('a') ? 'b' : 'a'), portal), null)
})

test('la API rechaza otros orígenes, datos inválidos y fichas falsas', async () => {
  const ficha = crearFicha(portal)!
  assert.equal((await POST(pedir({ portal, tipo: 'vista', ficha }, 'https://otra.web'))).status, 403)
  assert.equal((await POST(pedir({ portal, tipo: 'nada', ficha }))).status, 400)
  assert.equal((await POST(pedir({ portal, tipo: 'vista', ficha: crearFicha(otro) }))).status, 403)
})

test('con ficha válida y sin base de datos, no rompe al visitante', async () => {
  const antes = process.env.DATABASE_URL
  delete process.env.DATABASE_URL
  try { assert.equal((await POST(pedir({ portal, tipo: 'vista', ficha: crearFicha(portal) }))).status, 204) }
  finally { if (antes) process.env.DATABASE_URL = antes }
})

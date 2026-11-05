import test from 'node:test'
import assert from 'node:assert/strict'
import { validarEvento } from '../src/lib/medicion'
import { POST } from '../app/api/eventos/route'

const portal = 'ca70c75e-2cf6-4d98-bbf9-1f5e2e871790'
const pedir = (cuerpo: unknown, origen = 'https://luanna.app') => new Request('https://luanna.app/api/eventos', {
  method: 'POST', headers: { origin: origen, 'content-type': 'application/json' }, body: JSON.stringify(cuerpo),
})

test('validarEvento acepta solo tipos conocidos y normaliza el resto', () => {
  assert.deepEqual(validarEvento({ portal, tipo: 'vuelos', idioma: 'fr', incrustado: 'si' }), { portal, tipo: 'vuelos', idioma: 'es', incrustado: false })
  assert.throws(() => validarEvento({ portal, tipo: 'compra' }))
  assert.throws(() => validarEvento({ portal: 'x', tipo: 'vista' }))
})

test('la API de eventos rechaza otros orígenes y datos inválidos', async () => {
  assert.equal((await POST(pedir({ portal, tipo: 'vista' }, 'https://otra.web'))).status, 403)
  assert.equal((await POST(pedir({ portal, tipo: 'nada' }))).status, 400)
})

test('sin base de datos, un evento válido no rompe al visitante', async () => {
  const antes = process.env.DATABASE_URL
  delete process.env.DATABASE_URL
  try { assert.equal((await POST(pedir({ portal, tipo: 'vista' }))).status, 204) }
  finally { if (antes) process.env.DATABASE_URL = antes }
})

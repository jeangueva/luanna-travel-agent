// Prueba explícita sobre Neon: crea y elimina exclusivamente un UUID aleatorio.
// node --env-file=.env --import tsx --test test/portales-db.integration.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { guardarPortal, listarPortales, portalPublicado } from '../src/lib/portal-store'
import { validarPortal } from '../src/lib/portales'

test('Neon persiste, publica, actualiza y retira un portal', async () => {
  assert.ok(process.env.DATABASE_URL, 'Esta prueba requiere DATABASE_URL')
  const sql = neon(process.env.DATABASE_URL)
  const id = randomUUID()
  const config = validarPortal({
    organizacion: 'Prueba automatizada temporal',
    titulo: 'Verificación de persistencia', vertical: 'evento', ciudad: 'Quito',
    lat: 0, lon: -78.5, checkin: '2027-01-30', checkout: '2027-02-02',
    publicado: false,
  })
  try {
    await guardarPortal(id, config)
    assert.equal(await portalPublicado(id), null)
    assert.ok((await listarPortales()).some(portal => portal.id === id))
    await guardarPortal(id, { ...config, publicado: true })
    assert.equal((await portalPublicado(id))?.lat, 0)
    await guardarPortal(id, { ...config, publicado: true, titulo: 'Edición persistida' })
    assert.equal((await portalPublicado(id))?.titulo, 'Edición persistida')
    await guardarPortal(id, config)
    assert.equal(await portalPublicado(id), null)
  } finally {
    await sql`DELETE FROM ancla_portales WHERE id = ${id}`
  }
})

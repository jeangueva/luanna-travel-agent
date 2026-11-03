import test from 'node:test'
import assert from 'node:assert/strict'
import { contraste } from '../src/lib/contraste'
import { acentoLegible, FONDOS, validarMarca, variablesMarca } from '../src/lib/marca'

test('cualquier color de marca queda legible sobre fondo claro y oscuro', () => {
  for (const color of ['#facc15', '#ffffff', '#000000', '#22d3ee', '#905831', '#ff00ff']) {
    for (const fondo of ['claro', 'oscuro'] as const) {
      const v = variablesMarca(validarMarca({ color, fondo }))
      assert.ok(contraste(v['--m-acento'], v['--m-fondo']) >= 4.5, `${color} sobre ${fondo}`)
      assert.ok(contraste(v['--m-sobre-acento'], v['--m-acento']) >= 4.5, `texto sobre ${color}`)
    }
  }
})

test('los textos de cada fondo cumplen AA sobre fondo y superficie', () => {
  for (const f of Object.values(FONDOS)) {
    for (const texto of [f.texto, f.suave, f.error]) {
      assert.ok(contraste(texto, f.fondo) >= 4.5)
      assert.ok(contraste(texto, f.superficie) >= 4.5)
    }
  }
})

test('validarMarca descarta valores inventados y conserva los válidos', () => {
  assert.deepEqual(validarMarca({ color: 'red', fondo: 'neón', fuente: 'comic', esquinas: 'x' }), validarMarca(undefined))
  assert.equal(validarMarca({ color: '#ABCDEF' }).color, '#abcdef')
  assert.equal(acentoLegible('#1a1a1a', '#ffffff'), '#1a1a1a')
})

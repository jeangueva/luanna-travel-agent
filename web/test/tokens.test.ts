import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { contraste, textoSobre } from '../src/lib/contraste'

const tokens = JSON.parse(readFileSync(new URL('../design/tokens.json', import.meta.url), 'utf8'))
const color = (nombre: string) => tokens.color[nombre].$value as string

test('cada par de contraste del contrato cumple su mínimo WCAG', () => {
  for (const [texto, fondo, minimo] of tokens.contrast.pairs as [string, string, number][]) {
    const ratio = contraste(color(texto), color(fondo))
    assert.ok(ratio >= minimo, `${texto} sobre ${fondo}: ${ratio.toFixed(2)} < ${minimo}`)
  }
})

test('ningún tamaño de texto baja de 13px y los controles miden al menos 44px', () => {
  for (const [nombre, token] of Object.entries(tokens.size as Record<string, { $value: string }>)) {
    assert.ok(parseFloat(token.$value) >= 13, `${nombre} es menor a 13px`)
  }
  assert.ok(parseFloat(tokens.target.min.$value) >= 44)
})

test('src/tokens.css está al día con design/tokens.json', () => {
  const css = readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8')
  for (const [nombre, token] of Object.entries(tokens.color as Record<string, { $value: string }>)) {
    assert.ok(css.includes(`--color-${nombre}: ${token.$value};`), `falta --color-${nombre}; corre npm run tokens`)
  }
})

test('textoSobre elige el color legible', () => {
  assert.equal(textoSobre('#ffffff'), '#0a0a0a')
  assert.equal(textoSobre('#0a0a0a'), '#fafafa')
  assert.equal(textoSobre('#905831'), '#fafafa')
})

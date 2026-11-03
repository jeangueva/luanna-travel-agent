/**
 * design/tokens.json → src/tokens.css. Se corre con `npm run tokens` y también
 * antes de cada build, así el CSS nunca se desvía del contrato.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const raiz = fileURLToPath(new URL('..', import.meta.url))
const tokens = JSON.parse(readFileSync(raiz + 'design/tokens.json', 'utf8'))

const lineas: string[] = []
for (const grupo of ['color', 'font', 'size', 'space', 'radius', 'target']) {
  for (const [nombre, token] of Object.entries(tokens[grupo] as Record<string, { $value: string }>)) {
    if (nombre.startsWith('$')) continue
    const prefijo = grupo === 'size' ? '' : grupo + '-'
    lineas.push(`  --${prefijo}${nombre}: ${token.$value};`)
  }
}

writeFileSync(raiz + 'src/tokens.css',
  `/* Generado desde design/tokens.json con \`npm run tokens\`. No editar a mano. */\n:root {\n${lineas.join('\n')}\n}\n`)
console.log(`tokens.css: ${lineas.length} variables`)

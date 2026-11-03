/**
 * Puente vivo entre design/tokens.json y el archivo de Figma "Luanna DS".
 *
 *   npm run figma -- push   → escribe design/figma-push.js (código para use_figma)
 *   npm run figma -- pull   → escribe design/figma-pull.js (lee variables de Figma)
 *   npm run figma -- apply design/figma-pull.result.json
 *                           → aplica a tokens.json lo que cambió en Figma
 *
 * El agente corre los .js generados con el MCP de Figma (use_figma). push es
 * idempotente: crea lo que falta, actualiza lo distinto y devuelve el diff.
 * Si alguien cambia un color en Figma, pull + apply lo trae al código, y el
 * test de contraste decide si el cambio es aceptable.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { FONDOS } from '../src/lib/marca'

const raiz = fileURLToPath(new URL('..', import.meta.url))
const tokensPath = raiz + 'design/tokens.json'
const tokens = JSON.parse(readFileSync(tokensPath, 'utf8'))
const figma = JSON.parse(readFileSync(raiz + 'design/figma.json', 'utf8'))

type Fila = { nombre: string; tipo: 'COLOR' | 'FLOAT'; valor: string | number; css: string; scopes: string[] }

/** Contrato de nombres: token "color.ink" ↔ variable "color/ink" ↔ var(--color-ink). */
export function filas(): Fila[] {
  const out: Fila[] = []
  for (const [n, t] of Object.entries(tokens.color as Record<string, { $value: string }>)) {
    const texto = n.startsWith('ink') || n === 'on-dark' || n === 'danger' || n === 'success' || n === 'accent'
    out.push({ nombre: `color/${n}`, tipo: 'COLOR', valor: t.$value, css: `--color-${n}`,
      scopes: n === 'line' ? ['STROKE_COLOR'] : texto ? ['TEXT_FILL', 'SHAPE_FILL', 'STROKE_COLOR'] : ['FRAME_FILL', 'SHAPE_FILL', 'STROKE_COLOR'] })
  }
  const dims: [string, string, string[]][] = [['space', 'space', ['GAP', 'WIDTH_HEIGHT']], ['radius', 'radius', ['CORNER_RADIUS']], ['size', '', ['FONT_SIZE']], ['target', 'target', ['WIDTH_HEIGHT']]]
  for (const [grupo, prefijo, scopes] of dims) {
    for (const [n, t] of Object.entries(tokens[grupo] as Record<string, { $value: string }>)) {
      if (n.startsWith('$')) continue
      out.push({ nombre: `${grupo}/${n}`, tipo: 'FLOAT', valor: parseFloat(t.$value), css: prefijo ? `--${prefijo}-${n}` : `--${n}`, scopes })
    }
  }
  return out
}

const portal = Object.entries(FONDOS.claro).map(([k, claro]) => ({ nombre: `portal/${k}`, claro, oscuro: FONDOS.oscuro[k as keyof typeof FONDOS.claro], css: `--m-${k}` }))

const push = `// Generado por scripts/figma-sync.ts — no editar.
const FILAS = ${JSON.stringify(filas())};
const PORTAL = ${JSON.stringify(portal)};
const hex = h => ({ r: parseInt(h.slice(1,3),16)/255, g: parseInt(h.slice(3,5),16)/255, b: parseInt(h.slice(5,7),16)/255 });
const aHex = c => '#' + [c.r,c.g,c.b].map(x => Math.round(x*255).toString(16).padStart(2,'0')).join('');
const colecciones = await figma.variables.getLocalVariableCollectionsAsync();
const locales = await figma.variables.getLocalVariablesAsync();
async function coleccion(nombre, modos) {
  let c = colecciones.find(x => x.name === nombre);
  if (!c) { c = figma.variables.createVariableCollection(nombre); c.renameMode(c.modes[0].modeId, modos[0]); for (const m of modos.slice(1)) c.addMode(m); }
  return c;
}
const diff = { creadas: [], actualizadas: [], iguales: 0 };
async function upsert(c, nombre, tipo, valores, css, scopes) {
  let v = locales.find(x => x.name === nombre && x.variableCollectionId === c.id);
  if (!v) { v = figma.variables.createVariable(nombre, c, tipo); diff.creadas.push(nombre); }
  let cambio = false;
  c.modes.forEach((m, i) => {
    const nuevo = tipo === 'COLOR' ? hex(valores[i]) : valores[i];
    const actual = v.valuesByMode[m.modeId];
    const igual = tipo === 'COLOR' ? actual && aHex(actual) === valores[i] : actual === nuevo;
    if (!igual) { v.setValueForMode(m.modeId, nuevo); cambio = true; }
  });
  v.scopes = scopes; v.setVariableCodeSyntax('WEB', 'var(' + css + ')');
  if (cambio && !diff.creadas.includes(nombre)) diff.actualizadas.push(nombre); else if (!cambio) diff.iguales++;
  return v.id;
}
const ds = await coleccion('Luanna DS', ['Valor']);
const ids = {};
for (const f of FILAS) ids[f.nombre] = await upsert(ds, f.nombre, f.tipo, [f.valor], f.css, f.scopes);
const pc = await coleccion('Portal', ['Claro', 'Oscuro']);
for (const p of PORTAL) ids[p.nombre] = await upsert(pc, p.nombre, 'COLOR', [p.claro, p.oscuro], p.css, p.nombre.endsWith('fondo') || p.nombre.endsWith('superficie') ? ['FRAME_FILL','SHAPE_FILL'] : p.nombre.endsWith('linea') ? ['STROKE_COLOR'] : ['TEXT_FILL','SHAPE_FILL']);
return { colecciones: { ds: ds.id, portal: pc.id, portalModos: pc.modes.map(m => m.modeId) }, diff, ids };
`

const pull = `// Generado por scripts/figma-sync.ts — no editar.
const aHex = c => '#' + [c.r,c.g,c.b].map(x => Math.round(x*255).toString(16).padStart(2,'0')).join('');
const c = (await figma.variables.getLocalVariableCollectionsAsync()).find(x => x.name === 'Luanna DS');
if (!c) return { error: 'No existe la colección Luanna DS' };
const modo = c.modes[0].modeId;
const out = {};
for (const id of c.variableIds) {
  const v = await figma.variables.getVariableByIdAsync(id);
  const val = v.valuesByMode[modo];
  out[v.name] = v.resolvedType === 'COLOR' ? aHex(val) : val;
}
return out;
`

const modo = process.argv[2]
if (modo === 'push') { writeFileSync(raiz + 'design/figma-push.js', push); console.log(`design/figma-push.js → ${filas().length + portal.length} variables para ${figma.fileUrl}`) }
else if (modo === 'pull') { writeFileSync(raiz + 'design/figma-pull.js', pull); console.log('design/figma-pull.js listo: córrelo con use_figma y guarda el resultado en design/figma-pull.result.json') }
else if (modo === 'apply') {
  const desdeFigma = JSON.parse(readFileSync(process.argv[3], 'utf8')) as Record<string, string | number>
  const cambios: string[] = []
  for (const f of filas()) {
    const nuevo = desdeFigma[f.nombre]
    if (nuevo === undefined || nuevo === f.valor) continue
    const [grupo, nombre] = f.nombre.split('/')
    tokens[grupo][nombre].$value = f.tipo === 'COLOR' ? nuevo : `${nuevo}px`
    cambios.push(`${f.nombre}: ${f.valor} → ${nuevo}`)
  }
  if (cambios.length) writeFileSync(tokensPath, JSON.stringify(tokens, null, 2) + '\n')
  console.log(cambios.length ? `Traído de Figma:\n  ${cambios.join('\n  ')}\nCorre npm run tokens && npm test.` : 'Figma y el código ya coinciden.')
} else console.log('Uso: npm run figma -- push | pull | apply <resultado.json>')

import { contraste, hexValido, textoSobre } from './contraste'

/**
 * La apariencia del portal de cada sede. El organizador elige; nosotros
 * garantizamos que se lea: el acento se corrige hasta cumplir 4.5:1 sobre el
 * fondo, y el texto de los botones se elige solo (negro o blanco).
 */
export interface Marca {
  color: string
  fondo: 'claro' | 'oscuro'
  fuente: 'geist' | 'serif' | 'redonda' | 'sistema'
  esquinas: 'rectas' | 'suaves' | 'redondas'
}

export const MARCA_BASE: Marca = { color: '#905831', fondo: 'claro', fuente: 'geist', esquinas: 'suaves' }

export const FUENTES: Record<Marca['fuente'], { nombre: string; css: string }> = {
  geist: { nombre: 'Moderna', css: 'Geist, -apple-system, sans-serif' },
  serif: { nombre: 'Clásica', css: "'Source Serif 4', Georgia, serif" },
  redonda: { nombre: 'Amable', css: 'Poppins, -apple-system, sans-serif' },
  sistema: { nombre: 'La de tu web', css: 'inherit' },
}

const RADIOS: Record<Marca['esquinas'], [string, string]> = {
  rectas: ['4px', '6px'], suaves: ['14px', '24px'], redondas: ['999px', '36px'],
}

export const FONDOS = {
  claro: { fondo: '#ffffff', superficie: '#f6f4f1', texto: '#1a1a1a', suave: '#5c5c5c', linea: '#e4e0da', error: '#b42318' },
  oscuro: { fondo: '#111111', superficie: '#1c1c1c', texto: '#f5f5f5', suave: '#b5b5b5', linea: '#333333', error: '#ff8a80' },
}

export function validarMarca(input: unknown): Marca {
  const m = (input && typeof input === 'object' ? input : {}) as Partial<Record<keyof Marca, unknown>>
  const uno = <T extends string>(valor: unknown, opciones: readonly T[], base: T) =>
    opciones.includes(valor as T) ? valor as T : base
  return {
    color: typeof m.color === 'string' && hexValido(m.color) ? m.color.toLowerCase() : MARCA_BASE.color,
    fondo: uno(m.fondo, ['claro', 'oscuro'] as const, MARCA_BASE.fondo),
    fuente: uno(m.fuente, ['geist', 'serif', 'redonda', 'sistema'] as const, MARCA_BASE.fuente),
    esquinas: uno(m.esquinas, ['rectas', 'suaves', 'redondas'] as const, MARCA_BASE.esquinas),
  }
}

/** Oscurece o aclara el color hasta que se lea sobre el fondo y su propio texto se lea encima. */
export function acentoLegible(color: string, fondo: string, minimo = 4.5): string {
  const oscurecer = contraste('#000000', fondo) > contraste('#ffffff', fondo)
  let actual = color
  const legible = (c: string) => contraste(c, fondo) >= minimo && contraste(textoSobre(c), c) >= minimo
  for (let i = 0; i < 60 && !legible(actual); i++) {
    actual = '#' + [1, 3, 5].map(j => {
      const c = parseInt(actual.slice(j, j + 2), 16)
      const siguiente = oscurecer ? Math.round(c * 0.92) : Math.round(c + (255 - c) * 0.12)
      return siguiente.toString(16).padStart(2, '0')
    }).join('')
  }
  return actual
}

/** Variables CSS que pintan el portal. Todo el CSS del portal lee de aquí. */
export function variablesMarca(marca: Marca): Record<string, string> {
  const f = FONDOS[marca.fondo]
  const acento = acentoLegible(marca.color, f.fondo)
  const [control, tarjeta] = RADIOS[marca.esquinas]
  return {
    '--m-fondo': f.fondo, '--m-superficie': f.superficie, '--m-texto': f.texto,
    '--m-suave': f.suave, '--m-linea': f.linea, '--m-error': f.error, '--m-acento': acento,
    '--m-sobre-acento': textoSobre(acento), '--m-fuente': FUENTES[marca.fuente].css,
    '--m-radio': control, '--m-radio-tarjeta': tarjeta,
  }
}

export const colorAjustado = (marca: Marca) => acentoLegible(marca.color, FONDOS[marca.fondo].fondo) !== marca.color

import { esIdPortal } from './portales'

/** Lo único que medimos de un portal. Ver migrations/002_ancla_eventos.sql. */
export const TIPOS_EVENTO = ['vista', 'vuelos', 'hoteles'] as const
export type TipoEvento = (typeof TIPOS_EVENTO)[number]

export interface Evento { portal: string; tipo: TipoEvento; idioma: 'es' | 'en'; incrustado: boolean; ficha: string }

export interface Resumen { vistas: number; vuelos: number; hoteles: number }

export function validarEvento(input: unknown): Evento {
  const e = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  if (typeof e.portal !== 'string' || !esIdPortal(e.portal)) throw new Error('Portal inválido.')
  if (!TIPOS_EVENTO.includes(e.tipo as TipoEvento)) throw new Error('Tipo inválido.')
  if (typeof e.ficha !== 'string' || e.ficha.length > 120) throw new Error('Falta la ficha de la visita.')
  return { portal: e.portal, tipo: e.tipo as TipoEvento, idioma: e.idioma === 'en' ? 'en' : 'es', incrustado: e.incrustado === true, ficha: e.ficha }
}

/** Lo envía el navegador sin bloquear la navegación (sobrevive al abrir otra pestaña). */
export function medir(evento: Evento) {
  if (!evento.ficha) return
  try {
    const cuerpo = JSON.stringify(evento)
    if (!navigator.sendBeacon?.('/api/eventos', new Blob([cuerpo], { type: 'application/json' }))) {
      void fetch('/api/eventos', { method: 'POST', body: cuerpo, headers: { 'Content-Type': 'application/json' }, keepalive: true })
    }
  } catch { /* Medir nunca debe romper el portal. */ }
}

'use client'

import { useState, type FormEvent } from 'react'
import { ArrowUpRight, Plane } from 'lucide-react'
import { urlVuelos } from '@/lib/afiliados'
import { textosPortal, type Idioma } from '@/lib/portal-i18n'

/**
 * La sede ya fija destino y fechas; el visitante solo dice desde dónde sale.
 * Pedimos el código IATA porque es lo único que Aviasales acepta en la ruta
 * sin un paso de autocompletado intermedio.
 */
export function BuscarVuelos({ destino, ciudad, ida, vuelta, marker, idioma }: {
  destino: string; ciudad: string; ida: string; vuelta: string; marker: string; idioma: Idioma
}) {
  const t = textosPortal[idioma].vuelos
  const [origen, setOrigen] = useState('')
  const [error, setError] = useState('')
  function buscar(event: FormEvent) {
    event.preventDefault()
    const codigo = origen.trim().toUpperCase()
    if (!/^[A-Z]{3}$/.test(codigo)) { setError(t.errorCodigo); return }
    if (codigo === destino) { setError(t.errorMismo); return }
    setError('')
    window.open(urlVuelos({ marker, origen: codigo, destino, ida, vuelta }), '_blank', 'noopener')
  }
  return <section className="portal-flights" aria-labelledby="vuelos-title">
    <div className="form-section-heading"><Plane size={18} /><h2 id="vuelos-title">{t.titulo}</h2></div>
    <p>{t.intro(ciudad, destino)}</p>
    <form onSubmit={buscar} className="flight-search">
      <label>{t.campo}<input value={origen} onChange={e => { setOrigen(e.target.value); setError('') }} maxLength={3} placeholder="MEX" autoCapitalize="characters" autoComplete="off" aria-invalid={Boolean(error)} aria-describedby={error ? 'vuelos-error' : undefined} /></label>
      <button className="glass-button glass-primary">{t.boton} <ArrowUpRight size={17} /></button>
    </form>
    {error && <p id="vuelos-error" role="alert" className="field-hint">{error}</p>}
  </section>
}

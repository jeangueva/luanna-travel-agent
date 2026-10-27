'use client'

import { useState, type FormEvent } from 'react'
import { ArrowUpRight, Plane } from 'lucide-react'
import { urlVuelos } from '@/lib/afiliados'

/**
 * La sede ya fija destino y fechas; el visitante solo dice desde dónde sale.
 * Pedimos el código IATA porque es lo único que Aviasales acepta en la ruta
 * sin un paso de autocompletado intermedio.
 */
export function BuscarVuelos({ destino, ciudad, ida, vuelta, marker }: {
  destino: string; ciudad: string; ida: string; vuelta: string; marker: string
}) {
  const [origen, setOrigen] = useState('')
  const [error, setError] = useState('')
  function buscar(event: FormEvent) {
    event.preventDefault()
    const codigo = origen.trim().toUpperCase()
    if (!/^[A-Z]{3}$/.test(codigo)) { setError('Escribe el código de 3 letras de tu aeropuerto, como MEX, MAD o MIA.'); return }
    if (codigo === destino) { setError('Ese es el aeropuerto de llegada. Escribe el de tu ciudad.'); return }
    setError('')
    window.open(urlVuelos({ marker, origen: codigo, destino, ida, vuelta }), '_blank', 'noopener')
  }
  return <section className="portal-flights" aria-labelledby="vuelos-title">
    <div className="form-section-heading"><Plane size={18} /><h2 id="vuelos-title">Cómo llegar</h2></div>
    <p>Vuelos de ida y vuelta a {ciudad} ({destino}) en las fechas de tu estancia.</p>
    <form onSubmit={buscar} className="flight-search">
      <label>Tu aeropuerto de salida<input value={origen} onChange={e => { setOrigen(e.target.value); setError('') }} maxLength={3} placeholder="Ej. MEX" autoCapitalize="characters" autoComplete="off" aria-invalid={Boolean(error)} aria-describedby={error ? 'vuelos-error' : undefined} /></label>
      <button className="glass-button glass-primary">Buscar vuelos <ArrowUpRight size={17} /></button>
    </form>
    {error && <p id="vuelos-error" role="alert" className="field-hint">{error}</p>}
  </section>
}

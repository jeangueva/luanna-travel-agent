'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Compass, CreditCard, Hotel, MapPin, RotateCcw, Ticket, X } from 'lucide-react'
import { nochesDemo } from '@/lib/demo-estancia'

const money = (value: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(value)
const stays = [
  { name: 'Casa del Parque', type: 'Habitación doble', rate: 240, distance: '600 m', detail: 'Una habitación para dos personas, baño privado y desayuno de ejemplo.', tone: 'park' },
  { name: 'Estudio del Malecón', type: 'Estudio con cocina', rate: 310, distance: '1,2 km', detail: 'Un estudio para dos personas con cocina y espacio de trabajo de ejemplo.', tone: 'coast' },
  { name: 'Hotel del Encuentro', type: 'Habitación estándar', rate: 195, distance: '1,8 km', detail: 'Una habitación para dos personas con baño privado de ejemplo.', tone: 'city' },
]

export function CheckoutDemo({ confirmed }: { confirmed: boolean }) {
  const [quantity, setQuantity] = useState(1)
  const frame = useRef<HTMLIFrameElement>(null)
  useEffect(() => {
    if (!confirmed) return
    const node = frame.current
    let observer: ResizeObserver | undefined
    const measure = () => {
      observer?.disconnect()
      // This demo iframe is intentionally same-origin. No third-party DOM access.
      const content = node?.contentDocument?.querySelector('main')
      if (!node || !content) return
      const resize = () => { node.style.height = `${Math.ceil(content.getBoundingClientRect().height)}px` }
      resize()
      observer = new ResizeObserver(resize)
      observer.observe(content)
    }
    node?.addEventListener('load', measure)
    measure()
    return () => { observer?.disconnect(); node?.removeEventListener('load', measure) }
  }, [confirmed])
  return <div className="checkout-demo">
    <a className="demo-skip" href="#demo-main">Saltar al contenido</a>
    <div className="demo-ribbon"><span><Compass size={16} /> DEMO LIBRE DE LUANNA</span><p>Servicio ficticio. Sin registro, cargos ni reservas reales.</p><a href="/">Volver a Luanna <ArrowRight size={14} /></a></div>
    <header className="demo-host-nav"><a href="/demo" aria-label="Reiniciar demo de Taller Abierto"><span className="host-monogram">ta.</span>taller abierto<span className="host-fiction">Marca ficticia</span></a><span><Ticket size={17} /> Inscripciones</span></header>
    <main id="demo-main" className="demo-host-main">
      <nav aria-label="Etapas de la demostración" className="demo-steps"><a href="/demo" aria-current={!confirmed ? 'step' : undefined}><span>{confirmed ? <Check size={13} /> : '1'}</span> Inscripción</a><i aria-hidden="true" /><a href="/demo?paso=confirmacion" aria-current={confirmed ? 'step' : undefined}><span>2</span> Confirmación + Luanna</a></nav>
      {!confirmed ? <>
        <div className="demo-heading"><p className="demo-kicker">UN FIN DE SEMANA PARA CREAR</p><h1>Tu próxima idea<br />empieza en Lima.</h1><p>Inscríbete al taller de fotografía. Después del pago de prueba, descubre cómo Luanna acompaña el viaje.</p></div>
        <div className="demo-checkout-grid">
          <section className="demo-service"><div className="demo-service-art" aria-hidden="true"><span>LUZ<br /><em>& ciudad.</em></span><span className="art-edition">LIMA / EDICIÓN 01</span><div className="art-aperture" /></div><div className="demo-service-body"><p className="demo-kicker">TALLER PRESENCIAL · EJEMPLO</p><h2>Fotografía en la ciudad</h2><p>20 y 21 de marzo de 2027 · 09:00–17:00</p><p className="demo-inline"><MapPin size={16} /> Sede de ejemplo · Miraflores, Lima</p><p>Dos días de práctica, recorridos y una nueva forma de mirar.</p></div></section>
          <section className="demo-order" aria-labelledby="order-title"><p className="demo-kicker">ÚLTIMO PASO</p><h2 id="order-title">Tu inscripción</h2><label className="demo-field">Participantes<select value={quantity} onChange={e => setQuantity(Number(e.target.value))}>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} {n === 1 ? 'persona' : 'personas'}</option>)}</select></label><dl><div><dt>Taller × {quantity}</dt><dd>{money(280 * quantity)}</dd></div><div><dt>Cargo de servicio</dt><dd>{money(0)}</dd></div><div className="demo-total"><dt>Total simulado</dt><dd aria-live="polite">{money(280 * quantity)}</dd></div></dl><div className="demo-payment"><CreditCard size={24} /><div><strong>Pago de prueba</strong><p>No necesitas tarjeta ni datos personales.</p></div></div><a className="demo-primary" href={`/demo?paso=confirmacion`}>Simular pago y continuar <ArrowRight size={17} /></a><p className="demo-fine">No se cobrará el importe. Esta acción solo abre la confirmación de ejemplo.</p><a className="demo-text-link" href="/demo?paso=confirmacion">Ir directamente al módulo de Luanna</a></section>
        </div>
      </> : <>
        <section className="demo-confirmation"><span className="demo-check"><Check size={24} /></span><div><p className="demo-kicker">PAGO SIMULADO · NO SE HA REALIZADO NINGÚN COBRO</p><h1>Nos vemos en Lima.</h1><p>Así se vería la confirmación de tu inscripción.</p></div><a className="demo-text-link" href="/demo"><RotateCcw size={15} /> Repetir demo</a></section>
        <div className="demo-ticket"><Ticket size={25} /><div><strong>Fotografía en la ciudad</strong><p>20–21 marzo 2027 · Miraflores, Lima</p></div><span>INSCRIPCIÓN DE EJEMPLO</span></div>
        <section className="demo-integration" aria-labelledby="integration-title"><div className="demo-integration-intro"><div><p className="demo-kicker">TU INSCRIPCIÓN TERMINA AQUÍ. TU VIAJE EMPIEZA AHORA.</p><h2 id="integration-title">¿Vienes de otra ciudad?</h2><p>Encuentra dónde quedarte cerca del taller, sin salir de esta página.</p></div><span className="demo-embed-tag"><Compass size={16} /> Módulo integrado de Luanna</span></div><iframe ref={frame} src="/demo/alojamiento" title="Demo interactiva de Luanna: alojamiento cerca del taller" className="demo-lodging-frame" /><p className="demo-fine">Este bloque es un iframe real dentro de una web de ejemplo. Los alojamientos, distancias y precios son ficticios; no representan disponibilidad.</p></section>
        <aside className="demo-owner-note"><div><h2>Tu servicio, su viaje. En la misma experiencia.</h2><p>Así podría aparecer Luanna después de una inscripción o del pago de un servicio.</p></div><a href="/plataforma" className="demo-primary">Crear mi portal <ArrowRight size={16} /></a></aside>
      </>}
    </main><footer className="demo-host-footer"><span>taller abierto · Sitio de demostración</span><a href="/">Conocer Luanna <ArrowRight size={14} /></a></footer>
  </div>
}

export function LodgingDemo() {
  const [applied, setApplied] = useState({ entrada: '2027-03-19', salida: '2027-03-22', nights: 3 })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const [finished, setFinished] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const detailTitle = useRef<HTMLHeadingElement>(null)
  useEffect(() => { if (finished) detailTitle.current?.focus() }, [finished])
  useEffect(() => {
    if (selected === null) return
    const previous = document.activeElement as HTMLElement | null
    const node = dialog.current
    node?.showModal()
    return () => { node?.close(); previous?.focus() }
  }, [selected])
  const hotel = selected === null ? null : stays[selected]
  return <main className="luanna-glass embedded-demo">
    <header className="embedded-header"><span className="embedded-brand"><Compass size={24} /> luanna <small>ancla</small></span><span className="subtle-badge">DEMO · DATOS FICTICIOS</span></header>
    <div className="embedded-title"><p className="eyebrow">TU TALLER, MÁS CERCA</p><h1>Un buen lugar<br />para <em>quedarte.</em></h1><p><MapPin size={15} /> Alrededor de la sede · Miraflores, Lima</p></div>
    <form className="embedded-dates liquid-glass" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); const entrada = String(data.get('entrada')); const salida = String(data.get('salida')); const nights = nochesDemo(entrada, salida); if (nights === null) { setError('Elige una salida posterior a la entrada, entre 1 y 90 noches.'); return } setError(''); setApplied({ entrada, salida, nights }); setNotice(`Ejemplos actualizados para ${nights} ${nights === 1 ? 'noche' : 'noches'}.`) }}>
      <label>Entrada<input type="date" required name="entrada" defaultValue="2027-03-19" aria-describedby={error ? 'stay-error' : undefined} /></label><label>Salida<input type="date" required name="salida" defaultValue="2027-03-22" aria-describedby={error ? 'stay-error' : undefined} /></label><button className="glass-button glass-primary" type="submit">Actualizar estancia <ArrowRight size={16} /></button>
    </form>
    {error && <p role="alert" id="stay-error">{error}</p>}<p role="status" className="embedded-status">{notice || 'Fechas sugeridas para el taller. Puedes cambiarlas.'}</p>
    <div className="embedded-results-heading"><h2>Explora dónde descansar</h2><span>{applied.nights} noches · 1 habitación · 2 adultos</span></div>
    <div className="embedded-stays">{stays.map((stay, index) => <article className="embedded-stay liquid-glass" key={stay.name}><div className={`stay-art stay-art-${stay.tone}`} aria-hidden="true"><span>0{index + 1}</span><Hotel size={50} strokeWidth={.7} /></div><div className="stay-body"><p className="eyebrow">{stay.type}</p><h3>{stay.name}</h3><p>A {stay.distance} de la sede · Ejemplo</p><div className="stay-price"><strong>{money(stay.rate)}</strong><span>/ noche</span></div><p>{money(stay.rate * applied.nights)} por {applied.nights} noches · Total ficticio</p><button className="glass-button liquid-glass" onClick={() => { setFinished(false); setSelected(index) }}>Explorar opción <ArrowRight size={15} /></button></div></article>)}</div>
    <footer className="embedded-footer"><span>Tu inscripción y el alojamiento son independientes.</span><span>Demo sin conexión a un proveedor de reservas.</span></footer>
    <dialog ref={dialog} className="stay-dialog" aria-labelledby="stay-dialog-title" onCancel={() => setSelected(null)}><button className="icon-button stay-close" aria-label="Cerrar detalle" onClick={() => setSelected(null)}><X size={20} /></button>{hotel && <><p className="eyebrow">{finished ? 'FIN DEL RECORRIDO DE EJEMPLO' : 'ALOJAMIENTO FICTICIO'}</p><h2 ref={detailTitle} tabIndex={-1} id="stay-dialog-title">{finished ? 'Aquí continuarías con el proveedor.' : hotel.name}</h2><p>{finished ? 'En una integración conectada, continuarías la búsqueda o reserva con el proveedor. Esta demo termina aquí: no hemos cobrado ni reservado nada.' : hotel.detail}</p>{!finished && <><p>{applied.entrada} → {applied.salida}</p><p><strong>{money(hotel.rate * applied.nights)}</strong> · {applied.nights} noches · Importe ilustrativo</p><button className="glass-button glass-primary" onClick={() => setFinished(true)}>Simular siguiente paso <ArrowRight size={16} /></button></>}<button className="text-action" onClick={() => setSelected(null)}><ArrowLeft size={16} /> Volver a las opciones</button></>}</dialog>
  </main>
}

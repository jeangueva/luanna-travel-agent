'use client'

import { ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, Check, Compass, Hotel, MapPin, Menu, Plane, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Brand, GlassShell } from '@/components/ui/GlassShell'
import { BlurWordReveal } from '@/components/ui/reactbits'

export default function GlassLanding() {
  const [menu, setMenu] = useState(false)
  const [example, setExample] = useState<'evento' | 'clinica'>('evento')
  const menuButton = useRef<HTMLButtonElement>(null)
  const menuContainer = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menu) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenu(false); menuButton.current?.focus() } }
    const outside = (event: PointerEvent) => { if (!menuContainer.current?.contains(event.target as Node)) setMenu(false) }
    document.addEventListener('keydown', close)
    document.addEventListener('pointerdown', outside)
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', outside) }
  }, [menu])
  return <GlassShell>
    <a className="glass-skip" href="#contenido">Saltar al contenido</a>
    <div className="landing-split">
      <section className="landing-left liquid-glass-strong">
        <header className="landing-nav">
          <Brand />
          <div ref={menuContainer} className="nav-menu-wrap">
            <button ref={menuButton} className="glass-button liquid-glass" aria-expanded={menu} aria-controls="landing-menu" onClick={() => setMenu(!menu)}>
              Menú {menu ? <X size={16} /> : <Menu size={16} />}
            </button>
            {menu && <nav id="landing-menu" aria-label="Navegación principal" className="glass-dropdown liquid-glass-strong">
              <a href="#como-funciona" onClick={() => setMenu(false)}>Cómo funciona <ArrowDown size={16} /></a>
              <a href="#para-quien" onClick={() => setMenu(false)}>Eventos y clínicas <ArrowDown size={16} /></a>
              <a href="/plataforma">Mi plataforma <ArrowUpRight size={16} /></a>
            </nav>}
          </div>
        </header>
        <main id="contenido" className="landing-message">
          <div className="hero-emblem" aria-hidden="true"><Compass size={62} strokeWidth={0.8} /></div>
          <p className="eyebrow">EL ENCUENTRO EMPIEZA AQUÍ</p>
          <h1>Un destino.<br /><em>Todo más cerca.</em></h1>
          <p className="hero-description">Vuelos y alojamiento para tu gente,<br className="desktop-break" /> desde cualquier país hasta tu evento o clínica.</p>
          <a className="glass-button glass-primary hero-cta" href="/plataforma">Crear mi portal <span className="button-orb"><ArrowUpRight size={17} /></span></a>
          <div className="hero-pills" aria-label="Para quién es Luanna"><a href="#para-quien" className="liquid-glass">Eventos</a><a href="#para-quien" className="liquid-glass">Clínicas</a><a href="#como-funciona" className="liquid-glass">Tu propia web</a></div>
        </main>
        <footer className="hero-footer"><span className="eyebrow">MENOS COORDINACIÓN. MÁS ENCUENTROS.</span><p>Tú eliges el lugar.<br /><em>Ellos encuentran cómo llegar.</em></p><a href="#como-funciona" className="text-action">Descubre cómo <ArrowDown size={15} /></a></footer>
      </section>
      <aside className="landing-right" aria-label="Conoce el producto">
        <nav className="right-nav" aria-label="Acceso rápido"><a className="glass-button liquid-glass" href="#como-funciona">Cómo funciona <ArrowDown size={15} /></a><a className="glass-button liquid-glass" href="/plataforma">Entrar <ArrowUpRight size={16} /></a></nav>
        <div className="right-intro"><span className="eyebrow">UN LUGAR. MUCHAS FORMAS DE LLEGAR.</span><p>Haz que llegar<br />se sienta <em>más fácil.</em></p></div>
        <div className="hero-product liquid-glass-strong">
          <div className="preview-heading"><span className="eyebrow">ASÍ SE VE TU PORTAL</span><span className="subtle-badge">Ejemplo</span></div>
          <div className="preview-map" aria-hidden="true"><svg viewBox="0 0 480 160" preserveAspectRatio="xMidYMid slice"><path d="M-20 115Q130 0 500 95M20 0L160 175M120 -20L260 180M300 -20L390 180M-10 45L500 150M-10 145L480 10" /><circle cx="244" cy="79" r="58" /><circle cx="244" cy="79" r="36" /></svg><span className="map-pin map-pin-main"><MapPin size={22} /></span><span className="map-pin map-pin-hotel"><Hotel size={17} /></span><span className="map-pin map-pin-plane"><Plane size={17} /></span><span className="map-label">Tu sede, en el centro.</span></div>
          <div className="product-caption"><div><h2>Cómo llegar y dónde quedarse.</h2><p>Vuelos, fechas y alojamiento. En un solo enlace.</p></div><a href="#como-funciona" className="icon-button liquid-glass" aria-label="Ver cómo funciona"><ArrowUpRight size={20} /></a></div>
        </div>
        <div className="hero-mini-grid"><a href="/plataforma" className="liquid-glass feature-link"><MapPin size={21} strokeWidth={1.25} /><span>Crea tu sede<small>El punto de partida.</small></span><ArrowUpRight size={16} /></a><a href="#como-funciona" className="liquid-glass feature-link"><ArrowUpRight size={21} strokeWidth={1.25} /><span>Comparte tu portal<small>Un enlace, listo para enviar.</small></span></a></div>
      </aside>
    </div>
    <section id="como-funciona" className="landing-section">
      <div className="section-heading"><span className="eyebrow">DE CUALQUIER PAÍS A TU SEDE</span><BlurWordReveal as="h2" text="Tres pasos. Un solo enlace." className="section-title" /><p>Una experiencia simple para ti y para quienes te visitan.</p></div>
      <ol className="steps-row">{[
        ['01', 'Ubica tu sede.', 'El lugar exacto y el aeropuerto más cercano.'],
        ['02', 'Define las fechas.', 'Cuándo llegan y cuándo se van tus visitantes.'],
        ['03', 'Comparte el enlace.', 'Ellos buscan su vuelo y su alojamiento. Tú no coordinas nada.'],
      ].map(([number, title, text]) => <li key={number}><span className="step-number">{number}</span><h3>{title}</h3><p>{text}</p></li>)}</ol>
    </section>
    <section id="para-quien" className="landing-section audience-section">
      <div><span className="eyebrow">DOS CONTEXTOS. LA MISMA CALMA.</span><h2>Cerca de lo<br /><em>que importa.</em></h2><p>Para una gran cita o un encuentro personal.<br />La estancia también forma parte de la experiencia.</p>
        <div className="glass-segments" role="group" aria-label="Ver ejemplo por tipo de sede"><button aria-pressed={example === 'evento'} onClick={() => setExample('evento')}>Eventos</button><button aria-pressed={example === 'clinica'} onClick={() => setExample('clinica')}>Clínicas</button></div>
      </div>
      <article className="audience-example liquid-glass-strong" aria-live="polite"><div className="preview-heading"><CalendarDays size={22} strokeWidth={1.25} /><span className="subtle-badge">Ejemplo ilustrativo</span></div><h3>{example === 'evento' ? 'El encuentro, sin las vueltas.' : 'Pacientes de todo el mundo.'}</h3><p>{example === 'evento' ? 'Congresos, carreras o celebraciones. Tus asistentes llegan desde otras ciudades o países y encuentran vuelo y alojamiento cerca del evento.' : 'Recibe pacientes de otros países. Ellos ven cómo volar hasta tu ciudad y dónde quedarse cerca de tu clínica, en las fechas de su tratamiento.'}</p><p className="example-note"><Check size={16} /> {example === 'evento' ? 'Se comparte después de la inscripción.' : 'Se comparte después de coordinar la cita.'}</p><a href="/plataforma" className="text-action">Preparar mi portal <ArrowRight size={17} /></a></article>
    </section>
    <footer className="landing-end"><Brand /><span>Cómo llegar y dónde quedarse.</span><a href="/plataforma" className="text-action">Mi plataforma <ArrowUpRight size={16} /></a></footer>
  </GlassShell>
}

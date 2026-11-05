'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Code2, Menu, ShoppingBag, X } from 'lucide-react'
import { Personalizador } from './Personalizador'

const VIDEO = 'https://pollen-batch-41236914.figma.site/_components/v2/f0ee2dae7671c170c34f12e31c4cb41418976c98/769c564298c132f7919405cd9f17c1b1231f341d.769c5642.mp4'

const enlaces = [
  { href: '#como-funciona', texto: 'Cómo funciona' },
  { href: '#integraciones', texto: 'Integraciones' },
  { href: '#gratis', texto: 'Precio' },
  { href: '#preguntas', texto: 'Preguntas' },
]

const pasos = [
  { n: '1', titulo: 'Crea tu sede', texto: 'Dinos dónde estás y qué aeropuerto queda cerca. Toma dos minutos.' },
  { n: '2', titulo: 'Ponle tu estilo', texto: 'Tus colores, tu letra, tus esquinas. Se ve como parte de tu marca.' },
  { n: '3', titulo: 'Compártelo', texto: 'Un enlace o un bloque en tu web. Tus clientes buscan su vuelo y su hotel ahí mismo.' },
]

const integraciones = [
  { nombre: 'Shopify', texto: 'Un bloque para tu tienda. Lo arrastras al checkout o a la página de gracias.', icono: ShoppingBag },
  { nombre: 'WordPress', texto: 'Un plugin con un atajo: pegas [luanna] donde quieras.', icono: Code2 },
  { nombre: 'Cualquier web', texto: 'Dos líneas de código. Funciona en Wix, Webflow, Squarespace o tu propio sitio.', icono: Code2 },
  { nombre: 'Un enlace', texto: 'Sin web, sin código. Lo mandas por WhatsApp o por correo.', icono: ArrowRight },
]

const preguntas = [
  { p: '¿De verdad es gratis?', r: 'Sí. No pagas nada, ni ahora ni después. Ganamos una pequeña comisión de las aerolíneas y hoteles cuando tus clientes reservan. A ellos no les cuesta más.' },
  { p: '¿Quién se encarga de las reservas?', r: 'La aerolínea o el hotel, como siempre. Luanna solo les muestra las mejores opciones para llegar a ti.' },
  { p: '¿Funciona para clientes de otros países?', r: 'Sí. Cada cliente pone su aeropuerto de salida y ve vuelos hasta tu ciudad. El portal se muestra en español o inglés según su idioma.' },
  { p: '¿Necesito saber programar?', r: 'No. Si tienes Shopify o WordPress, instalas el plugin. Si no tienes web, usas el enlace.' },
]

export default function Landing() {
  const [menu, setMenu] = useState(false)
  const [video, setVideo] = useState(false)
  const boton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    // Sin video si la persona pidió menos movimiento o ahorra datos.
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ahorro = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
    setVideo(!reducido && !ahorro)
  }, [])
  useEffect(() => {
    if (!menu) return
    const cerrar = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenu(false); boton.current?.focus() } }
    document.addEventListener('keydown', cerrar)
    return () => document.removeEventListener('keydown', cerrar)
  }, [menu])

  return <div className="ds-page">
    <a href="#contenido" className="ds-skip">Saltar al contenido</a>
    <section className="hero" aria-labelledby="hero-titulo">
      {video && <video className="hero-video" src={VIDEO} autoPlay muted loop playsInline aria-hidden="true" />}
      <div className="hero-fade" aria-hidden="true" />
      <div className="hero-inner">
        <nav className="ds-nav" aria-label="Principal">
          <a href="/" className="wordmark" aria-label="Luanna, inicio">luanna</a>
          <ul className="nav-links">{enlaces.map(e => <li key={e.href}><a href={e.href}>{e.texto}</a></li>)}</ul>
          <div className="nav-actions">
            <a href="/plataforma" className="nav-login">Entrar</a>
            <a href="/plataforma" className="btn btn-dark">Crear mi portal</a>
            <button ref={boton} className="nav-toggle" aria-expanded={menu} aria-controls="menu-movil" aria-label={menu ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setMenu(!menu)}>{menu ? <X size={22} /> : <Menu size={22} />}</button>
          </div>
        </nav>
        {menu && <div id="menu-movil" className="menu-movil">
          {enlaces.map(e => <a key={e.href} href={e.href} onClick={() => setMenu(false)}>{e.texto}</a>)}
          <a href="/plataforma" onClick={() => setMenu(false)}>Entrar</a>
        </div>}

        <div id="contenido" className="hero-body">
          <h1 id="hero-titulo">Que llegar a ti<br />sea fácil.</h1>
          <p className="hero-sub">Tus clientes encuentran su vuelo y dónde quedarse, desde cualquier país. Gratis para tu negocio.</p>
          <div className="hero-ctas">
            <a href="/plataforma" className="btn btn-dark btn-lg">Crear mi portal gratis</a>
            <a href="/plataforma/demo" className="btn btn-light btn-lg">Ver cómo funciona</a>
          </div>
        </div>
      </div>
    </section>

    <main>
      <section id="como-funciona" className="ds-section" aria-labelledby="como-titulo">
        <p className="eyebrow">Cómo funciona</p>
        <h2 id="como-titulo">Tres pasos y listo.</h2>
        <ol className="pasos">{pasos.map(p => <li key={p.n}><span className="paso-n" aria-hidden="true">{p.n}</span><h3>{p.titulo}</h3><p>{p.texto}</p></li>)}</ol>
      </section>

      <section id="gratis" className="ds-section gratis" aria-labelledby="gratis-titulo">
        <div>
          <p className="eyebrow">Precio</p>
          <h2 id="gratis-titulo">Gratis. De verdad.</h2>
          <p className="lead">No pagas suscripción ni comisión. Ganamos cuando tus clientes compran su vuelo o su hotel: las aerolíneas y hoteles nos pagan una parte. A tus clientes no les cuesta más.</p>
        </div>
        <ul className="lista-check">
          {['Sin tarjeta para empezar', 'Sin límite de sedes ni de visitas', 'Tus clientes pagan el mismo precio', 'Tú no gestionas reservas ni pagos'].map(t => <li key={t}><Check size={18} aria-hidden="true" />{t}</li>)}
        </ul>
      </section>

      <section id="estilo" className="ds-section" aria-labelledby="estilo-titulo">
        <p className="eyebrow">Tu marca, tu voz</p>
        <h2 id="estilo-titulo">Se ve como tú.</h2>
        <p className="lead">Elige color, letra y forma. Si un color no se lee bien, te avisamos y lo ajustamos.</p>
        <Personalizador />
      </section>

      <section id="integraciones" className="ds-section" aria-labelledby="integra-titulo">
        <p className="eyebrow">Integraciones</p>
        <h2 id="integra-titulo">Ponlo donde ya vendes.</h2>
        <ul className="integraciones">{integraciones.map(({ nombre, texto, icono: Icono }) => <li key={nombre}><Icono size={22} aria-hidden="true" /><h3>{nombre}</h3><p>{texto}</p></li>)}</ul>
        <a href="/integraciones" className="link-flecha">Ver guías de instalación <ArrowRight size={18} aria-hidden="true" /></a>
      </section>

      <section id="para-quien" className="ds-section" aria-labelledby="quien-titulo">
        <p className="eyebrow">Para quién</p>
        <h2 id="quien-titulo">Para cualquiera al que la gente viaja a ver.</h2>
        <ul className="quien">
          <li><h3>Clínicas y salud</h3><p>Pacientes de otros países que vienen a tratarse.</p></li>
          <li><h3>Eventos</h3><p>Congresos, carreras, bodas y festivales.</p></li>
          <li><h3>Escuelas y retiros</h3><p>Cursos, intercambios y experiencias.</p></li>
          <li><h3>Empresas</h3><p>Clientes y equipos que vienen a reunirse.</p></li>
        </ul>
      </section>

      <section id="preguntas" className="ds-section" aria-labelledby="faq-titulo">
        <p className="eyebrow">Preguntas</p>
        <h2 id="faq-titulo">Lo que todos preguntan.</h2>
        <div className="faq">{preguntas.map(q => <details key={q.p}><summary>{q.p}</summary><p>{q.r}</p></details>)}</div>
      </section>

      <section className="ds-section cierre" aria-labelledby="cierre-titulo">
        <h2 id="cierre-titulo">Empieza hoy. Es gratis.</h2>
        <div className="cierre-acciones"><a href="/plataforma" className="btn btn-dark">Crear mi portal</a><a href="/demo" className="btn btn-light">Ver una demo</a></div>
      </section>
    </main>

    <footer className="ds-footer"><span className="wordmark wordmark-sm">luanna</span><p>Vuelos y alojamiento para quien viaja a verte.</p><p><a href="/privacidad">Privacidad</a> · <a href="/terminos">Términos</a></p></footer>
  </div>
}

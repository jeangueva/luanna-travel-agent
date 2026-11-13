import { ArrowRight, ChevronDown } from 'lucide-react'

export const CONTACTO = 'hola@luanna.app'

export function Brand() {
  return <a className="care-brand" href="/" aria-label="Luanna, inicio">luanna</a>
}

/** Cabecera pública. `simple` deja solo la marca y el botón, para páginas de lectura. */
export function CareHeader({ simple = false }: { simple?: boolean }) {
  return (
    <header className="care-header">
      <a className="care-skip" href="#contenido">Saltar al contenido</a>
      <div className="care-container care-header-inner">
        <Brand />
        <nav className="care-nav" aria-label="Principal">
          {!simple && <a className="care-nav-optional" href="/#como-funciona">Cómo funciona</a>}
          <a className={simple ? undefined : 'care-nav-optional'} href="/ayuda">Ayuda</a>
          <a className="care-button" href="/plataforma">Empezar <ArrowRight size={18} aria-hidden="true" /></a>
        </nav>
      </div>
    </header>
  )
}

export function CareFooter() {
  return (
    <footer className="care-footer">
      <div className="care-container care-footer-inner">
        <span>© {new Date().getFullYear()} Luanna</span>
        <nav aria-label="Información">
          <a href="/ayuda">Ayuda</a>
          <a href="/privacidad">Privacidad</a>
          <a href="/terminos">Términos</a>
          <a href="/integraciones">Para empresas</a>
        </nav>
      </div>
    </footer>
  )
}

export const questions = [
  ['¿Qué hace Luanna por mí?', 'Lee tu reserva contigo, te la resume en palabras simples y te deja listo un mensaje para la aerolínea o el hotel. Tú lo revisas y lo envías.'],
  ['¿Me aseguran que me devuelven el dinero?', 'No. Eso lo decide la aerolínea o el hotel, según tu reserva y las normas de cada país. Lo que sí hacemos es ayudarte a pedirlo de forma clara.'],
  ['¿Cuánto cuesta?', 'Nada. No pedimos tarjeta. Si decides buscar otro alojamiento desde nuestros enlaces, el sitio de reservas puede pagarnos una comisión; a ti no te cuesta más.'],
  ['¿Qué necesito tener a mano?', 'La confirmación de tu vuelo o de tu hotel: el correo, un PDF o una captura. Antes de compartirla, tapa números de tarjeta y documentos de identidad.'],
  ['¿Qué pasa con mis datos?', `Los usamos solo para leer tu reserva y preparar tu mensaje. Puedes pedir que los borremos escribiendo a ${CONTACTO}.`],
  ['¿Se guardan mis consultas?', 'Por ahora solo mientras tienes la página abierta. Si la recargas, la lista empieza de cero. Copia tu mensaje antes de salir.'],
] as const

export function Questions({ all = false }: { all?: boolean }) {
  return (
    <div className="care-faq">
      {questions.slice(0, all ? undefined : 4).map(([q, a]) => (
        <details key={q}>
          <summary>{q}<ChevronDown size={20} aria-hidden="true" /></summary>
          <p>{a}</p>
        </details>
      ))}
    </div>
  )
}

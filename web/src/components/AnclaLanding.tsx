import { ArrowRight, Check, Hotel, Plane, ShieldCheck, X } from 'lucide-react'
import { CareFooter, CareHeader, Questions } from '@/components/care/Shell'

const pasos = [
  ['Cuéntanos qué pasó', 'Elige vuelo u hotel y pega tu confirmación, o sube el PDF o una captura.'],
  ['Revisa el resumen', 'Te mostramos los datos de tu reserva en simple, para que confirmes que están bien.'],
  ['Envía tu mensaje', 'Te dejamos un mensaje listo para la aerolínea o el hotel. Lo copias y lo envías tú.'],
]
const hacemos = ['Leemos tu reserva y te la explicamos', 'Te decimos qué pedir y a quién', 'Te dejamos el mensaje escrito']
const noHacemos = ['No cambiamos ni cancelamos tu reserva', 'No prometemos devoluciones', 'No hablamos con el proveedor por ti']

export default function AnclaLanding() {
  return (
    <div className="care">
      <CareHeader />
      <main id="contenido">
        <section className="care-container care-hero" aria-labelledby="titulo">
          <h1 id="titulo">¿Tu vuelo o tu hotel no salió como esperabas?</h1>
          <p className="care-hero-lead">Cuéntanos qué pasó. Te ayudamos a entender tu reserva y a escribirle a la aerolínea o al hotel, paso a paso.</p>
          <div className="care-choices">
            <a className="care-choice" href="/plataforma?tipo=vuelo">
              <span className="care-icon-box"><Plane size={24} aria-hidden="true" /></span>
              <div><h3>Fue con mi vuelo</h3><p>Lo cancelaron, se retrasó o no pude viajar.</p></div>
              <ArrowRight size={22} aria-hidden="true" />
            </a>
            <a className="care-choice" href="/plataforma?tipo=hotel">
              <span className="care-icon-box"><Hotel size={24} aria-hidden="true" /></span>
              <div><h3>Fue con mi hotel</h3><p>Un cobro raro, un cambio o una cancelación.</p></div>
              <ArrowRight size={22} aria-hidden="true" />
            </a>
          </div>
          <p className="care-hero-note">
            <span><ShieldCheck size={20} aria-hidden="true" /> Gratis. Tú decides cada paso.</span>
            <a className="care-text-link" href="/demo">Ver un ejemplo primero</a>
          </p>
        </section>

        <section className="care-container care-section" id="como-funciona" aria-labelledby="como">
          <div className="care-section-head"><h2 id="como">Cómo funciona</h2><p>Tres pasos. Toma unos minutos.</p></div>
          <ol className="care-steps">
            {pasos.map(([titulo, texto]) => <li key={titulo}><h3>{titulo}</h3><p>{texto}</p></li>)}
          </ol>
        </section>

        <section className="care-container care-section" aria-labelledby="limites">
          <div className="care-section-head"><h2 id="limites">Lo que hacemos y lo que no</h2><p>Preferimos decírtelo claro desde el principio.</p></div>
          <div className="care-limits">
            <div><h3>Sí hacemos</h3><ul>{hacemos.map(t => <li key={t}><Check size={20} aria-hidden="true" />{t}</li>)}</ul></div>
            <div><h3>No hacemos</h3><ul>{noHacemos.map(t => <li key={t}><X size={20} aria-hidden="true" />{t}</li>)}</ul></div>
          </div>
        </section>

        <section className="care-narrow care-section" aria-labelledby="preguntas">
          <div className="care-section-head"><h2 id="preguntas">Preguntas frecuentes</h2></div>
          <Questions />
          <a className="care-text-link" href="/ayuda">Ver todas las preguntas <ArrowRight size={18} aria-hidden="true" /></a>
        </section>

        <section className="care-container care-section care-closing" aria-labelledby="cierre">
          <h2 id="cierre">Empecemos por tu reserva</h2>
          <p>No tienes que resolverlo todo hoy.</p>
          <a className="care-button" href="/plataforma">Empezar <ArrowRight size={18} aria-hidden="true" /></a>
        </section>
      </main>
      <CareFooter />
    </div>
  )
}

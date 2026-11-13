import type { Metadata } from 'next'
import { Mail } from 'lucide-react'
import { CareFooter, CareHeader, CONTACTO, Questions } from '@/components/care/Shell'

export const metadata: Metadata = { title: 'Ayuda' }

export default function Page() {
  return (
    <div className="care">
      <CareHeader simple />
      <main id="contenido" className="care-container">
        <div className="care-reading">
          <h1>Ayuda</h1>
          <p>Qué hace Luanna, qué necesitas y qué depende de tu aerolínea o tu hotel.</p>
          <Questions all />
          <section className="care-panel care-help-panel">
            <h2>¿Tienes otra duda?</h2>
            <p>Escríbenos y te respondemos. Si tu viaje es hoy o mañana, llama primero a tu aerolínea o a tu hotel.</p>
            <a className="care-text-link" href={`mailto:${CONTACTO}`}><Mail size={18} aria-hidden="true" /> {CONTACTO}</a>
          </section>
        </div>
      </main>
      <CareFooter />
    </div>
  )
}

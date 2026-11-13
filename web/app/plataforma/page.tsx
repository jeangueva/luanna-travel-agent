import type { Metadata } from 'next'
import { ConsolaAncla } from '@/components/plataforma/ConsolaAncla'

export const metadata: Metadata = {
  title: 'Bóveda de Auditoría Post-Reserva — Hoteles y Tasas Aéreas',
  description:
    'Escáner forense con Claude y monitor de tarifas mayoristas (Stay22 / Travelpayouts) para rebajar reservas de hotel y recuperar tasas aeroportuarias de vuelos no usados.',
}

export default function PlataformaPage() {
  return (
    <div className="min-h-svh bg-ancla-canvas text-ancla-ink">
      <a
        href="#contenido-consola"
        className="fixed left-4 top-4 z-50 -translate-y-24 rounded-full bg-ancla-obsidian px-4 py-2 font-sans text-xs font-semibold text-white transition-transform focus:translate-y-0"
      >
        Saltar a la bóveda operativa
      </a>
      <main id="contenido-consola">
        <ConsolaAncla />
      </main>
    </div>
  )
}

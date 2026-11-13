import type { Metadata } from 'next'
import { ConsolaAncla } from '@/components/plataforma/ConsolaAncla'

export const metadata: Metadata = {
  title: 'Demo Interactiva · Auditor Post-Reserva',
  robots: { index: false, follow: false },
}

export default function DemoPage() {
  return (
    <div className="min-h-svh bg-ancla-canvas text-ancla-ink">
      <main id="contenido-demo">
        <ConsolaAncla />
      </main>
    </div>
  )
}

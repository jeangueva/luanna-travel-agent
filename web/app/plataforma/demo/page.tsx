import type { Metadata } from 'next'
import { ConsolaAncla } from '@/components/plataforma/ConsolaAncla'

export const metadata: Metadata = {
  title: 'Demo Bóveda de Auditoría · Luanna',
  robots: { index: false, follow: false },
}

export default function PlataformaDemoPage() {
  return (
    <div className="min-h-svh bg-ancla-canvas text-ancla-ink">
      <main id="contenido-plataforma-demo">
        <ConsolaAncla />
      </main>
    </div>
  )
}

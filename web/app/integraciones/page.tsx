import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { GuiaIntegraciones } from '@/components/landing/Integraciones'

export const metadata: Metadata = { title: 'Integraciones', description: 'Pon Luanna en Shopify, WordPress, cualquier web o compártelo con un enlace.' }

export default async function IntegracionesPage() {
  const h = await headers()
  const origen = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host') ?? 'luanna.app'}`
  return <div className="ds-page">
    <nav className="ds-nav ds-nav-simple" aria-label="Principal"><a href="/" className="wordmark" aria-label="Luanna, inicio">luanna</a><a href="/plataforma" className="btn btn-dark">Crear mi portal</a></nav>
    <main className="ds-section">
      <p className="eyebrow">Integraciones</p>
      <h1 className="titulo-pagina">Ponlo donde ya vendes.</h1>
      <p className="lead">Elige dónde lo vas a usar y sigue los pasos. Toma menos de cinco minutos.</p>
      <GuiaIntegraciones origen={origen} />
      <p className="nota-pagina">¿No encuentras tu id? Está en tu plataforma, en «Compartir». Y recuerda: es gratis. Ganamos una comisión cuando tus clientes reservan vuelo u hotel.</p>
    </main>
  </div>
}

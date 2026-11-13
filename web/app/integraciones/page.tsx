import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { GuiaIntegraciones } from '@/components/landing/Integraciones'

export const metadata: Metadata = {
  title: 'Integraciones — Correo Automático, API REST y Widget',
  description:
    'Conecta Luanna Audit mediante reenvío de confirmaciones de viaje, API REST con Claude o widget embebible.',
}

export default async function IntegracionesPage() {
  const h = await headers()
  const origen = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host') ?? 'luanna.app'}`

  return (
    <div className="min-h-svh bg-ancla-canvas text-ancla-ink">
      <header className="mx-auto max-w-[1340px] px-4 pt-6 sm:px-8">
        <nav
          aria-label="Navegación de integraciones"
          className="flex items-center justify-between rounded-full border border-ancla-lineStrong bg-ancla-paper px-5 py-3"
        >
          <a
            href="/"
            className="flex items-center gap-2 font-display text-lg font-bold tracking-[-0.03em] text-ancla-ink"
          >
            <span>luanna</span>
            <span className="rounded bg-ancla-obsidian px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white">
              INTEGRACIONES
            </span>
          </a>

          <div className="flex items-center gap-3">
            <a
              href="/"
              className="font-sans text-xs font-medium text-ancla-inkSecondary hover:text-ancla-ink"
            >
              ← Portada
            </a>
            <a
              href="/plataforma"
              className="press-scale rounded-full bg-ancla-obsidian px-4 py-2 font-sans text-xs font-medium text-white hover:bg-black"
            >
              Abrir Bóveda en Vivo
            </a>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-[1140px] px-4 py-12 sm:px-8 sm:py-16">
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ancla-signal">
          CONEXIÓN SIN FRICCIÓN
        </span>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.025em] text-ancla-ink sm:text-4xl">
          Conecta tus reservas en menos de 2 minutos.
        </h1>
        <p className="mt-3 max-w-[65ch] text-base text-ancla-inkSecondary">
          Elige cómo quieres enviar tus confirmaciones de hotel y boletos aéreos para activar el monitoreo mayorista y el rescate automático de tasas aeroportuarias.
        </p>

        <GuiaIntegraciones origen={origen} />
      </main>
    </div>
  )
}

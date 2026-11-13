import type { ReactNode } from 'react'
import { SpotlightTray } from '@/components/ui/reactbits'

/** Estructura compartida de privacidad y términos bajo el sistema visual de Luanna Audit. */
export function Legal({
  titulo,
  actualizado,
  children,
}: {
  titulo: string
  actualizado: string
  children: ReactNode
}) {
  return (
    <div className="min-h-svh bg-ancla-canvas text-ancla-ink">
      <header className="mx-auto max-w-[1140px] px-4 pt-6 sm:px-8">
        <nav
          aria-label="Principal"
          className="flex items-center justify-between rounded-full border border-ancla-lineStrong bg-ancla-paper px-5 py-3"
        >
          <a
            href="/"
            className="flex items-center gap-2 font-display text-lg font-bold tracking-[-0.03em] text-ancla-ink"
          >
            <span>luanna</span>
            <span className="rounded bg-ancla-obsidian px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white">
              LEGAL
            </span>
          </a>
          <a
            href="/plataforma"
            className="press-scale rounded-full bg-ancla-obsidian px-4 py-2 font-sans text-xs font-medium text-white hover:bg-black"
          >
            Abrir Bóveda de Auditoría
          </a>
        </nav>
      </header>

      <main className="mx-auto max-w-[920px] px-4 py-12 sm:px-8 sm:py-16">
        <SpotlightTray variant="light" coreClassName="p-6 sm:p-10">
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-ancla-inkMuted">
            Última actualización: {actualizado}
          </span>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.025em] text-ancla-ink sm:text-4xl">
            {titulo}
          </h1>
          <div className="mt-6 space-y-5 text-sm leading-relaxed text-ancla-inkSecondary [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ancla-ink [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
            {children}
          </div>
        </SpotlightTray>
      </main>

      <footer className="border-t border-ancla-line py-8">
        <div className="mx-auto flex max-w-[1140px] items-center justify-between px-4 font-mono text-xs text-ancla-inkMuted sm:px-8">
          <span>luanna / audit</span>
          <p className="space-x-3">
            <a href="/privacidad" className="hover:text-ancla-ink">
              Privacidad
            </a>
            <span>·</span>
            <a href="/terminos" className="hover:text-ancla-ink">
              Términos
            </a>
            <span>·</span>
            <a href="/integraciones" className="hover:text-ancla-ink">
              Integraciones
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}

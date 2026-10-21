'use client'

import { Brand, GlassShell } from '@/components/ui/GlassShell'

export default function PortalError({ reset }: { reset: () => void }) {
  return <GlassShell><main className="public-portal"><Brand /><section className="public-portal-card liquid-glass-strong">
    <h1>No pudimos cargar este portal.</h1>
    <p className="portal-note">Inténtalo nuevamente en unos momentos.</p>
    <button onClick={reset} className="glass-button glass-primary">Reintentar</button>
  </section></main></GlassShell>
}

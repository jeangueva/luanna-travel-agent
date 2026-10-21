import { Brand, GlassShell } from '@/components/ui/GlassShell'

export default function PortalNotFound() {
  return <GlassShell><main className="public-portal"><Brand />
    <section className="public-portal-card liquid-glass-strong"><span className="eyebrow">PORTAL NO DISPONIBLE</span><h1>Este encuentro aún no está aquí.</h1><p className="portal-note">El enlace puede haber cambiado o la organización retiró el portal. Solicita un enlace actualizado.</p><a href="/" className="glass-button glass-primary">Volver a Luanna</a></section>
  </main></GlassShell>
}

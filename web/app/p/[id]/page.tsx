import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { portalPublicado } from '@/lib/portal-store'
import { urlStay22 } from '@/lib/afiliados'
import { Brand, GlassShell } from '@/components/ui/GlassShell'
import { BuscarVuelos } from '@/components/plataforma/BuscarVuelos'
import { CalendarDays, ArrowUpRight, Hotel } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Cómo llegar y dónde quedarte', robots: { index: false, follow: false } }

export default async function PortalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const portal = await portalPublicado(id)
  if (!portal) notFound()
  const aid = process.env.NEXT_PUBLIC_STAY22_AID
  const url = aid ? urlStay22({
    aid, lat: portal.lat, lng: portal.lon, checkin: portal.checkin,
    checkout: portal.checkout, titulo: portal.titulo,
  }) : null
  const fecha = (value: string) => new Date(value + 'T12:00:00Z').toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  return <GlassShell><main className="public-portal"><Brand />
    <section className="public-portal-card liquid-glass-strong">
    <p className="eyebrow">{portal.organizacion} · {portal.ciudad}</p>
    <h1>{portal.titulo}</h1>
    <p className="portal-subtitle">{portal.aeropuerto ? 'Tu vuelo y tu estancia, en un solo lugar.' : 'Tu estancia, cerca del encuentro.'}</p>
    <div className="public-dates"><span><CalendarDays size={17} />Entrada: <time dateTime={portal.checkin}>{fecha(portal.checkin)}</time></span><span>Salida: <time dateTime={portal.checkout}>{fecha(portal.checkout)}</time></span></div>
    {portal.vertical === 'clinica' && <p className="portal-note">
      Confirma con la clínica las fechas de tu estancia y con el alojamiento los requisitos de accesibilidad. Este portal no verifica la idoneidad para recuperación médica.
    </p>}
    {portal.aeropuerto && <BuscarVuelos destino={portal.aeropuerto} ciudad={portal.ciudad} ida={portal.checkin} vuelta={portal.checkout} marker={process.env.NEXT_PUBLIC_TP_MARKER ?? ''} />}
    {portal.aeropuerto && url && <div className="form-section-heading portal-stay-heading"><Hotel size={18} /><h2>Dónde quedarte</h2></div>}
    {url ? <>
      <iframe title={`Buscar alojamiento cerca de ${portal.titulo}`} src={url}
        className="hotel-embed" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
      <a href={url} target="_blank" rel="noreferrer" className="glass-button glass-primary">Buscar en otra pestaña <ArrowUpRight size={17} /></a>
      <p className="portal-note">Las tarifas, disponibilidad, condiciones y reservas las gestiona el proveedor externo. Luanna puede recibir una comisión por las reservas de vuelos y alojamiento realizadas desde esta página.</p>
    </> : <div role="status" className="portal-unavailable"><Hotel size={32} strokeWidth={1} /><h2>Estamos preparando tu estancia.</h2><p>La búsqueda de alojamiento aún no está habilitada. Consulta a la organización para coordinar tu visita.</p></div>}
    </section><footer className="portal-footer">Cómo llegar y dónde quedarte · Luanna Ancla</footer>
  </main></GlassShell>
}

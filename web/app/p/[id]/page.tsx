import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { portalPublicado } from '@/lib/portal-store'
import { urlStay22 } from '@/lib/afiliados'
import { elegirIdioma, textosPortal } from '@/lib/portal-i18n'
import { Brand, GlassShell } from '@/components/ui/GlassShell'
import { BuscarVuelos } from '@/components/plataforma/BuscarVuelos'
import { CalendarDays, ArrowUpRight, Hotel, Languages } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Luanna Ancla', robots: { index: false, follow: false } }

export default async function PortalPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string }>
}) {
  const { id } = await params
  const { lang } = await searchParams
  const portal = await portalPublicado(id)
  if (!portal) notFound()
  const idioma = elegirIdioma(lang, (await headers()).get('accept-language'))
  const t = textosPortal[idioma]
  const aid = process.env.NEXT_PUBLIC_STAY22_AID
  const url = aid ? urlStay22({
    aid, lat: portal.lat, lng: portal.lon, checkin: portal.checkin,
    checkout: portal.checkout, titulo: portal.titulo,
  }) : null
  const fecha = (value: string) => new Date(value + 'T12:00:00Z').toLocaleDateString(idioma, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  return <GlassShell><main className="public-portal" lang={idioma}><title>{`${portal.titulo} · ${t.titulo}`}</title>
    <div className="portal-topbar"><Brand /><a href={`?lang=${idioma === 'es' ? 'en' : 'es'}`} className="glass-button liquid-glass" hrefLang={idioma === 'es' ? 'en' : 'es'}><Languages size={15} /> {t.otroIdioma}</a></div>
    <section className="public-portal-card liquid-glass-strong">
    <p className="eyebrow">{portal.organizacion} · {portal.ciudad}</p>
    <h1>{portal.titulo}</h1>
    <p className="portal-subtitle">{portal.aeropuerto ? t.subtituloVuelos : t.subtitulo}</p>
    <div className="public-dates"><span><CalendarDays size={17} />{t.entrada}: <time dateTime={portal.checkin}>{fecha(portal.checkin)}</time></span><span>{t.salida}: <time dateTime={portal.checkout}>{fecha(portal.checkout)}</time></span></div>
    {portal.vertical === 'clinica' && <p className="portal-note">{t.notaClinica}</p>}
    {portal.aeropuerto && <BuscarVuelos idioma={idioma} destino={portal.aeropuerto} ciudad={portal.ciudad} ida={portal.checkin} vuelta={portal.checkout} marker={process.env.NEXT_PUBLIC_TP_MARKER ?? ''} />}
    {portal.aeropuerto && url && <div className="form-section-heading portal-stay-heading"><Hotel size={18} /><h2>{t.dondeQuedarte}</h2></div>}
    {url ? <>
      <iframe title={t.buscarAlojamiento(portal.titulo)} src={url}
        className="hotel-embed" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
      <a href={url} target="_blank" rel="noreferrer" className="glass-button glass-primary">{t.otraPestana} <ArrowUpRight size={17} /></a>
      <p className="portal-note">{t.notaProveedor}</p>
    </> : <div role="status" className="portal-unavailable"><Hotel size={32} strokeWidth={1} /><h2>{t.preparando}</h2><p>{t.preparandoTexto}</p></div>}
    </section><footer className="portal-footer">{t.pie}</footer>
  </main></GlassShell>
}

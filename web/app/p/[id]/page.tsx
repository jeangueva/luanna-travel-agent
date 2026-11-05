import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { portalPublicado } from '@/lib/portal-store'
import { urlStay22 } from '@/lib/afiliados'
import { variablesMarca } from '@/lib/marca'
import { elegirIdioma, textosPortal } from '@/lib/portal-i18n'
import { BuscarVuelos } from '@/components/plataforma/BuscarVuelos'
import { AlturaEmbed } from '@/components/plataforma/AlturaEmbed'
import { EnlaceHoteles, MedirVista } from '@/components/plataforma/Medicion'
import { CalendarDays, ArrowUpRight, Hotel, Languages } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: { absolute: 'Luanna' }, robots: { index: false, follow: false } }

export default async function PortalPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string; embed?: string }>
}) {
  const { id } = await params
  const { lang, embed } = await searchParams
  const portal = await portalPublicado(id)
  if (!portal) notFound()
  const incrustado = embed === '1'
  const idioma = elegirIdioma(lang, (await headers()).get('accept-language'))
  const t = textosPortal[idioma]
  const aid = process.env.NEXT_PUBLIC_STAY22_AID
  const url = aid ? urlStay22({
    aid, lat: portal.lat, lng: portal.lon, checkin: portal.checkin,
    checkout: portal.checkout, titulo: portal.titulo,
  }) : null
  const fecha = (value: string) => new Date(value + 'T12:00:00Z').toLocaleDateString(idioma, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  const otro = idioma === 'es' ? 'en' : 'es'
  return <main className={`pp ${incrustado ? 'pp-embed' : ''}`} lang={idioma} style={variablesMarca(portal.marca) as CSSProperties}>
    <title>{`${portal.titulo} · ${t.titulo}`}</title>
    {incrustado && <AlturaEmbed />}
    <MedirVista portal={portal.id} idioma={idioma} incrustado={incrustado} />
    <div className="pp-wrap">
      <div className="pp-top">
        <p className="pp-eyebrow">{portal.organizacion} · {portal.ciudad}</p>
        <a href={`?lang=${otro}${incrustado ? '&embed=1' : ''}`} hrefLang={otro} className="pp-idioma"><Languages size={16} aria-hidden="true" /> {t.otroIdioma}</a>
      </div>
      <h1>{portal.titulo}</h1>
      <p className="pp-sub">{portal.aeropuerto ? t.subtituloVuelos : t.subtitulo}</p>
      <dl className="pp-fechas"><div><CalendarDays size={18} aria-hidden="true" /><dt>{t.entrada}</dt><dd><time dateTime={portal.checkin}>{fecha(portal.checkin)}</time></dd></div><div><CalendarDays size={18} aria-hidden="true" /><dt>{t.salida}</dt><dd><time dateTime={portal.checkout}>{fecha(portal.checkout)}</time></dd></div></dl>
      {portal.vertical === 'clinica' && <p className="pp-nota">{t.notaClinica}</p>}
      {portal.aeropuerto && <BuscarVuelos portal={portal.id} incrustado={incrustado} idioma={idioma} destino={portal.aeropuerto} ciudad={portal.ciudad} ida={portal.checkin} vuelta={portal.checkout} marker={process.env.NEXT_PUBLIC_TP_MARKER ?? ''} />}
      <section className="pp-bloque" aria-labelledby="estancia-title">
        <h2 id="estancia-title"><Hotel size={20} aria-hidden="true" /> {t.dondeQuedarte}</h2>
        {url ? <>
          <iframe title={t.buscarAlojamiento(portal.titulo)} src={url} className="pp-mapa" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
          <EnlaceHoteles href={url} base={{ portal: portal.id, idioma, incrustado }}>{t.otraPestana} <ArrowUpRight size={17} aria-hidden="true" /></EnlaceHoteles>
        </> : <p role="status"><strong>{t.preparando}</strong> {t.preparandoTexto}</p>}
      </section>
      <p className="pp-nota">{t.notaProveedor}</p>
      {!incrustado && <footer className="pp-pie">{t.pie}</footer>}
    </div>
  </main>
}

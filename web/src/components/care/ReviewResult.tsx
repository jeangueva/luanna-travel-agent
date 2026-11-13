'use client'
import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Check, Copy, Hotel, Info, Plane } from 'lucide-react'
import type { CasoAuditoria } from '@/lib/auditor-engine'
import { urlHotelesFallback } from '@/lib/afiliados'
import { TP_MARKER } from '@/lib/config'

export function ReviewResult({ caso, demo = false, motivo = '', onNew }: { caso: CasoAuditoria; demo?: boolean; motivo?: string; onNew?: () => void }) {
  const hotel = caso.tipo === 'hotel'
  const [nombre, setNombre] = useState(hotel ? caso.hotelNombre : caso.aerolinea)
  const [referencia, setReferencia] = useState(hotel ? caso.codigoConfirmacion : caso.pnr)
  const [confirmado, setConfirmado] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [aviso, setAviso] = useState('')
  const draftRef = useRef<HTMLTextAreaElement>(null)
  const [checkin, setCheckin] = useState(hotel ? caso.checkin : '')
  const [checkout, setCheckout] = useState(hotel ? caso.checkout : '')
  const [adultos, setAdultos] = useState('2')
  const datesValid = /^\d{4}-\d{2}-\d{2}$/.test(checkin) && /^\d{4}-\d{2}-\d{2}$/.test(checkout) && checkout > checkin
  const hotelUrl = TP_MARKER ? urlHotelesFallback({ marker: TP_MARKER, ciudad: nombre, checkin, checkout, adultos: Number(adultos) }) : `https://www.booking.com/searchresults.html?${new URLSearchParams({ ss: nombre, checkin, checkout, group_adults: adultos })}`
  useEffect(() => { if (confirmado) draftRef.current?.focus() }, [confirmado])
  function preparar() {
    setMensaje(`Hola, equipo de ${nombre}:\n\nLes escribo sobre mi reserva ${referencia || '[código de reserva]'}. ${motivo ? `Mi consulta es: ${motivo}. ` : ''}Quisiera que revisaran mi caso y me indicaran las opciones disponibles.\n\n${hotel ? 'Por favor, confirmen las condiciones de cambio y cancelación, así como el desglose de los cargos de mi reserva.' : 'Por favor, confirmen las condiciones aplicables a mi boleto y si corresponde alguna devolución. De ser así, agradecería conocer el importe, el procedimiento y el plazo estimado.'}\n\nAdjuntaré mi confirmación de reserva y los detalles de lo ocurrido.\n\nGracias por su ayuda.\n[Tu nombre]`)
    setConfirmado(true)
  }
  async function copiar() {
    try { await navigator.clipboard.writeText(mensaje); setAviso(`Copiado. Pégalo en un correo o en el chat de ${hotel ? 'tu hotel' : 'tu aerolínea'}.`) }
    catch { setAviso('No pudimos copiarlo. Selecciona el texto y cópialo a mano.') }
  }
  const fuera = <span className="sr-only"> (abre otra pestaña)</span>
  return (
    <div className="care-result">
      {!demo && <p className="care-notice">
        <Info size={20} aria-hidden="true" />
        <span>Leímos estos datos de forma automática. Compáralos con tu confirmación antes de usarlos.</span>
      </p>}

      <section className="care-panel">
        <div className="care-panel-heading">
          <span className="care-icon-box">{hotel ? <Hotel size={24} aria-hidden="true" /> : <Plane size={24} aria-hidden="true" />}</span>
          <div><span className="care-label">Paso 1 · {hotel ? 'Tu hotel' : 'Tu vuelo'}</span><h2>¿Están bien estos datos?</h2></div>
        </div>
        <div className="care-field-grid">
          <label className="care-field">{hotel ? 'Hotel' : 'Aerolínea'}<input value={nombre} onChange={e => { setNombre(e.target.value); setConfirmado(false) }} /></label>
          <label className="care-field">Código de reserva<input value={referencia} onChange={e => { setReferencia(e.target.value); setConfirmado(false) }} /></label>
        </div>
        <p className="care-helper">Si algo está mal, corrígelo aquí mismo.</p>
        <button className="care-button" disabled={!nombre.trim()} onClick={preparar}>
          {confirmado ? <><Check size={18} aria-hidden="true" /> Datos confirmados</> : 'Sí, preparar mi mensaje'}
        </button>
      </section>

      <section className="care-panel">
        <span className="care-label">Paso 2 · Tu mensaje</span>
        <h2>{hotel ? 'Escríbele a tu hotel' : 'Escríbele a tu aerolínea'}</h2>
        <p>{hotel
          ? 'Pide por escrito que te expliquen los cobros y las condiciones de cambio o cancelación.'
          : 'Pide por escrito que revisen tu caso y te digan qué opciones tienes.'}</p>
        {confirmado ? (
          <div className="care-draft">
            <label className="care-field" htmlFor="care-draft-message">Puedes editarlo antes de copiarlo
              <textarea ref={draftRef} id="care-draft-message" rows={12} value={mensaje} onChange={e => { setMensaje(e.target.value); setAviso('') }} />
            </label>
            <div className="care-actions">
              <button className="care-button" onClick={copiar}><Copy size={18} aria-hidden="true" /> Copiar mensaje</button>
              {!hotel && nombre === caso.aerolinea && <a className="care-text-link" href={caso.urlPortalDevolucionAerolinea} target="_blank" rel="noopener noreferrer">Ir a la web de la aerolínea <ArrowUpRight size={18} aria-hidden="true" />{fuera}</a>}
            </div>
            <p role="status" className="care-helper">{aviso || 'Lo envías tú. Luanna no contacta a nadie por ti.'}</p>
          </div>
        ) : <p className="care-next-hint">Confirma los datos del paso 1 y aquí aparecerá tu mensaje.</p>}
        <ul className="care-checklist">
          <li><Check size={20} aria-hidden="true" /> Adjunta tu confirmación de reserva.</li>
          <li><Check size={20} aria-hidden="true" /> Guarda el número de caso que te den.</li>
          <li><Check size={20} aria-hidden="true" /> Si no responden en unos días, vuelve a escribir citando ese número.</li>
        </ul>
      </section>

      {hotel && (
        <details className="care-panel care-disclosure">
          <summary>¿Quieres ver otros alojamientos?</summary>
          <p>Compara precio total y condiciones. No canceles tu reserva actual sin revisar antes cuánto te cobrarían.</p>
          <div className="care-field-grid">
            <label className="care-field">Entrada<input type="date" value={checkin} onChange={e => setCheckin(e.target.value)} /></label>
            <label className="care-field">Salida<input type="date" value={checkout} min={checkin} onChange={e => setCheckout(e.target.value)} /></label>
          </div>
          <label className="care-field">Adultos<select value={adultos} onChange={e => setAdultos(e.target.value)}>{['1', '2', '3', '4', '5', '6'].map(n => <option key={n}>{n}</option>)}</select></label>
          {datesValid && nombre.trim()
            ? <a className="care-text-link" href={hotelUrl} target="_blank" rel="noopener noreferrer">Buscar alojamientos <ArrowUpRight size={18} aria-hidden="true" />{fuera}</a>
            : <p className="care-helper" role="status">La salida tiene que ser después de la entrada.</p>}
          {TP_MARKER && <p className="care-helper">Si reservas desde este enlace, el sitio puede pagarnos una comisión. A ti no te cuesta más.</p>}
        </details>
      )}
      {onNew && <button className="care-text-link" onClick={onNew}>Revisar otra reserva</button>}
    </div>
  )
}

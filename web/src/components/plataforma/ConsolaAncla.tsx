'use client'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CircleHelp, FileText, Hotel, Info, Loader2, Mail, Plane, Plus, Upload, X } from 'lucide-react'
import { CASOS_AUDITORIA_DEMO, type CasoAuditoria, type TipoAuditoria } from '@/lib/auditor-engine'
import { Brand, CONTACTO, Questions } from '@/components/care/Shell'
import { ReviewResult } from '@/components/care/ReviewResult'

type View = 'nueva' | 'consultas' | 'ayuda' | 'resultado'
type Review = { caso: CasoAuditoria; motivo: string; demo: boolean }

const reasons = {
  vuelo: ['Cancelaron o cambiaron mi vuelo', 'Mi vuelo se retrasó', 'No pude viajar', 'Otra cosa'],
  hotel: ['Me cobraron algo que no entiendo', 'Necesito cambiar o cancelar', 'El precio no es el que esperaba', 'Otra cosa'],
}
const titles: Record<View, [string, string]> = {
  nueva: ['Cuéntanos qué pasó', 'Con lo que sepas es suficiente. Puedes corregir todo después.'],
  resultado: ['Esto es lo que encontramos', 'Revisa que los datos estén bien y prepara tu mensaje.'],
  consultas: ['Tus consultas', 'Se guardan solo mientras tienes esta página abierta.'],
  ayuda: ['Ayuda', 'Respuestas cortas a las dudas más comunes.'],
}
const TIPOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

export function ConsolaAncla({ demo = false }: { onVolverLanding?: () => void; demo?: boolean }) {
  const [view, setView] = useState<View>('nueva')
  const [tipo, setTipo] = useState<TipoAuditoria>('vuelo')
  const [motivo, setMotivo] = useState('')
  const [texto, setTexto] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reviews, setReviews] = useState<Review[]>([])
  const [active, setActive] = useState('')
  const upload = useRef<HTMLInputElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const mounted = useRef(false)

  // La vista y el caso viven en la URL: atrás/adelante del navegador funcionan.
  useEffect(() => {
    const restore = () => {
      const q = new URLSearchParams(window.location.search)
      const v = q.get('vista')
      setView(v === 'consultas' || v === 'ayuda' || v === 'resultado' ? v : 'nueva')
      if (q.get('tipo') === 'hotel') setTipo('hotel')
      else if (q.get('tipo') === 'vuelo') setTipo('vuelo')
      setActive(q.get('caso') || '')
    }
    restore()
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [])
  useEffect(() => {
    if (mounted.current) heading.current?.focus()
    mounted.current = true
  }, [view, active])

  function navigate(next: View, id = '') {
    const q = new URLSearchParams(window.location.search)
    q.set('vista', next)
    if (id) q.set('caso', id); else q.delete('caso')
    window.history.pushState({}, '', `${window.location.pathname}?${q}`)
    setView(next); setActive(id); setError('')
    window.scrollTo({ top: 0 })
  }
  function changeType(next: TipoAuditoria) {
    setTipo(next); setMotivo(''); setError('')
    const q = new URLSearchParams(window.location.search); q.set('tipo', next)
    window.history.replaceState({}, '', `${window.location.pathname}?${q}`)
  }
  function example() {
    const caso = CASOS_AUDITORIA_DEMO.find(c => c.tipo === tipo)!
    setReviews(prev => [{ caso, motivo: motivo || reasons[tipo][0], demo: true }, ...prev.filter(r => r.caso.id !== caso.id)])
    navigate('resultado', caso.id)
  }
  function clearFile() { setFile(null); if (upload.current) upload.current.value = '' }
  function selectFile(selected?: File) {
    setError('')
    if (!selected) return
    if (!TIPOS.includes(selected.type)) { setError('Ese archivo no nos sirve. Elige un PDF o una imagen (JPG, PNG o WebP).'); clearFile(); return }
    if (selected.size > 4.5 * 1024 * 1024) { setError('El archivo pesa demasiado. El máximo es 4,5 MB.'); clearFile(); return }
    setFile(selected)
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError('')
    if (demo) { example(); return }
    if (!texto.trim() && !file) { setError('Pega tu confirmación o sube un archivo para continuar.'); document.getElementById('booking-text')?.focus(); return }
    setBusy(true)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 45000)
    try {
      let base64: string | undefined
      if (file) base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('No pudimos abrir el archivo. Vuelve a elegirlo.'))
        reader.readAsDataURL(file)
      })
      const response = await fetch('/api/auditar', {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ texto: texto.trim(), archivoBase64: base64, archivoMime: file?.type, archivoNombre: file?.name }),
      })
      const data = await response.json() as { caso?: CasoAuditoria; motor?: string }
      if (!response.ok) throw new Error('Algo falló de nuestro lado. Lo que escribiste sigue aquí: vuelve a intentarlo.')
      if (!data.caso || !data.motor?.startsWith('claude-')) throw new Error('No logramos leer bien tu reserva. Prueba pegando el texto completo de la confirmación.')
      if (data.caso.tipo !== tipo) throw new Error(`Esto parece una reserva de ${data.caso.tipo}. Cambia la opción de arriba y vuelve a intentarlo.`)
      setReviews(prev => [{ caso: data.caso!, motivo, demo: false }, ...prev])
      navigate('resultado', data.caso.id)
      setTexto(''); clearFile()
    } catch (e) {
      setError(e instanceof Error && e.name !== 'AbortError' ? e.message : 'Está tardando más de lo normal. Lo que escribiste sigue aquí: vuelve a intentarlo.')
    } finally { window.clearTimeout(timeout); setBusy(false) }
  }

  const current = reviews.find(r => r.caso.id === active)
  const [title, subtitle] = titles[view]
  const tab = view === 'resultado' ? 'consultas' : view
  const nav = [
    { id: 'nueva', label: 'Nueva', icon: Plus },
    { id: 'consultas', label: 'Mis consultas', icon: FileText },
    { id: 'ayuda', label: 'Ayuda', icon: CircleHelp },
  ] as const

  return (
    <div className="care">
      <header className="care-header">
        <a className="care-skip" href="#contenido">Saltar al contenido</a>
        <div className="care-container care-header-inner">
          <Brand />
          <nav className="care-nav care-tabs" aria-label="Tu espacio">
            {nav.map(item => (
              <button key={item.id} aria-current={tab === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}>
                <item.icon size={20} aria-hidden="true" />
                <span>{item.label}</span>
                {item.id === 'consultas' && reviews.length > 0 && <span className="care-count" aria-label={`${reviews.length} guardadas`}>{reviews.length}</span>}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="care-narrow care-workspace" id="contenido">
        {demo && <p className="care-notice" style={{ marginBottom: 'var(--care-6)' }}><Info size={20} aria-hidden="true" /><span>Esto es un ejemplo con datos inventados. <a href="/plataforma">Usar mi reserva</a></span></p>}
        {view === 'resultado' && <button className="care-text-link care-back" onClick={() => navigate('consultas')}><ArrowLeft size={18} aria-hidden="true" /> Mis consultas</button>}
        <div className="care-workspace-heading">
          <h1 ref={heading} tabIndex={-1}>{title}</h1>
          <p>{subtitle}</p>
        </div>

        {view === 'nueva' && <>
          <form className="care-panel care-form" onSubmit={submit} noValidate>
            <fieldset disabled={busy}>
              <legend>1. ¿Con qué fue el problema?</legend>
              <div className="care-type-picker">
                <button type="button" aria-pressed={tipo === 'vuelo'} onClick={() => changeType('vuelo')}><Plane size={22} aria-hidden="true" /> Mi vuelo</button>
                <button type="button" aria-pressed={tipo === 'hotel'} onClick={() => changeType('hotel')}><Hotel size={22} aria-hidden="true" /> Mi hotel</button>
              </div>
            </fieldset>

            <fieldset disabled={busy}>
              <legend>2. ¿Qué pasó? <span className="care-optional">Opcional</span></legend>
              <div className="care-chips">
                {reasons[tipo].map(r => <label key={r}><input type="radio" name="motivo" checked={motivo === r} onChange={() => setMotivo(r)} />{r}</label>)}
              </div>
            </fieldset>

            <fieldset disabled={busy}>
              <legend>3. Tu reserva</legend>
              {demo ? <p className="care-muted">En el ejemplo usamos una reserva inventada. No tienes que subir nada.</p> : <>
                <label className="sr-only" htmlFor="booking-text">Texto de tu confirmación</label>
                <textarea id="booking-text" className="care-textarea" rows={6} maxLength={12000} value={texto} onChange={e => setTexto(e.target.value)}
                  aria-describedby="booking-hint" aria-invalid={Boolean(error) && !texto.trim() && !file}
                  placeholder={tipo === 'vuelo' ? 'Pega aquí el correo de confirmación de tu vuelo' : 'Pega aquí el correo de confirmación de tu hotel'} />
                <div className="care-upload">
                  <input ref={upload} type="file" id="booking-file" className="care-file-native" accept={TIPOS.join(',')} onChange={e => selectFile(e.target.files?.[0])} />
                  <label htmlFor="booking-file">
                    <Upload size={20} aria-hidden="true" />
                    <span><strong>{file ? file.name : 'O sube un PDF o una captura'}</strong><small>{file ? `${Math.ceil(file.size / 1024)} KB` : 'Hasta 4,5 MB'}</small></span>
                  </label>
                  {file && <button type="button" className="care-icon-button" aria-label="Quitar archivo" onClick={clearFile}><X size={20} aria-hidden="true" /></button>}
                </div>
                <p id="booking-hint" className="care-helper">Antes de compartir, tapa números de tarjeta y documentos de identidad.</p>
              </>}
              {error && <p className="care-error" role="alert">{error}</p>}
            </fieldset>

            <div className="care-form-end">
              <button type="submit" className="care-button" disabled={busy}>
                {busy ? <><Loader2 size={18} className="care-spin" aria-hidden="true" /> Leyendo tu reserva…</> : <>{demo ? 'Ver el ejemplo' : 'Revisar mi reserva'} <ArrowRight size={18} aria-hidden="true" /></>}
              </button>
              <p className="care-helper" role="status">{busy ? 'Puede tardar unos segundos. No cierres la página.' : demo ? 'Puedes probar con vuelo y con hotel.' : <>Al continuar aceptas nuestra <a href="/privacidad">política de privacidad</a>.</>}</p>
            </div>
          </form>
          {!demo && <p className="care-below"><a className="care-text-link" href="/demo">¿Prefieres ver un ejemplo primero?</a></p>}
        </>}

        {view === 'resultado' && (current
          ? <ReviewResult key={current.caso.id} caso={current.caso} demo={current.demo} motivo={current.motivo} onNew={() => navigate('nueva')} />
          : <div className="care-panel care-empty"><FileText size={32} aria-hidden="true" /><h2>Esta consulta ya no está</h2><p>Las consultas se borran al recargar la página. Puedes empezar otra cuando quieras.</p><button className="care-button" onClick={() => navigate('nueva')}>Nueva consulta</button></div>)}

        {view === 'consultas' && (reviews.length
          ? <div className="care-case-list">{reviews.map(r => (
              <button key={r.caso.id} onClick={() => navigate('resultado', r.caso.id)}>
                <span className="care-icon-box">{r.caso.tipo === 'hotel' ? <Hotel size={24} aria-hidden="true" /> : <Plane size={24} aria-hidden="true" />}</span>
                <span><strong>{r.caso.tipo === 'hotel' ? r.caso.hotelNombre : r.caso.aerolinea}</strong><small>{r.demo ? 'Ejemplo' : r.motivo || (r.caso.tipo === 'hotel' ? 'Hotel' : 'Vuelo')}</small></span>
                <ArrowRight size={20} aria-hidden="true" />
              </button>))}
            </div>
          : <div className="care-panel care-empty"><FileText size={32} aria-hidden="true" /><h2>Aún no tienes consultas</h2><p>Cuando revises una reserva, la verás aquí.</p><button className="care-button" onClick={() => navigate('nueva')}>Revisar una reserva</button></div>)}

        {view === 'ayuda' && <>
          <Questions all />
          <div className="care-panel care-help-panel">
            <h2>¿Tienes otra duda?</h2>
            <p>Escríbenos y te respondemos. Si tu viaje es hoy o mañana, llama primero a tu aerolínea o a tu hotel.</p>
            <a className="care-text-link" href={`mailto:${CONTACTO}`}><Mail size={18} aria-hidden="true" /> {CONTACTO}</a>
          </div>
        </>}
      </main>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Plane, ArrowLeft, ArrowUpRight, CalendarDays, Check, ChevronDown, CircleHelp, Code2, Copy, ExternalLink, Eye, FileText, Link2, Loader2, LogOut, MapPin, Plus, RefreshCw, Search, Settings2, X } from 'lucide-react'
import { validarPortal, type Portal } from '@/lib/portales'
import { Brand, GlassShell } from '@/components/ui/GlassShell'
import { ConfirmLeave } from '@/components/ui/ConfirmLeave'
import { GuidedTour, TOUR_KEY } from './GuidedTour'

type Borrador = Omit<Portal, 'id'> & { id?: string }
const vacio: Borrador = { organizacion: '', titulo: '', vertical: 'servicio', ciudad: '', lat: NaN, lon: NaN, aeropuerto: '', checkin: '', checkout: '', publicado: false }
const ejemplo: Portal = { id: 'ca70c75e-2cf6-4d98-bbf9-1f5e2e871790', organizacion: 'Encuentros del Pacífico', titulo: 'Encuentro en Lima', vertical: 'evento', ciudad: 'Lima', lat: -12.1211, lon: -77.0305, aeropuerto: 'LIM', checkin: '2027-03-18', checkout: '2027-03-21', publicado: false }

export function PortalAdmin({ demo = false }: { demo?: boolean }) {
  const [portales, setPortales] = useState<Portal[]>([])
  const [form, setForm] = useState<Borrador>(vacio)
  const [saved, setSaved] = useState<Portal | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [stay22, setStay22] = useState(false)
  const [origin, setOrigin] = useState('')
  const [dirty, setDirty] = useState(false)
  const dirtyRef = useRef(false)
  const [query, setQuery] = useState('')
  const [tour, setTour] = useState(false)
  const [pending, setPending] = useState<(() => void) | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const help = useRef<HTMLButtonElement>(null)

  async function cargar() {
    setLoading(true)
    setError('')
    try {
      if (demo) {
        setPortales(prev => prev.length ? prev : [ejemplo])
        setLoaded(true)
        return
      }
      const response = await fetch('/api/plataforma/portales', { cache: 'no-store' })
      if (response.status === 401) { setSessionExpired(true); throw new Error('Tu sesión terminó. Vuelve a entrar para guardar; tus cambios siguen aquí.') }
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setPortales(data.portales)
      setStay22(data.stay22)
      setLoaded(true)
    } catch (error) { setError(error instanceof Error ? error.message : 'No pudimos cargar tus sedes. Vuelve a intentar.') }
    finally { setLoading(false) }
  }
  useEffect(() => { setOrigin(window.location.origin); void cargar() }, [])
  useEffect(() => {
    if (loading) return
    try { if (!localStorage.getItem(TOUR_KEY + (demo ? '-demo' : ''))) setTour(true) } catch { setTour(true) }
  }, [loading, demo])
  useEffect(() => {
    function advertir(event: BeforeUnloadEvent) { if (dirtyRef.current) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', advertir)
    return () => window.removeEventListener('beforeunload', advertir)
  }, [])
  function markDirty(value: boolean) { dirtyRef.current = value; setDirty(value) }
  function editar(key: keyof Borrador, value: string | number | boolean) {
    setForm(prev => ({ ...prev, [key]: value }))
    markDirty(true)
    setMensaje('')
  }
  function withDiscard(action: () => void) { if (dirtyRef.current) setPending(() => action); else action() }
  function seleccionar(portal?: Portal) {
    withDiscard(() => { setForm(portal ?? vacio); setSaved(portal ?? null); markDirty(false); setError(''); setMensaje('') })
  }
  async function guardar(event: FormEvent) {
    event.preventDefault()
    setError(''); setMensaje(''); setBusy(true)
    try {
      const config = validarPortal(form)
      let portal: Portal
      if (demo) portal = { ...config, id: form.id ?? crypto.randomUUID() }
      else {
        const response = await fetch('/api/plataforma/portales', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...config, ...(form.id ? { id: form.id } : {}) }),
        })
        const data = await response.json()
        if (response.status === 401) setSessionExpired(true)
        if (!response.ok) throw new Error(data.error)
        portal = data.portal as Portal
      }
      setPortales(prev => [portal, ...prev.filter(item => item.id !== portal.id)])
      setForm(portal); setSaved(portal); markDirty(false)
      setMensaje(demo ? 'Vista de prueba actualizada. No se han guardado datos en el servidor.' : portal.publicado ? 'Portal publicado. Ya puedes compartir tu enlace.' : 'Borrador guardado. Solo tú puedes verlo.')
    } catch (error) { setError(error instanceof Error ? error.message : 'No pudimos guardar. Tus cambios siguen aquí.') }
    finally { setBusy(false) }
  }
  async function copiar(value: string) {
    try { await navigator.clipboard.writeText(value); setMensaje('Copiado. Listo para compartir.'); setError('') }
    catch { setError('No se pudo copiar. Selecciona el enlace o código y cópialo manualmente.') }
  }
  async function cerrarSesion() {
    if (demo) { markDirty(false); window.location.assign('/'); return }
    setBusy(true)
    try {
      const response = await fetch('/api/plataforma/sesion', { method: 'DELETE' })
      if (!response.ok) throw new Error()
      markDirty(false); window.location.reload()
    } catch { setError('No se pudo cerrar la sesión. Vuelve a intentar.'); setBusy(false) }
  }
  function closeTour() {
    try { localStorage.setItem(TOUR_KEY + (demo ? '-demo' : ''), 'done') } catch { /* Storage optional. */ }
    setTour(false)
    help.current?.focus({ preventScroll: true })
  }
  const link = saved?.publicado && !demo ? origin + '/p/' + saved.id : ''
  const iframe = link ? '<iframe src="' + link + '" title="Cómo llegar y dónde quedarse" width="100%" height="760" loading="lazy" style="border:0"></iframe>' : ''
  const visibles = portales.filter(item => (item.titulo + ' ' + item.ciudad + ' ' + item.organizacion).toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')))
  const nights = form.checkin && form.checkout ? (Date.parse(form.checkout) - Date.parse(form.checkin)) / 86400000 : 0
  const fechas = (value: string) => value ? new Date(value + 'T12:00:00Z').toLocaleDateString('es', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : 'Sin fecha'

  return <GlassShell workspace>
    <a className="glass-skip" href="#contenido-consola">Saltar al editor</a>
    <div className="workspace-frame">
      <header className="workspace-header">
        <Brand /><span className="workspace-divider" aria-hidden="true" /><span className="workspace-label">Tu espacio de trabajo</span>
        <div className="workspace-header-actions"><button ref={help} className="glass-button liquid-glass" onClick={() => setTour(true)}><CircleHelp size={17} /> Ayuda</button><button disabled={busy} className="icon-button liquid-glass" onClick={() => withDiscard(() => void cerrarSesion())} aria-label={demo ? 'Salir de la demo' : 'Cerrar sesión'}><LogOut size={17} /></button></div>
      </header>
      {demo && <div className="demo-notice"><Eye size={16} /><span>Estás explorando una demo. Los cambios duran solo esta visita.</span><a href="/plataforma" onClick={event => { if (dirty) { event.preventDefault(); withDiscard(() => { markDirty(false); window.location.assign('/plataforma') }) } }}>Entrar a mi cuenta <ArrowUpRight size={14} /></a></div>}
      <div className="workspace-grid">
        <aside className="workspace-sidebar liquid-glass" id="tour-sedes">
          <div className="sidebar-heading"><span className="eyebrow">TUS SEDES</span><span className="subtle-badge">{portales.length}</span></div>
          <button disabled={busy} onClick={() => seleccionar()} className="glass-button glass-primary new-venue"><Plus size={17} /> Nueva sede</button>
          <label className="search-field"><Search size={15} aria-hidden="true" /><span className="sr-only">Buscar sedes</span><input type="search" placeholder="Buscar una sede…" value={query} onChange={e => setQuery(e.target.value)} /></label>
          <div className="sidebar-list" aria-busy={loading}>
            {loading ? <p className="loading-message" role="status"><Loader2 size={16} className="loading-spin" /> Cargando sedes…</p> :
              <ul>{visibles.map(portal => <li key={portal.id}><button disabled={busy} aria-pressed={form.id === portal.id} onClick={() => seleccionar(portal)} className="venue-item"><span className="venue-item-icon"><MapPin size={17} /></span><span><strong>{portal.titulo}</strong><small>{portal.ciudad} · {portal.publicado ? 'Publicado' : 'Borrador'}</small></span></button></li>)}</ul>}
            {!loading && !visibles.length && <div className="empty-sidebar"><MapPin size={26} strokeWidth={1} /><p>{query ? 'No encontramos esa sede.' : loaded ? 'Aquí comienza tu primer encuentro.' : 'Tus sedes no están disponibles.'}</p><small>{query ? 'Prueba con otra ciudad o nombre.' : loaded ? 'Crea una sede y prepara su portal.' : 'Actualiza la lista para intentar de nuevo.'}</small>{query && <button className="text-action" onClick={() => setQuery('')}>Limpiar búsqueda</button>}</div>}
          </div>
          <div className="sidebar-bottom"><button disabled={loading || busy} onClick={cargar} className="text-action"><RefreshCw size={14} /> Actualizar sedes</button><a href="/" className="text-action" onClick={e => { if (dirty) { e.preventDefault(); withDiscard(() => { markDirty(false); window.location.assign('/') }) } }}><ArrowLeft size={14} /> Volver al inicio</a></div>
        </aside>
        <main id="contenido-consola" className="workspace-main">
          <div className="editor-header"><div><p className="eyebrow">DE UN LUGAR A UN ENCUENTRO</p><h1>{form.id ? 'Tu sede, al detalle.' : 'Todo empieza aquí.'}</h1><p>{form.id ? 'Ajusta tu portal y guarda los cambios.' : 'Crea un lugar al que sea fácil llegar.'}</p></div><span className="status-pill"><span aria-hidden="true" />{saved?.publicado ? 'Publicado' : 'Borrador'}</span></div>
          <div className="editor-columns">
            <form onSubmit={guardar} className="venue-form liquid-glass-strong" id="venue-form">
              <fieldset disabled={busy}>
                <legend className="sr-only">Datos de la sede</legend>
                <section id="tour-datos" className="form-section">
                  <div className="form-section-heading"><span className="section-index">01</span><h2>El lugar del encuentro</h2></div>
                  <div className="form-grid">
                    <label className="full-width">Nombre de la sede<input required maxLength={160} placeholder="Ej. Congreso de diseño, Lima" value={form.titulo} onChange={e => editar('titulo', e.target.value)} /></label>
                    <label>Organización<input required maxLength={120} placeholder="Nombre de tu organización" value={form.organizacion} onChange={e => editar('organizacion', e.target.value)} /></label>
                    <label>Tipo de sede<span className="select-wrap"><select value={form.vertical} onChange={e => editar('vertical', e.target.value)}><option value="servicio">Empresa o servicio</option><option value="evento">Evento</option><option value="clinica">Clínica o salud</option></select><ChevronDown size={15} aria-hidden="true" /></span></label>
                    <label className="full-width">Ciudad<input required maxLength={100} placeholder="Ej. Lima, Perú" value={form.ciudad} onChange={e => editar('ciudad', e.target.value)} /></label>
                    <label>Latitud<input required type="number" min={-90} max={90} step="any" placeholder="-12.1211" value={Number.isNaN(form.lat) ? '' : form.lat} onChange={e => editar('lat', e.target.valueAsNumber)} aria-describedby="coords-help" /></label>
                    <label>Longitud<input required type="number" min={-180} max={180} step="any" placeholder="-77.0305" value={Number.isNaN(form.lon) ? '' : form.lon} onChange={e => editar('lon', e.target.valueAsNumber)} aria-describedby="coords-help" /></label>
                  </div>
                  <p className="field-hint" id="coords-help"><MapPin size={14} /> Copia las coordenadas de la sede desde tu mapa habitual.</p>
                  <div className="form-grid"><label className="full-width">Aeropuerto de llegada <small>(opcional)</small><input maxLength={3} placeholder="Ej. LIM" autoCapitalize="characters" autoComplete="off" value={form.aeropuerto} onChange={e => editar('aeropuerto', e.target.value.toUpperCase())} aria-describedby="airport-help" /></label></div>
                  <p className="field-hint" id="airport-help"><Plane size={14} /> El código de 3 letras del aeropuerto más cercano. Con él, tus visitantes pueden buscar vuelos desde su país.</p>
                </section>
                <section id="tour-fechas" className="form-section">
                  <div className="form-section-heading"><span className="section-index">02</span><h2>La estancia sugerida</h2></div>
                  <div className="form-grid"><label>Entrada<input required type="date" value={form.checkin} onChange={e => editar('checkin', e.target.value)} /></label><label>Salida<input required type="date" min={form.checkin || undefined} value={form.checkout} onChange={e => editar('checkout', e.target.value)} /></label></div>
                  <p className="field-hint"><CalendarDays size={14} /> {nights > 0 && nights <= 90 ? nights + (nights === 1 ? ' noche sugerida.' : ' noches sugeridas.') : 'Elige una estancia de entre 1 y 90 noches.'}</p>
                </section>
                <section id="tour-publicar" className="form-section publish-section">
                  <div className="form-section-heading"><span className="section-index">03</span><h2>Listo para compartir</h2></div>
                  <label className="publish-toggle"><span><strong>Portal público</strong><small>{form.publicado ? 'Visible para quienes tengan el enlace.' : 'Guárdalo como borrador hasta que esté listo.'}</small></span><input type="checkbox" role="switch" checked={form.publicado} onChange={e => editar('publicado', e.target.checked)} /><span className="switch-track" aria-hidden="true" /></label>
                  <p className="field-hint">Solo información de la sede. No incluyas datos de pacientes.</p>
                </section>
                <div className="form-save-bar"><span>{dirty ? 'Cambios sin guardar' : saved ? 'Todo guardado' : 'Tu próximo encuentro'}</span><button className="glass-button glass-primary" disabled={busy}>{busy ? <><Loader2 className="loading-spin" size={16} /> Guardando…</> : <><Check size={16} /> Guardar sede</>}</button></div>
              </fieldset>
            </form>
            <aside className="editor-preview">
              <section className="portal-preview liquid-glass" aria-labelledby="preview-title"><div className="preview-heading"><span className="eyebrow"><Eye size={14} /> VISTA PREVIA</span><span className="subtle-badge">Sin publicar cambios</span></div>
                <div className="preview-map" aria-hidden="true"><svg viewBox="0 0 400 130"><path d="M-20 110L400 10M0 10L420 100M70 -10L180 140M230 -10L330 140" /><circle cx="200" cy="65" r="46" /><circle cx="200" cy="65" r="25" /></svg><span className="map-pin map-pin-main"><MapPin size={23} /></span></div>
                <div className="portal-preview-content"><span className="eyebrow">{({ servicio: 'EMPRESA', evento: 'EVENTO', clinica: 'SALUD' } as const)[form.vertical]}{form.ciudad ? ' · ' + form.ciudad : ''}</span><h2 id="preview-title">{form.titulo || 'El nombre de tu sede'}</h2><p>{form.organizacion || 'Tu organización'}</p><div className="preview-dates"><CalendarDays size={16} /><span>{fechas(form.checkin)}<ArrowRightTiny />{fechas(form.checkout)}</span></div><p className="preview-caption">{form.aeropuerto ? 'Vuelos a ' + form.aeropuerto + ' y alojamiento alrededor de tu sede.' : 'Alojamiento alrededor de tu sede.'}</p></div>
              </section>
              <section id="tour-compartir" className="share-panel liquid-glass"><div className="form-section-heading"><Link2 size={18} /><h2>Tu enlace, listo para viajar.</h2></div>
                {link ? <><label className="field-hint" htmlFor="share-url">Versión guardada y publicada</label><input id="share-url" readOnly value={link} onFocus={e => e.target.select()} /><div className="share-actions"><button className="glass-button glass-primary" onClick={() => copiar(link)}><Copy size={15} /> Copiar enlace</button><a href={link} className="icon-button liquid-glass" target="_blank" rel="noreferrer" aria-label="Abrir portal publicado en otra pestaña"><ExternalLink size={17} /></a></div><details><summary><Code2 size={15} /> Insertar en mi web <ChevronDown size={14} /></summary><pre><code>{iframe}</code></pre><button className="text-action" onClick={() => copiar(iframe)}><Copy size={14} /> Copiar código</button></details></> : <><p>{demo ? 'En esta demo puedes explorar el flujo. Los enlaces públicos se crean desde tu cuenta.' : 'Activa “Portal público” y guarda la sede. Aquí aparecerá el enlace para compartir.'}</p><span className="share-placeholder"><Link2 size={14} /> {demo ? 'Vista de prueba' : 'Tu enlace aparecerá aquí'}</span></>}
              </section>
              <details className="integration-details"><summary><Settings2 size={15} /> Qué ven tus visitantes <ChevronDown size={14} /></summary><p><strong>Vuelos:</strong> {form.aeropuerto ? 'buscan desde su ciudad hasta ' + form.aeropuerto + ', con tus fechas.' : 'añade el aeropuerto de llegada para activarlos.'}</p><p><strong>Alojamiento:</strong> {stay22 || demo ? 'mapa de hoteles alrededor de tu sede.' : 'se activará cuando se conecte Stay22.'}</p><p>Las reservas se hacen con cada proveedor. Seguros y pagos aún no están disponibles.</p></details>
            </aside>
          </div>
          <div className="editor-feedback" aria-live="polite">
            {error && <div className="feedback-message" role="alert"><CircleHelp size={18} /><span>{error}{sessionExpired && <a href="/plataforma" target="_blank" rel="noreferrer">Volver a entrar en otra pestaña <ArrowUpRight size={14} /></a>}</span><button className="icon-button" onClick={() => setError('')} aria-label="Cerrar aviso"><X size={16} /></button></div>}
            {mensaje && <div className="feedback-message"><Check size={18} /><span>{mensaje}</span><button className="icon-button" onClick={() => setMensaje('')} aria-label="Cerrar confirmación"><X size={16} /></button></div>}
          </div>
          <footer className="workspace-footer"><FileText size={13} /><span>Tu contenido público está bajo tu control.</span></footer>
        </main>
      </div>
    </div>
    <GuidedTour open={tour} onClose={closeTour} />
    <ConfirmLeave open={Boolean(pending)} onCancel={() => setPending(null)} onConfirm={() => { const action = pending; setPending(null); action?.() }} />
  </GlassShell>
}
function ArrowRightTiny() { return <span aria-hidden="true"> → </span> }

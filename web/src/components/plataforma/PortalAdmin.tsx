'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { BarChart3, Plane, ArrowUpRight, CalendarDays, Check, ChevronDown, CircleHelp, Copy, ExternalLink, Eye, Info, Link2, Loader2, LogOut, MapPin, Plus, RefreshCw, Search, X } from 'lucide-react'
import { validarPortal, type Portal } from '@/lib/portales'
import { ConfirmLeave } from '@/components/ui/ConfirmLeave'
import { GuidedTour, TOUR_KEY } from './GuidedTour'
import { GuiaIntegraciones } from '@/components/landing/Integraciones'
import { ControlesMarca, VistaMarca } from '@/components/landing/Personalizador'
import { MARCA_BASE, type Marca } from '@/lib/marca'
import type { Resumen } from '@/lib/medicion'

type Borrador = Omit<Portal, 'id'> & { id?: string }
const vacio: Borrador = { organizacion: '', titulo: '', vertical: 'servicio', ciudad: '', lat: NaN, lon: NaN, aeropuerto: '', checkin: '', checkout: '', publicado: false, marca: MARCA_BASE }
const ejemplo: Portal = { id: 'ca70c75e-2cf6-4d98-bbf9-1f5e2e871790', organizacion: 'Encuentros del Pacífico', titulo: 'Encuentro en Lima', vertical: 'evento', ciudad: 'Lima', lat: -12.1211, lon: -77.0305, aeropuerto: 'LIM', checkin: '2027-03-18', checkout: '2027-03-21', publicado: false, marca: MARCA_BASE }

export function PortalAdmin({ demo = false }: { demo?: boolean }) {
  const [portales, setPortales] = useState<Portal[]>([])
  const [form, setForm] = useState<Borrador>(vacio)
  const [saved, setSaved] = useState<Portal | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [stay22, setStay22] = useState(false)
  const [resumen, setResumen] = useState<Record<string, Resumen>>({})
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
        setResumen({ [ejemplo.id]: { vistas: 248, vuelos: 61, hoteles: 37 } })
        setLoaded(true)
        return
      }
      const response = await fetch('/api/plataforma/portales', { cache: 'no-store' })
      if (response.status === 401) { setSessionExpired(true); throw new Error('Tu sesión terminó. Vuelve a entrar para guardar; tus cambios siguen aquí.') }
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setPortales(data.portales)
      setStay22(data.stay22)
      setResumen(data.resumen ?? {})
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
  function editar(key: keyof Borrador, value: string | number | boolean | Marca) {
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
  const visibles = portales.filter(item => (item.titulo + ' ' + item.ciudad + ' ' + item.organizacion).toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')))
  const nights = form.checkin && form.checkout ? (Date.parse(form.checkout) - Date.parse(form.checkin)) / 86400000 : 0

  return <div className="ap">
    <a className="ds-skip" href="#contenido-consola">Saltar al editor</a>
    <header className="ap-header">
      <a href="/" className="wordmark wordmark-sm" aria-label="Luanna, inicio" onClick={e => { if (dirty) { e.preventDefault(); withDiscard(() => { markDirty(false); window.location.assign('/') }) } }}>luanna</a>
      <div className="ap-header-acciones">
        <button ref={help} className="btn btn-light" onClick={() => setTour(true)}><CircleHelp size={17} aria-hidden="true" /> Ayuda</button>
        <button disabled={busy} className="ap-icono" onClick={() => withDiscard(() => void cerrarSesion())} aria-label={demo ? 'Salir de la demo' : 'Cerrar sesión'}><LogOut size={18} /></button>
      </div>
    </header>
    {demo && <div className="ap-demo" role="note"><Eye size={16} aria-hidden="true" /><span>Es una demo: lo que cambies se borra al salir.</span><a href="/plataforma" onClick={event => { if (dirty) { event.preventDefault(); withDiscard(() => { markDirty(false); window.location.assign('/plataforma') }) } }}>Entrar a mi cuenta <ArrowUpRight size={14} aria-hidden="true" /></a></div>}
    <div className="ap-grid">
      <aside className="ap-sedes" id="tour-sedes" aria-label="Tus sedes">
        <div className="ap-sedes-cabecera"><h2>Tus sedes <span className="ap-cuenta">{portales.length}</span></h2></div>
        <button disabled={busy} onClick={() => seleccionar()} className="btn btn-dark ap-nueva"><Plus size={17} aria-hidden="true" /> Nueva sede</button>
        <label className="ap-buscar"><Search size={16} aria-hidden="true" /><span className="sr-only">Buscar sedes</span><input type="search" placeholder="Buscar…" value={query} onChange={e => setQuery(e.target.value)} /></label>
        <div aria-busy={loading}>
          {loading ? <p className="ap-cargando" role="status"><Loader2 size={16} className="loading-spin" aria-hidden="true" /> Cargando…</p> :
            <ul className="ap-lista">{visibles.map(portal => <li key={portal.id}><button disabled={busy} aria-pressed={form.id === portal.id} onClick={() => seleccionar(portal)}><MapPin size={17} aria-hidden="true" /><span><strong>{portal.titulo}</strong><small>{portal.ciudad} · {portal.publicado ? 'Publicada' : 'Borrador'}{resumen[portal.id] ? ` · ${resumen[portal.id].vistas} visitas` : ''}</small></span></button></li>)}</ul>}
          {!loading && !visibles.length && <div className="ap-vacio"><p>{query ? 'No hay sedes con ese nombre.' : loaded ? 'Aún no tienes sedes.' : 'No pudimos cargar tus sedes.'}</p><small>{query ? 'Prueba con otra palabra.' : loaded ? 'Crea la primera con «Nueva sede».' : 'Toca «Actualizar» para reintentar.'}</small>{query && <button className="ap-texto" onClick={() => setQuery('')}>Limpiar búsqueda</button>}</div>}
        </div>
        <button disabled={loading || busy} onClick={cargar} className="ap-texto ap-actualizar"><RefreshCw size={15} aria-hidden="true" /> Actualizar</button>
      </aside>
      <main id="contenido-consola" className="ap-main">
        <div className="ap-titulo"><div><h1>{form.id ? form.titulo || 'Tu sede' : 'Nueva sede'}</h1><p>{form.id ? 'Cambia lo que necesites y guarda.' : 'Cuéntanos dónde estás. Toma dos minutos.'}</p></div><span className={`ap-estado ${saved?.publicado ? 'ap-estado-on' : ''}`}>{saved?.publicado ? 'Publicada' : 'Borrador'}</span></div>
        <div className="ap-columnas">
          <form onSubmit={guardar} className="ap-form" id="venue-form">
            <fieldset disabled={busy}>
              <legend className="sr-only">Datos de la sede</legend>
              <section id="tour-datos" className="ap-seccion">
                <h2><span aria-hidden="true">1</span> Dónde estás</h2>
                <div className="ap-campos">
                  <label className="ap-ancho">Nombre de la sede<input required maxLength={160} placeholder="Ej. Clínica Sonrisa Miraflores" value={form.titulo} onChange={e => editar('titulo', e.target.value)} /></label>
                  <label>Tu negocio<input required maxLength={120} placeholder="Ej. Clínica Sonrisa" value={form.organizacion} onChange={e => editar('organizacion', e.target.value)} /></label>
                  <label>Tipo<span className="ap-select"><select value={form.vertical} onChange={e => editar('vertical', e.target.value)}><option value="servicio">Empresa o servicio</option><option value="evento">Evento</option><option value="clinica">Clínica o salud</option></select><ChevronDown size={16} aria-hidden="true" /></span></label>
                  <label className="ap-ancho">Ciudad<input required maxLength={100} placeholder="Ej. Lima, Perú" value={form.ciudad} onChange={e => editar('ciudad', e.target.value)} /></label>
                  <label>Latitud<input required type="number" min={-90} max={90} step="any" placeholder="-12.1211" value={Number.isNaN(form.lat) ? '' : form.lat} onChange={e => editar('lat', e.target.valueAsNumber)} aria-describedby="coords-help" /></label>
                  <label>Longitud<input required type="number" min={-180} max={180} step="any" placeholder="-77.0305" value={Number.isNaN(form.lon) ? '' : form.lon} onChange={e => editar('lon', e.target.valueAsNumber)} aria-describedby="coords-help" /></label>
                  <p className="ap-ayuda ap-ancho" id="coords-help"><MapPin size={15} aria-hidden="true" /> En Google Maps, mantén presionado tu local y copia los dos números.</p>
                  <label className="ap-ancho">Aeropuerto más cercano <small>(opcional)</small><input maxLength={3} placeholder="Ej. LIM" autoCapitalize="characters" autoComplete="off" value={form.aeropuerto} onChange={e => editar('aeropuerto', e.target.value.toUpperCase())} aria-describedby="airport-help" /></label>
                  <p className="ap-ayuda ap-ancho" id="airport-help"><Plane size={15} aria-hidden="true" /> Su código de 3 letras. Con él, tus clientes buscan vuelos desde su país.</p>
                </div>
              </section>
              <section id="tour-fechas" className="ap-seccion">
                <h2><span aria-hidden="true">2</span> Cuándo vienen</h2>
                <div className="ap-campos"><label>Llegada<input required type="date" value={form.checkin} onChange={e => editar('checkin', e.target.value)} /></label><label>Salida<input required type="date" min={form.checkin || undefined} value={form.checkout} onChange={e => editar('checkout', e.target.value)} /></label></div>
                <p className="ap-ayuda"><CalendarDays size={15} aria-hidden="true" /> {nights > 0 && nights <= 90 ? nights + (nights === 1 ? ' noche.' : ' noches.') : 'Entre 1 y 90 noches.'}</p>
              </section>
              <section id="tour-estilo" className="ap-seccion">
                <h2><span aria-hidden="true">3</span> Tu estilo</h2>
                <p className="ap-ayuda">Así lo verán tus clientes. Si un color no se lee bien, lo ajustamos.</p>
                <ControlesMarca marca={form.marca} onChange={m => editar('marca', m)} />
              </section>
              <section id="tour-publicar" className="ap-seccion">
                <h2><span aria-hidden="true">4</span> Publicar</h2>
                <label className="ap-switch"><span><strong>Portal visible</strong><small>{form.publicado ? 'Cualquiera con el enlace puede verlo.' : 'Solo tú lo ves hasta que lo actives.'}</small></span><input type="checkbox" role="switch" checked={form.publicado} onChange={e => editar('publicado', e.target.checked)} /><span className="ap-switch-pista" aria-hidden="true" /></label>
                <p className="ap-ayuda">Pon solo datos de la sede. Nunca datos de pacientes o clientes.</p>
              </section>
              <div className="ap-guardar"><span>{dirty ? 'Tienes cambios sin guardar' : saved ? 'Todo guardado' : ''}</span><button className="btn btn-dark" disabled={busy}>{busy ? <><Loader2 className="loading-spin" size={16} aria-hidden="true" /> Guardando…</> : <><Check size={16} aria-hidden="true" /> Guardar</>}</button></div>
            </fieldset>
          </form>
          <aside className="ap-lateral">
            <section aria-labelledby="preview-title"><h2 id="preview-title" className="ap-mini"><Eye size={15} aria-hidden="true" /> Vista previa</h2>
              <VistaMarca marca={form.marca} organizacion={form.organizacion || 'Tu negocio'} ciudad={form.ciudad || 'Tu ciudad'} titulo={form.titulo || 'El nombre de tu sede'} />
            </section>
            {saved && (saved.publicado || demo) && <section className="ap-numeros" aria-labelledby="numeros-title"><h2 id="numeros-title" className="ap-mini"><BarChart3 size={15} aria-hidden="true" /> Últimos 30 días{demo ? ' (ejemplo)' : ''}</h2>
              <dl>{([['vistas', 'Visitas'], ['vuelos', 'Buscaron vuelo'], ['hoteles', 'Abrieron hoteles']] as const).map(([k, etiqueta]) => <div key={k}><dt>{etiqueta}</dt><dd>{(resumen[saved.id]?.[k] ?? 0).toLocaleString('es')}</dd></div>)}</dl>
              <p className="ap-ayuda">{resumen[saved.id]?.vistas ? `${Math.round(100 * (resumen[saved.id].vuelos + resumen[saved.id].hoteles) / resumen[saved.id].vistas)} % de las visitas buscó cómo llegar o dónde quedarse.` : 'Comparte tu enlace y aquí verás cuánta gente lo usa.'}</p>
            </section>}
            <section id="tour-compartir" className="ap-compartir" aria-labelledby="compartir-title"><h2 id="compartir-title" className="ap-mini"><Link2 size={15} aria-hidden="true" /> Compartir</h2>
              {link && saved ? <>
                <div className="ap-enlace"><input aria-label="Enlace de tu portal" readOnly value={link} onFocus={e => e.target.select()} /><button className="btn btn-dark" onClick={() => copiar(link)}><Copy size={15} aria-hidden="true" /> Copiar</button><a href={link} className="ap-icono" target="_blank" rel="noreferrer" aria-label="Abrir el portal en otra pestaña"><ExternalLink size={17} /></a></div>
                <p className="ap-ayuda">Id de tu sede: <code>{saved.id}</code></p>
                <GuiaIntegraciones origen={origin} sede={saved.id} />
              </> : <p className="ap-ayuda">{demo ? 'En la demo no se crean enlaces. Entra a tu cuenta para publicar.' : 'Activa «Portal visible» y guarda. Aquí tendrás tu enlace y el código para Shopify, WordPress o tu web.'}</p>}
            </section>
            <p className="ap-gratis"><Info size={15} aria-hidden="true" /> Gratis para ti. Ganamos una comisión cuando tus clientes reservan vuelo u hotel.{!stay22 && !demo ? ' Los hoteles se activarán pronto.' : ''}</p>
          </aside>
        </div>
        <div className="ap-avisos" aria-live="polite">
          {error && <div className="ap-aviso ap-aviso-error" role="alert"><CircleHelp size={18} aria-hidden="true" /><span>{error}{sessionExpired && <> <a href="/plataforma" target="_blank" rel="noreferrer">Volver a entrar en otra pestaña</a></>}</span><button className="ap-icono" onClick={() => setError('')} aria-label="Cerrar aviso"><X size={16} /></button></div>}
          {mensaje && <div className="ap-aviso"><Check size={18} aria-hidden="true" /><span>{mensaje}</span><button className="ap-icono" onClick={() => setMensaje('')} aria-label="Cerrar"><X size={16} /></button></div>}
        </div>
      </main>
    </div>
    <GuidedTour open={tour} onClose={closeTour} />
    <ConfirmLeave open={Boolean(pending)} onCancel={() => setPending(null)} onConfirm={() => { const action = pending; setPending(null); action?.() }} />
  </div>
}

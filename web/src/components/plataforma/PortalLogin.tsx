'use client'

import { useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, Eye, EyeOff, Loader2, MailCheck } from 'lucide-react'

export function PortalLogin({ configurado, correo }: { configurado: boolean; correo: boolean }) {
  const [enviado, setEnviado] = useState('')
  const [errorCorreo, setErrorCorreo] = useState('')
  const [enviando, setEnviando] = useState(false)
  async function pedirEnlace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get('email') ?? '')
    setEnviando(true); setErrorCorreo('')
    try {
      const r = await fetch('/api/plataforma/enlace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setEnviado(email.trim())
    } catch (e) { setErrorCorreo(e instanceof Error ? e.message : 'No pudimos conectar. Vuelve a intentar.') }
    finally { setEnviando(false) }
  }
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [visible, setVisible] = useState(false)
  async function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const clave = new FormData(event.currentTarget).get('clave')
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/plataforma/sesion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clave }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      window.location.assign('/plataforma')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No pudimos conectar. Vuelve a intentar.')
      setBusy(false)
    }
  }
  return <div className="ap ap-login">
    <header className="ap-header"><a href="/" className="wordmark wordmark-sm" aria-label="Luanna, inicio">luanna</a><a className="ap-texto" href="/"><ArrowLeft size={16} aria-hidden="true" /> Volver</a></header>
    <main className="ap-login-main">
      <section className="ap-login-tarjeta" aria-labelledby="login-heading">
        <h1 id="login-heading">Entra a tu plataforma</h1>
        <p>Crea y edita los portales de tus sedes. Es gratis.</p>
        {correo && configurado ? (enviado ? <div className="ap-login-form" role="status">
          <p><MailCheck size={20} aria-hidden="true" /> Te enviamos un enlace a <strong>{enviado}</strong>. Ábrelo en este dispositivo para entrar. Vence en 20 minutos.</p>
          <button type="button" className="btn btn-light" onClick={() => setEnviado('')}>Usar otro correo</button>
        </div> : <form onSubmit={pedirEnlace} className="ap-login-form">
          <label htmlFor="email">Tu correo</label>
          <input id="email" name="email" type="email" required autoComplete="email" inputMode="email" placeholder="nombre@tunegocio.com" disabled={enviando} aria-describedby={errorCorreo ? 'correo-error' : 'correo-ayuda'} aria-invalid={Boolean(errorCorreo)} />
          <p id="correo-ayuda" className="ap-nota">Sin contraseña: te mandamos un enlace para entrar. Si es tu primera vez, creamos tu cuenta gratis.</p>
          {errorCorreo && <p id="correo-error" role="alert" className="ap-login-error">{errorCorreo}</p>}
          <button disabled={enviando} className="btn btn-dark">{enviando ? <><Loader2 size={17} className="loading-spin" aria-hidden="true" /> Enviando…</> : <>Enviarme el enlace <ArrowRight size={17} aria-hidden="true" /></>}</button>
        </form>) : null}
        {configurado ? (correo ? <details className="ap-admin-acceso"><summary>Acceso de administrador</summary>
          <form onSubmit={entrar} className="ap-login-form">
          <label htmlFor="clave">Tu clave</label>
          <div className="ap-clave"><input id="clave" name="clave" type={visible ? 'text' : 'password'} required autoComplete="current-password" disabled={busy} aria-describedby={error ? 'login-error' : undefined} aria-invalid={Boolean(error)} /><button type="button" className="ap-icono" aria-label={visible ? 'Ocultar clave' : 'Mostrar clave'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
          {error && <p id="login-error" role="alert" className="ap-login-error">{error}</p>}
          <button disabled={busy} className="btn btn-dark">{busy ? <><Loader2 size={17} className="loading-spin" aria-hidden="true" /> Entrando…</> : <>Entrar <ArrowRight size={17} aria-hidden="true" /></>}</button>
        </form>
        </details> : <form onSubmit={entrar} className="ap-login-form">
          <label htmlFor="clave">Tu clave</label>
          <div className="ap-clave"><input id="clave" name="clave" type={visible ? 'text' : 'password'} required autoComplete="current-password" disabled={busy} aria-describedby={error ? 'login-error' : undefined} aria-invalid={Boolean(error)} /><button type="button" className="ap-icono" aria-label={visible ? 'Ocultar clave' : 'Mostrar clave'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
          {error && <p id="login-error" role="alert" className="ap-login-error">{error}</p>}
          <button disabled={busy} className="btn btn-dark">{busy ? <><Loader2 size={17} className="loading-spin" aria-hidden="true" /> Entrando…</> : <>Entrar <ArrowRight size={17} aria-hidden="true" /></>}</button>
        </form>) : <div className="ap-login-form"><p>El acceso todavía no está listo. Mientras tanto, puedes probar la plataforma.</p></div>}
        <a href="/plataforma/demo" className="ap-texto">Probar sin cuenta <ArrowUpRight size={15} aria-hidden="true" /></a>
      </section>
    </main>
  </div>
}

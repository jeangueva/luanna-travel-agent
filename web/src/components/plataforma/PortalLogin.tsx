'use client'

import { useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, Eye, EyeOff, Loader2 } from 'lucide-react'

export function PortalLogin({ configurado }: { configurado: boolean }) {
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
        <p>Crea y edita los portales de tus sedes.</p>
        {configurado ? <form onSubmit={entrar} className="ap-login-form">
          <label htmlFor="clave">Tu clave</label>
          <div className="ap-clave"><input id="clave" name="clave" type={visible ? 'text' : 'password'} required autoComplete="current-password" disabled={busy} aria-describedby={error ? 'login-error' : undefined} aria-invalid={Boolean(error)} /><button type="button" className="ap-icono" aria-label={visible ? 'Ocultar clave' : 'Mostrar clave'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
          {error && <p id="login-error" role="alert" className="ap-login-error">{error}</p>}
          <button disabled={busy} className="btn btn-dark">{busy ? <><Loader2 size={17} className="loading-spin" aria-hidden="true" /> Entrando…</> : <>Entrar <ArrowRight size={17} aria-hidden="true" /></>}</button>
        </form> : <div className="ap-login-form"><p>El acceso todavía no está listo. Mientras tanto, puedes probar la plataforma.</p><details><summary>Para quien administra</summary><p>Configura ANCLA_ADMIN_SECRET en el servidor con 32 caracteres aleatorios o más.</p></details></div>}
        <a href="/plataforma/demo" className="ap-texto">Probar sin cuenta <ArrowUpRight size={15} aria-hidden="true" /></a>
      </section>
    </main>
  </div>
}

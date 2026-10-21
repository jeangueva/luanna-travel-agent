'use client'

import { useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, Compass, Eye, EyeOff, LockKeyhole, Loader2 } from 'lucide-react'
import { Brand, GlassShell } from '@/components/ui/GlassShell'

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
  return <GlassShell>
    <header className="login-header"><Brand /><a className="glass-button liquid-glass" href="/"><ArrowLeft size={16} /> Volver al inicio</a></header>
    <main className="login-layout">
      <div className="login-intro"><span className="eyebrow">EL OTRO LADO DEL ENCUENTRO</span><h1>Un lugar para<br /><em>hacerlo fácil.</em></h1><p>Tus sedes, sus fechas y un enlace<br />para cada encuentro.</p><div className="login-signature"><Compass size={30} strokeWidth={1} /><span>Todo empieza con<br />un buen punto de encuentro.</span></div></div>
      <section className="login-card liquid-glass-strong" aria-labelledby="login-heading">
        <span className="login-lock liquid-glass"><LockKeyhole size={23} strokeWidth={1.25} /></span>
        <h2 id="login-heading">Bienvenido a tu espacio.</h2>
        <p>Entra para preparar tu próximo portal.</p>
        {configurado ? <form onSubmit={entrar} className="login-form">
          <label htmlFor="clave">Clave de administración</label>
          <div className="password-field"><input id="clave" name="clave" type={visible ? 'text' : 'password'} required autoComplete="current-password" disabled={busy} aria-describedby={error ? 'login-error' : undefined} aria-invalid={Boolean(error)} placeholder="Tu clave de acceso" /><button type="button" className="icon-button" aria-label={visible ? 'Ocultar clave' : 'Mostrar clave'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
          <button disabled={busy} className="glass-button glass-primary login-submit">{busy ? <><Loader2 size={17} className="loading-spin" /> Entrando…</> : <>Entrar a mi plataforma <ArrowRight size={17} /></>}</button>
          {error && <p id="login-error" role="alert" className="login-error">{error}</p>}
        </form> : <div className="login-pending"><p>Tu espacio está en preparación.</p><span>Puedes explorar la plataforma y su recorrido guiado mientras se habilita el acceso.</span><a href="/plataforma/demo" className="glass-button glass-primary">Explorar la plataforma <ArrowUpRight size={17} /></a><details><summary>Información para el administrador</summary><p>Configura ANCLA_ADMIN_SECRET en el servidor con al menos 32 caracteres aleatorios para habilitar el acceso privado.</p></details></div>}
        {configurado && <a href="/plataforma/demo" className="text-action login-demo">Conocer la plataforma <ArrowUpRight size={15} /></a>}
        <div className="login-footnote"><LockKeyhole size={13} /> Un espacio privado para tu organización.</div>
      </section>
    </main>
  </GlassShell>
}

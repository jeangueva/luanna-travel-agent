'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'

/**
 * El token viaja en el fragmento (#), que el navegador no envía al servidor ni a
 * los registros. Se gasta solo al tocar el botón, para que los antivirus que
 * abren los enlaces del correo no lo consuman antes que la persona.
 */
export function EntrarConEnlace() {
  const [token, setToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const t = window.location.hash.slice(1)
    setToken(t)
    history.replaceState(null, '', window.location.pathname)
  }, [])
  async function entrar() {
    setBusy(true); setError('')
    try {
      const r = await fetch('/api/plataforma/sesion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      window.location.assign('/plataforma')
    } catch (e) { setError(e instanceof Error ? e.message : 'No pudimos conectar. Vuelve a intentar.'); setBusy(false) }
  }
  return <div className="ap ap-login">
    <header className="ap-header"><a href="/" className="wordmark wordmark-sm" aria-label="Luanna, inicio">luanna</a></header>
    <main className="ap-login-main">
      <section className="ap-login-tarjeta" aria-labelledby="entrar-titulo">
        <h1 id="entrar-titulo">Ya casi estás</h1>
        {token === '' ? <p>Este enlace está incompleto. <a href="/plataforma">Pide uno nuevo</a>.</p> : <>
          <p>Toca el botón para entrar a tu plataforma.</p>
          <div className="ap-login-form">
            {error && <p role="alert" className="ap-login-error">{error} <a href="/plataforma">Pedir otro enlace</a></p>}
            <button className="btn btn-dark" disabled={busy || !token} onClick={entrar}>{busy ? <><Loader2 size={17} className="loading-spin" aria-hidden="true" /> Entrando…</> : <>Entrar <ArrowRight size={17} aria-hidden="true" /></>}</button>
          </div>
        </>}
      </section>
    </main>
  </div>
}

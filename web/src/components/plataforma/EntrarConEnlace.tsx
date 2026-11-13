'use client'
import { useEffect, useState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import { CareFooter, CareHeader } from '@/components/care/Shell'
/** Tokens remain in the URL fragment and are consumed only on explicit confirmation. */
export function EntrarConEnlace() {
  const [token, setToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  useEffect(() => { setToken(window.location.hash.slice(1)); history.replaceState(null, '', window.location.pathname) }, [])
  async function entrar() {
    setBusy(true); setError('')
    try {
      const r = await fetch('/api/plataforma/sesion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      if (!r.ok) throw new Error('Este enlace ha vencido o no se puede usar. Puedes pedir uno nuevo.')
      window.location.assign('/plataforma')
    } catch (e) { setError(e instanceof Error ? e.message : 'No pudimos conectar. Inténtalo de nuevo.'); setBusy(false) }
  }
  async function request(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const r = await fetch('/api/plataforma/enlace', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) })
      if (!r.ok) throw new Error('No pudimos enviar el enlace. Inténtalo más tarde o escríbenos a hola@luanna.app.')
      setSent(true)
    } catch (e) { setError(e instanceof Error ? e.message : 'No pudimos conectar. Inténtalo de nuevo.') }
    finally { setBusy(false) }
  }
  return <div className="care"><CareHeader simple /><main className="care-container"><section className="care-panel care-login"><span className="care-eyebrow">Tu acceso a Luanna</span><h1>{token ? 'Ya casi estás.' : 'Entra con tu correo.'}</h1>{token ? <><p>Confirma que quieres usar el enlace que recibiste para continuar.</p><button className="care-button" disabled={busy} onClick={entrar}>{busy ? <><Loader2 className="care-spin" size={18} aria-hidden="true" /> Entrando…</> : <>Continuar <ArrowRight size={18} aria-hidden="true" /></>}</button>{error && <button className="care-text-link" onClick={() => { setToken(''); setError('') }}>Pedir otro enlace</button>}</> : token === null ? <p role="status">Preparando el acceso…</p> : sent ? <div role="status"><p>Si tu cuenta puede recibir el enlace, lo encontrarás en tu correo. Revisa también la carpeta de spam.</p><button className="care-text-link" onClick={() => setSent(false)}>Usar otro correo</button></div> : <form onSubmit={request}><p>Te enviaremos un enlace para entrar, sin contraseña.</p><label className="care-field" htmlFor="access-email">Correo electrónico<input id="access-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label><button className="care-button" disabled={busy}>{busy ? 'Enviando…' : 'Recibir enlace'}</button></form>}{error && <p className="care-error" role="alert">{error}</p>}<a className="care-text-link" href="/plataforma">Continuar con una revisión</a></section></main><CareFooter /></div>
}

import type { ReactNode } from 'react'

/** Estructura compartida de privacidad y términos. */
export function Legal({ titulo, actualizado, children }: { titulo: string; actualizado: string; children: ReactNode }) {
  return <div className="ds-page">
    <nav className="ds-nav ds-nav-simple" aria-label="Principal"><a href="/" className="wordmark" aria-label="Luanna, inicio">luanna</a><a href="/plataforma" className="btn btn-dark">Crear mi portal</a></nav>
    <main className="ds-section legal">
      <h1 className="titulo-pagina">{titulo}</h1>
      <p className="nota-pagina">Última actualización: {actualizado}</p>
      {children}
    </main>
    <footer className="ds-footer"><span className="wordmark wordmark-sm">luanna</span><p><a href="/privacidad">Privacidad</a> · <a href="/terminos">Términos</a></p></footer>
  </div>
}

import type { ReactNode } from 'react'
import { CareHeader, CareFooter } from '@/components/care/Shell'
export function Legal({ titulo, actualizado, children }: { titulo: string; actualizado: string; children: ReactNode }) {
  return <div className="care"><CareHeader simple /><main className="care-container" id="contenido"><article className="care-reading"><h1>{titulo}</h1><p className="care-small">Última actualización: {actualizado}</p><div className="care-prose">{children}</div></article></main><CareFooter /></div>
}

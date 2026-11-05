'use client'

import { useEffect, type ReactNode } from 'react'
import { medir, type Evento } from '@/lib/medicion'

type Base = Omit<Evento, 'tipo'>

/** Cuenta una vista por carga del portal. */
export function MedirVista(base: Base) {
  useEffect(() => { medir({ ...base, tipo: 'vista' }) }, [base.portal])
  return null
}

/** Enlace externo a hoteles que cuenta la apertura. */
export function EnlaceHoteles({ href, base, children }: { href: string; base: Base; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" className="pp-enlace" onClick={() => medir({ ...base, tipo: 'hoteles' })}>{children}</a>
}

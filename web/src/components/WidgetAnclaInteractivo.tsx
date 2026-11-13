'use client'
import type { CasoAuditoria } from '@/lib/auditor-engine'
import { ReviewResult } from '@/components/care/ReviewResult'
export function WidgetAuditorInteractivo({ caso, casosDisponibles, onSelectCaso, mostrarSelectorInterno = true }: { caso: CasoAuditoria; casosDisponibles?: CasoAuditoria[]; onSelectCaso?: (nuevo: CasoAuditoria) => void; mostrarSelectorInterno?: boolean }) {
  return <div className="care">{mostrarSelectorInterno && casosDisponibles && onSelectCaso && <div className="care-type-picker">{casosDisponibles.map(c => <button key={c.id} aria-pressed={c.id === caso.id} onClick={() => onSelectCaso(c)}>{c.tipo === 'hotel' ? c.hotelNombre : c.aerolinea}</button>)}</div>}<ReviewResult key={caso.id} caso={caso} /></div>
}

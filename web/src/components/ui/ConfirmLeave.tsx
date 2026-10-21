'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export function ConfirmLeave({ open, onCancel, onConfirm }: { open: boolean; onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const node = ref.current
    node?.showModal()
    return () => { node?.close(); previous?.focus({ preventScroll: true }) }
  }, [open])
  return <dialog ref={ref} className="luanna-glass confirm-dialog liquid-glass-strong" aria-labelledby="leave-title" aria-describedby="leave-description" onCancel={event => { event.preventDefault(); onCancel() }}>
    <button className="icon-button dialog-close" onClick={onCancel} aria-label="Cerrar"><X size={19} /></button>
    <h2 id="leave-title">Tienes cambios sin guardar.</h2>
    <p id="leave-description">Puedes seguir editando o salir sin guardar estos cambios.</p>
    <div className="dialog-actions"><button className="glass-button liquid-glass" onClick={onConfirm}>Descartar cambios</button><button autoFocus className="glass-button glass-primary" onClick={onCancel}>Seguir editando</button></div>
  </dialog>
}

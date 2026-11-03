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
  return <dialog ref={ref} className="ap-dialogo" aria-labelledby="leave-title" aria-describedby="leave-description" onCancel={event => { event.preventDefault(); onCancel() }}>
    <button className="ap-icono ap-dialogo-cerrar" onClick={onCancel} aria-label="Cerrar"><X size={19} /></button>
    <h2 id="leave-title">¿Salir sin guardar?</h2>
    <p id="leave-description">Tienes cambios que se perderán.</p>
    <div className="ap-dialogo-acciones"><button className="btn btn-light" onClick={onConfirm}>Salir sin guardar</button><button autoFocus className="btn btn-dark" onClick={onCancel}>Seguir editando</button></div>
  </dialog>
}

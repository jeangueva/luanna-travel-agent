'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowRight, Check, Compass, X } from 'lucide-react'

export const TOUR_KEY = 'luanna-onboarding-v1'
const steps = [
  { target: 'tour-sedes', title: 'Tu punto de partida.', text: 'Aquí encontrarás tus sedes. Crea una para cada evento o clínica y vuelve a editarla cuando quieras.' },
  { target: 'tour-datos', title: 'Dale un lugar al encuentro.', text: 'Escribe el nombre, la ciudad y las coordenadas. Estos datos sitúan el alojamiento alrededor de tu sede.' },
  { target: 'tour-fechas', title: 'Elige la estancia.', text: 'Define las fechas de entrada y salida sugeridas. Puedes cambiarlas antes o después de publicar.' },
  { target: 'tour-publicar', title: 'Publica cuando esté listo.', text: 'Guarda como borrador o activa “Portal público”. Desactívalo y guarda para retirar el enlace.' },
  { target: 'tour-compartir', title: 'Un enlace. Todo más cerca.', text: 'Después de publicar, copia el enlace o el código para tu web. Puedes repetir esta guía desde “Ayuda”.' },
]

export function GuidedTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<CSSProperties>({ display: 'none' })
  useEffect(() => {
    if (!open) return
    setStep(0)
    const previous = document.activeElement as HTMLElement | null
    const node = dialog.current
    node?.showModal()
    return () => { node?.close(); previous?.focus({ preventScroll: true }) }
  }, [open])
  useEffect(() => {
    if (!open) return
    const target = document.getElementById(steps[step].target)
    target?.scrollIntoView({ block: 'center', behavior: 'instant' })
    const update = () => {
      const box = target?.getBoundingClientRect()
      setRect(box ? { left: box.left - 6, top: box.top - 6, width: box.width + 12, height: box.height + 12 } : { display: 'none' })
    }
    update()
    heading.current?.focus({ preventScroll: true })
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    const observer = new ResizeObserver(update)
    if (target) observer.observe(target)
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); observer.disconnect() }
  }, [open, step])
  function finish() {
    onClose()
  }
  return <dialog ref={dialog} className="luanna-glass tour-overlay" aria-labelledby="tour-title" aria-describedby="tour-description" onCancel={event => { event.preventDefault(); finish() }}>
    <div className="tour-highlight" style={rect} aria-hidden="true" />
    <section className="tour-card liquid-glass-strong">
      <div className="preview-heading"><span className="tour-label"><Compass size={18} /> UN RECORRIDO CONTIGO</span><button className="icon-button" onClick={finish} aria-label="Cerrar recorrido"><X size={18} /></button></div>
      <div className="tour-progress" aria-label={`Paso ${step + 1} de ${steps.length}`}>{steps.map((item, index) => <span key={item.target} data-current={index <= step} />)}</div>
      <span className="eyebrow">PASO {step + 1} DE {steps.length}</span>
      <h2 ref={heading} id="tour-title" tabIndex={-1}>{steps[step].title}</h2>
      <p id="tour-description">{steps[step].text}</p>
      <div className="tour-actions"><button className="text-action" onClick={step ? () => setStep(step - 1) : finish}>{step ? <><ArrowLeft size={16} /> Anterior</> : 'Omitir guía'}</button><button className="glass-button glass-primary" onClick={step === steps.length - 1 ? finish : () => setStep(step + 1)}>{step === steps.length - 1 ? <>Empezar <Check size={17} /></> : <>Siguiente <ArrowRight size={17} /></>}</button></div>
    </section>
  </dialog>
}

'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowRight, Check, Compass, X } from 'lucide-react'

export const TOUR_KEY = 'luanna-onboarding-v3'
const steps = [
  { target: 'tour-sedes', title: 'Tus sedes', text: 'Una sede es un lugar al que tus clientes viajan. Crea una por cada local, evento o clínica.' },
  { target: 'tour-datos', title: 'Dónde estás', text: 'La ciudad, el punto exacto y el aeropuerto más cercano. Con eso mostramos vuelos y hoteles cerca.' },
  { target: 'tour-fechas', title: 'Cuándo vienen', text: 'Las fechas de llegada y salida. Puedes cambiarlas cuando quieras.' },
  { target: 'tour-estilo', title: 'Tu estilo', text: 'Tus colores, tu letra y tus esquinas. Tus clientes verán tu marca, no la nuestra.' },
  { target: 'tour-publicar', title: 'Publicar', text: 'Activa «Portal visible» y guarda. Para ocultarlo, desactívalo y guarda otra vez.' },
  { target: 'tour-compartir', title: 'Compartir', text: 'Copia tu enlace o el código para Shopify, WordPress o tu web. Puedes repetir esta guía desde «Ayuda».' },
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
  return <dialog ref={dialog} className="ap-tour" aria-labelledby="tour-title" aria-describedby="tour-description" onCancel={event => { event.preventDefault(); finish() }}>
    <div className="ap-tour-foco" style={rect} aria-hidden="true" />
    <section className="ap-tour-tarjeta">
      <div className="ap-tour-cabecera"><span className="ap-mini"><Compass size={18} /> Guía rápida</span><button className="ap-icono" onClick={finish} aria-label="Cerrar recorrido"><X size={18} /></button></div>
      <div className="ap-tour-progreso" aria-label={`Paso ${step + 1} de ${steps.length}`}>{steps.map((item, index) => <span key={item.target} data-current={index <= step} />)}</div>
      <span className="ap-tour-paso">Paso {step + 1} de {steps.length}</span>
      <h2 ref={heading} id="tour-title" tabIndex={-1}>{steps[step].title}</h2>
      <p id="tour-description">{steps[step].text}</p>
      <div className="ap-tour-acciones"><button className="ap-texto" onClick={step ? () => setStep(step - 1) : finish}>{step ? <><ArrowLeft size={16} /> Anterior</> : 'Omitir guía'}</button><button className="btn btn-dark" onClick={step === steps.length - 1 ? finish : () => setStep(step + 1)}>{step === steps.length - 1 ? <>Empezar <Check size={17} /></> : <>Siguiente <ArrowRight size={17} /></>}</button></div>
    </section>
  </dialog>
}

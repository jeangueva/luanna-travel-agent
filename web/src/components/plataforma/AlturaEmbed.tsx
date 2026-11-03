'use client'

import { useEffect } from 'react'

/** Dentro de un iframe, avisa a la web anfitriona cuánto mide el portal. */
export function AlturaEmbed() {
  useEffect(() => {
    if (window.parent === window) return
    const enviar = () => window.parent.postMessage({ luanna: 'altura', alto: document.documentElement.scrollHeight }, '*')
    const observer = new ResizeObserver(enviar)
    observer.observe(document.body)
    enviar()
    return () => observer.disconnect()
  }, [])
  return null
}

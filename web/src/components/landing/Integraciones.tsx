'use client'
import { useState } from 'react'
import { Copy } from 'lucide-react'
export function GuiaIntegraciones({ origen, sede }: { origen: string; sede?: string }) {
  void sede
  const [notice, setNotice] = useState('')
  const snippet = `<iframe\n  src="${origen}/demo"\n  title="Ejemplo de revisión de reserva con Luanna"\n  style="width:100%;height:900px;border:0;border-radius:16px"\n  loading="lazy"\n></iframe>`
  async function copy() { try { await navigator.clipboard.writeText(snippet); setNotice('Código copiado.') } catch { setNotice('No pudimos copiarlo. Selecciona el código y cópialo manualmente.') } }
  return <div className="care-integrations"><section className="care-panel"><h2>Comparte un ejemplo en tu web</h2><p>Deja que tus clientes conozcan el recorrido con datos ficticios. La demo no envía documentos ni genera reservas.</p><ol><li>Copia este código en un bloque HTML de tu sitio.</li><li>Comprueba que el recorrido se ve bien en móvil y ordenador.</li><li>Ofrece también un enlace para abrir la demo en una página completa.</li></ol><pre><code>{snippet}</code></pre><div className="care-actions"><button className="care-button care-button-secondary" onClick={copy}><Copy size={17} aria-hidden="true" /> Copiar código</button><a className="care-text-link" href="/demo">Abrir demo</a></div><p role="status" className="care-helper">{notice}</p></section><section className="care-panel"><h2>¿Necesitas conectar tu sistema?</h2><p>Cuéntanos cómo trabajas y qué información necesitas compartir. Antes de automatizar el envío de reservas, hay que acordar el acceso, el tratamiento de datos y el alcance del servicio.</p><a className="care-text-link" href="mailto:hola@luanna.app?subject=Integraci%C3%B3n%20con%20Luanna">Hablar sobre una integración</a></section></div>
}

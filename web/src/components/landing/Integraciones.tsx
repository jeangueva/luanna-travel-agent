'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

/** Fragmentos para instalar Luanna. `sede` vacío muestra un marcador. */
export function fragmentos(origen: string, sede = 'ID-DE-TU-SEDE') {
  return [
    { id: 'web', nombre: 'Cualquier web', pasos: ['Copia estas dos líneas.', 'Pégalas en tu web donde quieras que aparezca (en Wix: «Insertar código»; en Webflow: «Embed»).'], codigo: `<div data-luanna="${sede}"></div>\n<script src="${origen}/embed.js" async></script>` },
    { id: 'wordpress', nombre: 'WordPress', pasos: ['Descarga el plugin e instálalo en Plugins › Añadir nuevo › Subir.', 'En Ajustes › Luanna, pega el id de tu sede.', 'Escribe este atajo en cualquier página:'], codigo: '[luanna]' },
    { id: 'shopify', nombre: 'Shopify', pasos: ['Instala la app de Luanna en tu tienda.', 'Ve a Tienda online › Personalizar y agrega el bloque «Luanna».', 'Pega el id de tu sede en el bloque:'], codigo: sede },
    { id: 'enlace', nombre: 'Un enlace', pasos: ['Sin web y sin código. Comparte este enlace por WhatsApp, correo o redes.'], codigo: `${origen}/p/${sede}` },
  ]
}

export function GuiaIntegraciones({ origen, sede }: { origen: string; sede?: string }) {
  const lista = fragmentos(origen, sede)
  const [activa, setActiva] = useState(lista[0].id)
  const [copiado, setCopiado] = useState(false)
  const actual = lista.find(f => f.id === activa)!
  async function copiar() {
    try { await navigator.clipboard.writeText(actual.codigo); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch { setCopiado(false) }
  }
  return <div className="guia">
    <div className="segmentos" role="tablist" aria-label="Dónde lo vas a usar">
      {lista.map(f => <button key={f.id} role="tab" id={`tab-${f.id}`} aria-selected={activa === f.id} aria-controls="guia-panel" aria-pressed={activa === f.id} onClick={() => { setActiva(f.id); setCopiado(false) }}>{f.nombre}</button>)}
    </div>
    <div id="guia-panel" role="tabpanel" aria-labelledby={`tab-${activa}`} className="guia-panel">
      <ol>{actual.pasos.map(p => <li key={p}>{p}</li>)}</ol>
      <pre><code>{actual.codigo}</code></pre>
      <button type="button" className="btn btn-dark" onClick={copiar}>{copiado ? <><Check size={16} aria-hidden="true" /> Copiado</> : <><Copy size={16} aria-hidden="true" /> Copiar</>}</button>
      <span className="sr-only" role="status">{copiado ? 'Copiado al portapapeles' : ''}</span>
    </div>
  </div>
}

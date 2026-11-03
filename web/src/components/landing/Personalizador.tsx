'use client'

import { useState, type CSSProperties } from 'react'
import { Hotel, Info, Plane } from 'lucide-react'
import { colorAjustado, FUENTES, MARCA_BASE, variablesMarca, type Marca } from '@/lib/marca'

const COLORES = ['#905831', '#1d4ed8', '#0f766e', '#be185d', '#facc15', '#111111']

/** Controles de marca. Los usan la landing (demo) y el editor de la plataforma. */
export function ControlesMarca({ marca, onChange }: { marca: Marca; onChange: (m: Marca) => void }) {
  const set = <K extends keyof Marca>(k: K, v: Marca[K]) => onChange({ ...marca, [k]: v })
  return <div className="controles">
    <fieldset><legend>Color</legend>
      <div className="muestras">
        {COLORES.map(c => <button type="button" key={c} className="muestra" style={{ background: c }} aria-label={`Color ${c}`} aria-pressed={marca.color === c} onClick={() => set('color', c)} />)}
        <label className="muestra muestra-libre"><span className="sr-only">Elegir otro color</span><input type="color" value={marca.color} onChange={e => set('color', e.target.value)} /></label>
      </div>
      {colorAjustado(marca) && <p className="aviso" role="status"><Info size={15} aria-hidden="true" /> Ajustamos un poco el tono para que se lea bien.</p>}
    </fieldset>
    <fieldset><legend>Fondo</legend><div className="segmentos">{(['claro', 'oscuro'] as const).map(v => <button type="button" key={v} aria-pressed={marca.fondo === v} onClick={() => set('fondo', v)}>{v === 'claro' ? 'Claro' : 'Oscuro'}</button>)}</div></fieldset>
    <fieldset><legend>Letra</legend><div className="segmentos">{(Object.keys(FUENTES) as Marca['fuente'][]).map(v => <button type="button" key={v} aria-pressed={marca.fuente === v} onClick={() => set('fuente', v)}>{FUENTES[v].nombre}</button>)}</div></fieldset>
    <fieldset><legend>Esquinas</legend><div className="segmentos">{(['rectas', 'suaves', 'redondas'] as const).map(v => <button type="button" key={v} aria-pressed={marca.esquinas === v} onClick={() => set('esquinas', v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}</div></fieldset>
  </div>
}

export function VistaMarca({ marca, organizacion = 'Clínica Sonrisa', ciudad = 'Lima', titulo = 'Tu viaje a tu tratamiento' }: {
  marca: Marca; organizacion?: string; ciudad?: string; titulo?: string
}) {
  return <div className="m-portal" style={variablesMarca(marca) as CSSProperties} aria-label="Vista previa del portal">
    <p className="m-eyebrow">{organizacion} · {ciudad}</p>
    <p className="m-titulo">{titulo}</p>
    <div className="m-bloque"><Plane size={18} aria-hidden="true" /><span>¿Desde dónde vuelas?</span></div>
    <div className="m-fila"><span className="m-input">MIA</span><span className="m-boton">Buscar vuelos</span></div>
    <div className="m-bloque"><Hotel size={18} aria-hidden="true" /><span>Hoteles cerca de {ciudad}</span></div>
  </div>
}

export function Personalizador() {
  const [marca, setMarca] = useState<Marca>(MARCA_BASE)
  return <div className="personalizador">
    <ControlesMarca marca={marca} onChange={setMarca} />
    <VistaMarca marca={marca} />
  </div>
}

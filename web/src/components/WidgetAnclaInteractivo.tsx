'use client'

import type {
  AlojamientoVerificado,
  AnclaGeoConfig,
  CotizacionEconomica,
} from '@/lib/ancla-engine'
import {
  IconCheck,
  IconCrosshair,
  IconRoute,
  IconShield,
  SpotlightTray,
  TabularNumber,
} from '@/components/ui/reactbits'

export function WidgetAnclaInteractivo({
  ancla,
  alojamientosFiltrados,
  alojamientoSeleccionado,
  onSelectAlojamiento,
  isocronaMinutos,
  reglasActivasIds,
  onToggleRegla,
  cotizacion,
  origenSeleccionado,
  onSelectOrigen,
  modoCompacto = false,
}: {
  ancla: AnclaGeoConfig
  alojamientosFiltrados: AlojamientoVerificado[]
  alojamientoSeleccionado: AlojamientoVerificado
  onSelectAlojamiento: (aloj: AlojamientoVerificado) => void
  isocronaMinutos: number
  reglasActivasIds: string[]
  onToggleRegla?: (reglaId: string) => void
  cotizacion: CotizacionEconomica
  origenSeleccionado: string
  onSelectOrigen: (iata: string) => void
  modoCompacto?: boolean
}) {
  const esClinica = ancla.vertical === 'clinica'

  return (
    <SpotlightTray
      variant="dark"
      aria-label={`Vista previa interactiva del widget para ${ancla.organizacion}`}
      coreClassName="p-4 sm:p-6"
    >
      <p className="mb-4 text-sm text-[#d5d1c8]">
        Demostración con datos de ejemplo. Precios, disponibilidad y tiempos de
        traslado pendientes de confirmación con proveedores.
      </p>
      {/* Top Hardware Chrome Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3.5">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-full bg-ancla-signal"
          />
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#d5d1c8]">
            {esClinica ? 'PORTAL CLÍNICO POST-AGENDA' : 'WIDGET POST-CHECKOUT TICKETERA'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded bg-white/8 px-2 py-0.5 font-mono text-[11px] tabular-nums text-[#b8b3a8]">
            {ancla.lat.toFixed(4)}, {ancla.lon.toFixed(4)}
          </span>
          <span className="rounded bg-[#19674e]/30 border border-[#32a882]/30 px-2 py-0.5 font-mono text-[11px] text-[#7ce2be]">
            ISO {isocronaMinutos} MIN
          </span>
        </div>
      </div>

      {/* Anchor Identity Header */}
      <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#9e998e]">
            {ancla.organizacion} · {ancla.ciudad}, {ancla.pais}
          </p>
          <h3 className="mt-1 font-display text-lg font-semibold tracking-[-0.02em] text-[#fdfcfa] sm:text-xl">
            {ancla.titulo}
          </h3>
        </div>

        {/* Origin Airport Selector */}
        <div className="flex items-center gap-1.5" role="group" aria-label="Aeropuerto de origen">
          <span className="mr-1 font-mono text-[11px] text-[#9e998e]">ORIGEN:</span>
          {ancla.origenesFrecuentes.map((iata) => {
            const activo = iata === origenSeleccionado
            return (
              <button
                key={iata}
                type="button"
                onClick={() => onSelectOrigen(iata)}
                aria-pressed={activo}
                className={`press-scale rounded px-2 py-1 font-mono text-[11px] font-medium transition-colors ${
                  activo
                    ? 'bg-[#fdfcfa] text-[#11110f]'
                    : 'bg-white/6 text-[#b8b3a8] hover:bg-white/12 hover:text-white'
                }`}
              >
                {iata}
              </button>
            )
          })}
        </div>
      </div>

      {/* Split Canvas: Topographic Isochrone Map + Verified Inventory */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left 7 cols: Topographic Isochrone Radar */}
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0e0e0c] p-4 lg:col-span-7">
          <div
            aria-hidden="true"
            className="bg-topographic-grid-dark pointer-events-none absolute inset-0"
          />

          {/* Top Map Overlay Badge */}
          <div className="relative z-10 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/70 border border-white/12 px-2.5 py-1 font-mono text-[11px] text-[#e4e0d8]">
              <IconCrosshair className="h-3.5 w-3.5 text-ancla-signal" />
              <span>Ancla cero: {esClinica ? 'Quirófano / Consultorio' : 'Arco de Partida / Sede'}</span>
            </span>
            <span className="font-mono text-[11px] tabular-nums text-[#9e998e]">
              Tráfico hora pico verificado
            </span>
          </div>

          {/* Interactive SVG Topographic Isochrone Map */}
          <div className="relative z-10 my-3 h-[220px] w-full select-none sm:h-[240px]">
            <svg
              viewBox="0 0 400 220"
              className="h-full w-full"
              role="img"
              aria-label={`Mapa de isócrona de ${isocronaMinutos} minutos alrededor de ${ancla.organizacion}`}
            >
              {/* Topographic contour lines */}
              <path
                d="M -20 45 Q 110 20, 220 55 T 420 35"
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
              />
              <path
                d="M -10 175 Q 140 140, 260 185 T 410 160"
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
              />
              <path
                d="M 65 -10 Q 95 110, 55 230"
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />
              <path
                d="M 310 -10 Q 280 110, 335 230"
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />

              {/* Outer 15-min reference ring */}
              <ellipse
                cx="200"
                cy="112"
                rx="155"
                ry="88"
                fill="none"
                stroke="rgba(255,255,255,0.12)"
                strokeDasharray="3 4"
                strokeWidth="1"
              />

              {/* Active calibrated Isochrone polygon/ellipse */}
              <ellipse
                cx="200"
                cy="112"
                rx={Math.min(142, Math.max(76, isocronaMinutos * 10.5))}
                ry={Math.min(82, Math.max(46, isocronaMinutos * 6.2))}
                fill="rgba(184, 68, 33, 0.11)"
                stroke="#b84421"
                strokeWidth="1.5"
              />

              {/* Inner 5-min priority recovery/walk ring */}
              <ellipse
                cx="200"
                cy="112"
                rx="56"
                ry="34"
                fill="rgba(25, 103, 78, 0.16)"
                stroke="rgba(124, 226, 190, 0.45)"
                strokeWidth="1"
              />

              {/* Route vector from selected hotel to Central Anchor */}
              {alojamientoSeleccionado ? (
                <line
                  x1={alojamientoSeleccionado.offsetMapa.x * 4}
                  y1={alojamientoSeleccionado.offsetMapa.y * 2.2}
                  x2="200"
                  y2="112"
                  stroke="#7ce2be"
                  strokeWidth="1.75"
                  strokeDasharray="4 3"
                />
              ) : null}

              {/* Central Geo-Anchor Pin (Clinic or Event Start) */}
              <g transform="translate(200, 112)">
                <circle
                  r="16"
                  fill="rgba(184, 68, 33, 0.28)"
                  className="animate-anchor-pulse"
                />
                <circle r="6" fill="#b84421" stroke="#fdfcfa" strokeWidth="2" />
                <text
                  y="-12"
                  textAnchor="middle"
                  fill="#fdfcfa"
                  fontSize="9"
                  fontFamily="Chivo Mono, monospace"
                  letterSpacing="0.08em"
                >
                  {esClinica ? 'CLÍNICA CERO' : 'PARTIDA 0KM'}
                </text>
              </g>
            </svg>

            {/* Interactive Hotel Pins overlaid for full keyboard accessibility */}
            {alojamientosFiltrados.map((aloj) => {
              const seleccionado = aloj.id === alojamientoSeleccionado.id
              return (
                <button
                  key={aloj.id}
                  type="button"
                  onClick={() => onSelectAlojamiento(aloj)}
                  style={{
                    left: `${aloj.offsetMapa.x}%`,
                    top: `${aloj.offsetMapa.y}%`,
                  }}
                  aria-label={`Seleccionar ${aloj.nombre}, a ${aloj.distanciaMinutos} minutos, tarifa neta ${aloj.tarifaNetaUsd} dólares`}
                  aria-pressed={seleccionado}
                  className={`press-scale absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-2.5 py-1 font-mono text-[11px] font-medium tabular-nums transition-transform duration-200 ease-out-strong ${
                    seleccionado
                      ? 'z-20 scale-105 bg-[#fdfcfa] text-[#11110f] ring-2 ring-ancla-signal'
                      : 'z-10 bg-[#1c1c19]/95 text-[#e4e0d8] border border-white/20 hover:border-white'
                  }`}
                >
                  {aloj.distanciaMinutos}m · ${aloj.tarifaNetaUsd}
                </button>
              )
            })}
          </div>

          {/* Bottom Filter Rules Bar */}
          <div className="relative z-10 flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-3">
            <span className="mr-1 font-mono text-[10px] uppercase tracking-wider text-[#9e998e]">
              {esClinica ? 'FILTROS CLÍNICOS:' : 'REGLAS EVENTO:'}
            </span>
            {ancla.reglasDisponibles.map((regla) => {
              const activa = reglasActivasIds.includes(regla.id)
              return (
                <button
                  key={regla.id}
                  type="button"
                  onClick={() => onToggleRegla?.(regla.id)}
                  aria-pressed={activa}
                  className={`press-scale inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-sans text-[11px] transition-colors ${
                    activa
                      ? 'bg-[#19674e]/35 border border-[#45b892]/40 text-[#9ef0d2]'
                      : 'bg-white/5 border border-white/10 text-[#9e998e] hover:text-white'
                  }`}
                >
                  {activa ? <IconCheck className="h-3 w-3" /> : null}
                  <span>{regla.etiqueta}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right 5 cols: Selected Suite + Flight Flex + Instant Net Margin Breakdown */}
        <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#141412] p-4 lg:col-span-5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="rounded bg-white/8 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#b8b3a8]">
                {alojamientoSeleccionado.proveedorApi}
              </span>
              <span className="font-mono text-[11px] text-[#7ce2be]">
                {alojamientoSeleccionado.distanciaMinutos} min ({alojamientoSeleccionado.distanciaMetros} m)
              </span>
            </div>

            <h4 className="mt-2 font-display text-base font-semibold text-[#fdfcfa]">
              {alojamientoSeleccionado.nombre}
            </h4>

            {/* Selector of verified accommodations */}
            {!modoCompacto && alojamientosFiltrados.length > 1 ? (
              <div className="mt-2.5 grid grid-cols-1 gap-1.5" role="list" aria-label="Alojamientos verificados en la isócrona">
                {alojamientosFiltrados.map((item) => {
                  const isCurrent = item.id === alojamientoSeleccionado.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectAlojamiento(item)}
                      className={` flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ${
                        isCurrent
                          ? 'border-white/30 bg-white/10 text-white'
                          : 'border-white/5 bg-white/[0.02] text-[#a6a29a] hover:border-white/15 hover:text-white'
                      }`}
                    >
                      <span className="truncate pr-2 font-medium">{item.nombre}</span>
                      <span className="shrink-0 font-mono text-[11px] tabular-nums">
                        {item.distanciaMinutos}m · ${item.tarifaNetaUsd}/n
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : null}

            {/* Bundled Flight + Ancillaries Stack */}
            <div className="mt-3.5 space-y-2 border-t border-white/10 pt-3 text-xs">
              <div className="flex items-center justify-between text-[#d5d1c8]">
                <span className="inline-flex items-center gap-1.5">
                  <IconRoute className="h-3.5 w-3.5 text-ancla-signal" />
                  <span>
                    Vuelo {origenSeleccionado} → {ancla.codigoIataDestino} (Duffel API)
                  </span>
                </span>
                <span className="font-mono tabular-nums">
                  ${cotizacion.tarifaVueloBaseUsd}
                </span>
              </div>

              <div className="flex items-center justify-between text-[#d5d1c8]">
                <span className="inline-flex items-center gap-1.5">
                  <IconShield className="h-3.5 w-3.5 text-[#7ce2be]" />
                  <span>
                    {esClinica
                      ? 'Cambio médico sin penalidad + eSIM'
                      : 'Protección de dorsal + eSIM 5GB'}
                  </span>
                </span>
                <span className="font-mono tabular-nums text-[#7ce2be]">Incluido</span>
              </div>
            </div>
          </div>

          {/* Live Checkout & Partner Revenue Split Box */}
          <div
            aria-live="polite"
            className="mt-4 rounded-lg border border-white/12 bg-[#0b0b0a] p-3"
          >
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-[#9e998e]">
                TOTAL PAQUETE ({cotizacion.noches} NOCHES + VUELO)
              </span>
              <span className="font-mono text-lg font-semibold text-[#fdfcfa]">
                <TabularNumber value={cotizacion.precioTotalViajeroUsd} prefix="$" suffix=" USD" />
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
              <span className="font-mono text-[11px] text-[#7ce2be]">
                COMISIÓN NETA SOCIO (70%):
              </span>
              <span className="font-mono text-sm font-semibold text-[#7ce2be]">
                <TabularNumber
                  value={cotizacion.ingresoNetoSocioPorReservaUsd}
                  prefix="+$"
                  suffix=" USD / reserva"
                />
              </span>
            </div>
          </div>
        </div>
      </div>
    </SpotlightTray>
  )
}

'use client'

import { useState } from 'react'
import {
  construirEnlaceRebookingAfiliado,
  construirEnlacesHouseMoney,
  generarEscritoPoderEspecialVuelo,
  generarExpedienteReclamo,
  generarMensajeNegociacionHotel,
  generarMensajeViralGrupo,
  type CasoAuditoria,
} from '@/lib/auditor-engine'
import {
  IconArrowUpRight,
  IconCheck,
  IconCopy,
  IconShield,
  SpotlightTray,
  TabularNumber,
} from '@/components/ui/reactbits'

export function WidgetAuditorInteractivo({
  caso,
  casosDisponibles,
  onSelectCaso,
  mostrarSelectorInterno = true,
}: {
  caso: CasoAuditoria
  casosDisponibles?: CasoAuditoria[]
  onSelectCaso?: (nuevo: CasoAuditoria) => void
  mostrarSelectorInterno?: boolean
}) {
  const [copiadoReclamo, setCopiadoReclamo] = useState(false)
  const [verExpedienteCompleto, setVerExpedienteCompleto] = useState(false)

  const handleCopiarExpediente = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto)
    } catch {
      // Ignorar si no hay permiso de portapapeles
    }
    setCopiadoReclamo(true)
    window.setTimeout(() => setCopiadoReclamo(false), 2200)
  }

  return (
    <SpotlightTray
      variant="dark"
      aria-label="Radiografía financiera post-reserva en vivo"
      coreClassName="p-4 sm:p-6"
    >
      {/* Top Hardware Telemetry Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3.5">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-full bg-ancla-signal"
          />
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#d5d1c8]">
            {caso.tipo === 'hotel'
              ? 'MOTOR 01 · RE-PRICER + EXONERACIÓN IVA/IGV + NEGOCIADOR VIP'
              : 'MOTOR 02 · RESCATE DE TASAS AÉREAS + HOUSE MONEY CROSS-SELL'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded bg-white/8 px-2 py-0.5 font-mono text-[11px] tabular-nums text-[#b8b3a8]">
            {caso.tipo === 'hotel' ? caso.codigoConfirmacion : `PNR ${caso.pnr}`}
          </span>
          <span className="rounded bg-[#19674e]/35 border border-[#32a882]/40 px-2 py-0.5 font-mono text-[11px] text-[#8ef0cc]">
            {caso.tipo === 'hotel' ? '5 ARMAS DE AHORRO ACTIVAS' : '8 PODERES LEGALES Y COMERCIALES'}
          </span>
        </div>
      </div>

      {/* Optional Case Switcher Tabs */}
      {mostrarSelectorInterno && casosDisponibles && onSelectCaso ? (
        <div
          role="tablist"
          aria-label="Seleccionar reserva auditada de ejemplo"
          className="mt-3.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4"
        >
          {casosDisponibles.map((item) => {
            const activo = item.id === caso.id
            return (
              <button
                key={item.id}
                role="tab"
                type="button"
                aria-selected={activo}
                onClick={() => {
                  onSelectCaso(item)
                  setVerExpedienteCompleto(false)
                }}
                className={`press-scale rounded-lg border px-2.5 py-2 text-left transition-colors ${
                  activo
                    ? 'border-white/35 bg-white/12 text-[#fdfcfa]'
                    : 'border-white/8 bg-white/[0.03] text-[#9e998e] hover:border-white/20 hover:text-white'
                }`}
              >
                <span className="block font-mono text-[10px] uppercase tracking-wider text-ancla-signal">
                  {item.tipo === 'hotel' ? `HOTEL · ${item.ciudad}` : `VUELO · ${item.aerolinea}`}
                </span>
                <span className="mt-0.5 block truncate font-sans text-xs font-medium">
                  {item.tipo === 'hotel' ? item.hotelNombre : item.rutaIata}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}

      {/* BODY: EITHER HOTEL RE-PRICER OR FLIGHT TAX RECOVERY */}
      {caso.tipo === 'hotel' ? (
        <VistaRadiografiaHotel caso={caso} />
      ) : (
        <VistaRadiografiaVuelo
          caso={caso}
          copiadoReclamo={copiadoReclamo}
          verExpedienteCompleto={verExpedienteCompleto}
          onToggleExpediente={() => setVerExpedienteCompleto((v) => !v)}
          onCopiarExpediente={handleCopiarExpediente}
        />
      )}
    </SpotlightTray>
  )
}

function VistaRadiografiaHotel({
  caso,
}: {
  caso: Extract<CasoAuditoria, { tipo: 'hotel' }>
}) {
  const [copiadoVip, setCopiadoVip] = useState(false)
  const [copiadoViral, setCopiadoViral] = useState(false)
  const [verCartaVip, setVerCartaVip] = useState(false)

  const afiliados = construirEnlaceRebookingAfiliado(caso)
  const houseMoney = construirEnlacesHouseMoney(caso)
  const cartaNegociacion = generarMensajeNegociacionHotel(caso)
  const mensajeViral = generarMensajeViralGrupo(caso)

  const porcentajeAhorro = Math.round(
    (caso.ahorroNetoViajeroUsd / caso.precioPagadoUsd) * 100
  )
  const ahorroCombinadoConImpuestos =
    caso.ahorroNetoViajeroUsd +
    (caso.exoneracionTributaria?.ahorroTributarioEstimadoUsd ?? 0) +
    (caso.cargosFantasma?.ahorroEstimadoUsd ?? 0)

  const copiarCartaVip = async () => {
    try {
      await navigator.clipboard.writeText(cartaNegociacion)
    } catch {
      // Ignorar si el navegador bloquea clipboard
    }
    setCopiadoVip(true)
    window.setTimeout(() => setCopiadoVip(false), 2200)
  }

  const copiarPaseViral = async () => {
    try {
      await navigator.clipboard.writeText(mensajeViral)
    } catch {
      // Ignorar si el navegador bloquea clipboard
    }
    setCopiadoViral(true)
    window.setTimeout(() => setCopiadoViral(false), 2200)
  }

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Left 7 Cols: Price Arbitrage + Tax Exemption + VIP Hotel Negotiator + Phantom Fees */}
      <div className="rounded-xl border border-white/10 bg-[#0e0e0c] p-4 lg:col-span-7">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-[#9e998e]">
              RESERVA ORIGINAL DETECTADA EN {caso.canalOriginal.toUpperCase()}
            </span>
            <h3 className="mt-1 font-display text-lg font-semibold text-[#fdfcfa] sm:text-xl">
              {caso.hotelNombre}
            </h3>
            <p className="font-sans text-xs text-[#b8b3a8]">
              {caso.habitacion} · {caso.noches} noches ({caso.checkin} → {caso.checkout})
            </p>
          </div>

          <span className="rounded-full bg-white/8 px-2.5 py-1 font-mono text-[11px] text-[#e4e0d8]">
            Cancelación gratis hasta {caso.limiteCancelacionGratuita}
          </span>
        </div>

        {/* Visual Price Delta Bars */}
        <div className="mt-4 space-y-3 rounded-xl border border-white/8 bg-[#151512] p-3.5">
          <div>
            <div className="flex justify-between font-mono text-xs text-[#b8b3a8]">
              <span>Precio original ({caso.canalOriginal})</span>
              <span className="line-through">${caso.precioPagadoUsd} USD</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-full rounded-full bg-[#737068]" />
            </div>
          </div>

          <div>
            <div className="flex justify-between font-mono text-xs text-[#8ef0cc]">
              <span>1. Tarifa mayorista ({caso.proveedorMayorista})</span>
              <span className="font-semibold">
                <TabularNumber value={caso.tarifaMayoristaDetectadaUsd} prefix="$" suffix=" USD" /> (
                -{porcentajeAhorro}%)
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                style={{
                  width: `${Math.max(35, 100 - porcentajeAhorro)}%`,
                }}
                className="h-full rounded-full bg-[#32a882] transition-all duration-300 ease-out-strong"
              />
            </div>
          </div>
        </div>

        {/* ARMA SECRETA #2: Exoneración de IGV / IVA Hotelero en LATAM */}
        {caso.exoneracionTributaria ? (
          <div className="mt-3 rounded-xl border border-[#32a882]/35 bg-[#19674e]/15 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#8ef0cc]">
                ARMA #2 · EXONERACIÓN TRIBUTARIA: {caso.exoneracionTributaria.impuestoNombre}
              </span>
              <span className="rounded bg-[#19674e]/50 px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-[#fdfcfa]">
                +${caso.exoneracionTributaria.ahorroTributarioEstimadoUsd} USD extra
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[#d5d1c8]">
              <strong className="text-white">{caso.exoneracionTributaria.paisNorma}:</strong>{' '}
              {caso.exoneracionTributaria.requisitoCheckin}
            </p>
          </div>
        ) : null}

        {/* ARMA SECRETA #7: Auditor de Seguro Hotelero Voluntario y Cargos Fantasma en Check-in */}
        {caso.cargosFantasma ? (
          <div className="mt-2.5 rounded-xl border border-white/10 bg-[#141411] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-ancla-signal">
                ARMA #7 · ESCUDO ANTI-CARGOS FANTASMA EN CHECK-IN ({caso.cargosFantasma.cargoDetectado})
              </span>
              <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-[#8ef0cc]">
                +${caso.cargosFantasma.ahorroEstimadoUsd} USD evitados
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[#b8b3a8]">
              {caso.cargosFantasma.instruccionRechazoCheckin}
            </p>
          </div>
        ) : null}

        {/* ARMA SECRETA #3: Negociador Directo con Recepción (Contraoferta VIP) */}
        <div className="mt-2.5 rounded-xl border border-white/10 bg-[#131311] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-ancla-signal">
                ARMA #3 · NEGOCIADOR ANTI-PARIDAD + ALTERNATIVA A {caso.alternativaCercanaDistanciaMetros}M
              </span>
              <p className="text-xs text-[#e4e0d8]">
                {caso.alternativaCercanaNombre} a{' '}
                <strong className="font-mono text-[#8ef0cc]">
                  ${caso.alternativaCercanaPrecioUsd} USD
                </strong>{' '}
                o pide Upgrade VIP a recepción:
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setVerCartaVip((v) => !v)}
                className="font-mono text-[11px] text-[#b8b3a8] underline underline-offset-4 hover:text-white"
              >
                {verCartaVip ? 'Ocultar texto' : 'Ver mensaje VIP'}
              </button>
              <button
                type="button"
                onClick={copiarCartaVip}
                className="press-scale inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 font-mono text-[11px] text-[#fdfcfa] hover:bg-white/20"
              >
                {copiadoVip ? (
                  <>
                    <IconCheck className="h-3 w-3 text-[#8ef0cc]" />
                    <span>Contraoferta copiada</span>
                  </>
                ) : (
                  <>
                    <IconCopy className="h-3 w-3" />
                    <span>Copiar contraoferta al hotel</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {verCartaVip ? (
            <pre className="mt-2.5 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black p-3 font-mono text-[11px] leading-relaxed text-[#dfd9ce]">
              {cartaNegociacion}
            </pre>
          ) : null}
        </div>
      </div>

      {/* Right 5 Cols: Total Savings + Affiliate Re-Booking + House Money Cross-Sell + Viral Group Pass */}
      <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#141412] p-4 lg:col-span-5">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#8ef0cc]">
            POTENCIAL TOTAL DE AHORRO DETECTADO
          </span>

          <div
            aria-live="polite"
            className="mt-2 rounded-xl border border-[#32a882]/35 bg-[#19674e]/20 p-3.5"
          >
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[11px] uppercase text-[#b8f5de]">
                REBAJA MAYORISTA DIRECTA:
              </span>
              <span className="font-display text-2xl font-semibold text-[#fdfcfa]">
                <TabularNumber value={caso.ahorroNetoViajeroUsd} prefix="$" suffix=" USD" />
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline justify-between border-t border-white/10 pt-1.5 text-xs text-[#9ef0d2]">
              <span>+ Exoneración e Impuestos Check-in:</span>
              <span className="font-mono font-semibold tabular-nums">
                Hasta ${ahorroCombinadoConImpuestos} USD
              </span>
            </div>
          </div>

          {/* Direct Commission Telemetry for Luanna */}
          <div className="mt-3 rounded-xl border border-white/10 bg-[#0b0b0a] p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-ancla-signal">
                TU COMISIÓN HOTEL AFILIADO:
              </span>
              <span className="font-mono text-sm font-semibold text-[#8ef0cc]">
                <TabularNumber
                  value={caso.comisionDirectaLuannaUsd}
                  prefix="+$"
                  suffix=" USD"
                />
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-[#b8b3a8]">
              <span>+ Cross-sell eSIM / Seguro (Arma #1):</span>
              <span className="font-mono text-[#fdfcfa]">
                +${houseMoney.comisionExtraLuannaUsd} USD extra
              </span>
            </div>
          </div>

          {/* ARMA SECRETA #1: Efecto "Dinero Gratis" (House Money Cross-Sell) */}
          <div className="mt-3 rounded-xl border border-white/10 bg-[#191916] p-3">
            <span className="block font-mono text-[10px] uppercase tracking-wider text-ancla-signal">
              ARMA #1 · EFECTO DINERO GRATIS ({houseMoney.porcentajeDelAhorroUsado}% DE TU AHORRO):
            </span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <a
                href={houseMoney.urlEsimAfiliado}
                target="_blank"
                rel="noopener noreferrer"
                className="press-scale flex items-center justify-between rounded-lg border border-white/12 bg-black/50 px-2.5 py-2 font-mono text-[11px] text-[#fdfcfa] hover:border-white/30"
              >
                <span>eSIM 5GB ({caso.pais})</span>
                <IconArrowUpRight className="h-3 w-3 text-[#8ef0cc]" />
              </a>
              <a
                href={houseMoney.urlSeguroAfiliado}
                target="_blank"
                rel="noopener noreferrer"
                className="press-scale flex items-center justify-between rounded-lg border border-white/12 bg-black/50 px-2.5 py-2 font-mono text-[11px] text-[#fdfcfa] hover:border-white/30"
              >
                <span>Seguro Viaje VIP</span>
                <IconArrowUpRight className="h-3 w-3 text-[#8ef0cc]" />
              </a>
            </div>
          </div>
        </div>

        {/* Direct Affiliate Conversion Link + ARMA SECRETA #8: Multiplayer Viral Group Pass */}
        <div className="mt-4 space-y-2">
          <a
            href={afiliadosSafeUrl(afiliados.urlReservaDirecta)}
            target="_blank"
            rel="noopener noreferrer"
            className="press-scale flex w-full items-center justify-between rounded-full bg-[#fdfcfa] px-4 py-3 font-sans text-xs font-semibold text-[#11110f] transition-colors hover:bg-[#e5e1d8]"
          >
            <span>
              1. Reservar tarifa de ${caso.tarifaMayoristaDetectadaUsd} USD ahora
            </span>
            <IconArrowUpRight className="h-4 w-4" />
          </a>

          <button
            type="button"
            onClick={copiarPaseViral}
            className="press-scale flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 font-mono text-[11px] text-[#d5d1c8] hover:border-white/30 hover:text-white"
          >
            {copiadoViral ? (
              <>
                <IconCheck className="h-3.5 w-3.5 text-[#8ef0cc]" />
                <span>Alerta grupal copiada para tus compañeros de viaje</span>
              </>
            ) : (
              <>
                <IconCopy className="h-3.5 w-3.5" />
                <span>Arma #8 · Compartir hallazgo con mi grupo de viaje</span>
              </>
            )}
          </button>

          <p className="text-center font-mono text-[11px] text-[#9e998e]">
            Paso 2: Tras recibir el nuevo voucher, cancela sin costo en {caso.canalOriginal}
          </p>
        </div>
      </div>
    </div>
  )
}

function VistaRadiografiaVuelo({
  caso,
  copiadoReclamo,
  verExpedienteCompleto,
  onToggleExpediente,
  onCopiarExpediente,
}: {
  caso: Extract<CasoAuditoria, { tipo: 'vuelo' }>
  copiadoReclamo: boolean
  verExpedienteCompleto: boolean
  onToggleExpediente: () => void
  onCopiarExpediente: (texto: string) => void
}) {
  const [modoEscrito, setModoEscrito] = useState<
    'tasas-noshow' | 'schedule-change' | 'endoso-tercero' | 'equipaje-ancillaries'
  >('tasas-noshow')
  const [copiadoViralVuelo, setCopiadoViralVuelo] = useState(false)

  const expedienteTexto =
    modoEscrito === 'tasas-noshow'
      ? generarExpedienteReclamo(caso)
      : generarEscritoPoderEspecialVuelo(caso, modoEscrito)

  const houseMoney = construirEnlacesHouseMoney(caso)
  const mensajeViral = generarMensajeViralGrupo(caso)
  const porcentajeRecuperable = Math.round(
    (caso.totalRecuperablePasajeroUsd / caso.precioBoletoPagadoUsd) * 100
  )

  const copiarPaseViralVuelo = async () => {
    try {
      await navigator.clipboard.writeText(mensajeViral)
    } catch {
      // Ignorar si no hay permiso de portapapeles
    }
    setCopiadoViralVuelo(true)
    window.setTimeout(() => setCopiadoViralVuelo(false), 2200)
  }

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Left 7 Cols: Forensic Tax & Compensation Dissection + Weapons #4, #5, #6 */}
      <div className="rounded-xl border border-white/10 bg-[#0e0e0c] p-4 lg:col-span-7">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-ancla-signal">
              {caso.aerolinea} · {caso.rutaIata} · PNR {caso.pnr}
            </span>
            <h3 className="mt-1 font-display text-lg font-semibold text-[#fdfcfa] sm:text-xl">
              {caso.etiquetaIncidencia}
            </h3>
          </div>
          <span className="rounded-full bg-white/8 px-2.5 py-1 font-mono text-[11px] text-[#e4e0d8]">
            {caso.jurisdiccion}
          </span>
        </div>

        {/* Breakdown of Base Fare vs Refundable Taxes */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-white/8 bg-[#151512] p-3">
            <span className="font-mono text-[10px] uppercase text-[#9e998e]">
              TARIFA BASE AEROLÍNEA (RETENIDA)
            </span>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-[#9e998e]">
              ${caso.tarifaBaseNoReembolsableUsd} USD
            </p>
            <span className="text-[11px] text-[#737068]">
              100% rescatable si activas Arma #4 o #5
            </span>
          </div>

          <div className="rounded-lg border border-[#32a882]/40 bg-[#19674e]/20 p-3">
            <span className="font-mono text-[10px] uppercase text-[#8ef0cc]">
              TASAS / COMPENSACIÓN DE LEY
            </span>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-[#fdfcfa]">
              +${caso.totalRecuperablePasajeroUsd} USD ({porcentajeRecuperable}%)
            </p>
            <span className="text-[11px] text-[#9ef0d2]">
              100% reembolsable a tarjeta original
            </span>
          </div>
        </div>

        {/* Itemized Tax Codes */}
        <div className="mt-3 space-y-1.5">
          <span className="block font-mono text-[10px] uppercase tracking-wider text-[#9e998e]">
            DESGLOSE DE CONCEPTOS EXIGIBLES DETECTADOS POR CLAUDE:
          </span>
          {caso.tasasDesglose.map((tasa) => (
            <div
              key={tasa.codigo}
              className="flex items-center justify-between rounded-lg border border-white/8 bg-[#141412] px-3 py-1.5 text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#fdfcfa]">
                  {tasa.codigo}
                </span>
                <span className="text-[#d5d1c8]">{tasa.concepto}</span>
              </div>
              <span className="shrink-0 font-mono font-semibold tabular-nums text-[#8ef0cc]">
                +${tasa.montoUsd} USD
              </span>
            </div>
          ))}
        </div>

        {/* ARMAS SECRETAS #4, #5 y #6: Selector de Poderes Especiales de Vuelo */}
        <div className="mt-3 rounded-xl border border-white/10 bg-[#141411] p-3">
          <span className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-ancla-signal">
            SELECCIONA EL PODER LEGAL A EJECUTAR (ARMAS #4 · #5 · #6):
          </span>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => setModoEscrito('tasas-noshow')}
              className={`rounded-lg border px-2 py-1.5 text-left font-mono text-[10px] transition-colors ${
                modoEscrito === 'tasas-noshow'
                  ? 'border-[#32a882] bg-[#19674e]/30 text-[#fdfcfa]'
                  : 'border-white/10 bg-black/40 text-[#9e998e] hover:text-white'
              }`}
            >
              <span className="block font-semibold text-[#8ef0cc]">TASAS LEY</span>
              <span className="block truncate">+${caso.totalRecuperablePasajeroUsd} USD</span>
            </button>

            <button
              type="button"
              onClick={() => setModoEscrito('schedule-change')}
              className={`rounded-lg border px-2 py-1.5 text-left font-mono text-[10px] transition-colors ${
                modoEscrito === 'schedule-change'
                  ? 'border-[#32a882] bg-[#19674e]/30 text-[#fdfcfa]'
                  : 'border-white/10 bg-black/40 text-[#9e998e] hover:text-white'
              }`}
            >
              <span className="block font-semibold text-ancla-signal">ARMA #4 · HORARIO</span>
              <span className="block truncate">100% (${caso.precioBoletoPagadoUsd} USD)</span>
            </button>

            <button
              type="button"
              onClick={() => setModoEscrito('endoso-tercero')}
              className={`rounded-lg border px-2 py-1.5 text-left font-mono text-[10px] transition-colors ${
                modoEscrito === 'endoso-tercero'
                  ? 'border-[#32a882] bg-[#19674e]/30 text-[#fdfcfa]'
                  : 'border-white/10 bg-black/40 text-[#9e998e] hover:text-white'
              }`}
            >
              <span className="block font-semibold text-[#8ef0cc]">ARMA #5 · ENDOSO</span>
              <span className="block truncate">Cambiar pasajero</span>
            </button>

            <button
              type="button"
              onClick={() => setModoEscrito('equipaje-ancillaries')}
              className={`rounded-lg border px-2 py-1.5 text-left font-mono text-[10px] transition-colors ${
                modoEscrito === 'equipaje-ancillaries'
                  ? 'border-[#32a882] bg-[#19674e]/30 text-[#fdfcfa]'
                  : 'border-white/10 bg-black/40 text-[#9e998e] hover:text-white'
              }`}
            >
              <span className="block font-semibold text-ancla-signal">ARMA #6 · EQUIPAJE</span>
              <span className="block truncate">Hasta $1,680 USD</span>
            </button>
          </div>
          {caso.poderesEspecialesVuelo ? (
            <p className="mt-2 text-[11px] leading-relaxed text-[#b8b3a8]">
              {modoEscrito === 'schedule-change' &&
                `Cambio de horario >15-60 min: exige reembolso del 100% ($${caso.poderesEspecialesVuelo.ReembolsoTotalPorCambioHorarioUsd} USD) o recompra con $${caso.poderesEspecialesVuelo.ahorroRecompraVueloMasBaratoUsd} USD de ahorro.`}
              {modoEscrito === 'endoso-tercero' &&
                `${caso.poderesEspecialesVuelo.normaEndoso} (costo legal máximo: $${caso.poderesEspecialesVuelo.costoMaximoEndosoLeyUsd} USD).`}
              {modoEscrito === 'equipaje-ancillaries' &&
                `Reembolso de asiento/maleta no respetado + Convenio de Montreal hasta $${caso.poderesEspecialesVuelo.reclamoEquipajeMontrealMaxUsd} USD (1,288 DEG).`}
              {modoEscrito === 'tasas-noshow' &&
                'Reclamo directo de tasas aeroportuarias no devengadas y compensación legal.'}
            </p>
          ) : null}
        </div>

        {/* Collapsible Legal Document Preview */}
        <div className="mt-3 border-t border-white/10 pt-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#b8b3a8]">
              <IconShield className="h-3.5 w-3.5 text-[#8ef0cc]" />
              <span>Fundamento: {caso.jurisdiccion}</span>
            </span>
            <button
              type="button"
              onClick={onToggleExpediente}
              aria-expanded={verExpedienteCompleto}
              className="font-mono text-xs font-medium text-[#8ef0cc] underline underline-offset-4 hover:text-white"
            >
              {verExpedienteCompleto
                ? 'Ocultar expediente legal'
                : 'Ver escrito legal autogenerado'}
            </button>
          </div>

          {verExpedienteCompleto ? (
            <pre className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/12 bg-black p-3 font-mono text-[11px] leading-relaxed text-[#dfd9ce]">
              {expedienteTexto}
            </pre>
          ) : null}
        </div>
      </div>

      {/* Right 5 Cols: Zero-Stopper Direct Refund Execution + House Money Monetization + Viral Pass */}
      <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#141412] p-4 lg:col-span-5">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#8ef0cc]">
            EJECUCIÓN DIRECTA + MONETIZACIÓN AFILIADA
          </span>

          <div
            aria-live="polite"
            className="mt-2 rounded-xl border border-[#32a882]/35 bg-[#19674e]/20 p-3.5"
          >
            <span className="font-mono text-[11px] uppercase text-[#b8f5de]">
              {modoEscrito === 'schedule-change'
                ? 'REEMBOLSO 100% POR CAMBIO DE HORARIO'
                : 'MONTO A RECUPERAR POR EL PASAJERO'}
            </span>
            <p className="mt-1 font-display text-3xl font-semibold text-[#fdfcfa]">
              <TabularNumber
                value={
                  modoEscrito === 'schedule-change'
                    ? caso.precioBoletoPagadoUsd
                    : caso.totalRecuperablePasajeroUsd
                }
                prefix="$"
                suffix=" USD"
              />
            </p>
            <p className="mt-1 text-xs text-[#d5d1c8]">
              La aerolínea deposita directo a la tarjeta con la que se compró el pasaje.
            </p>
          </div>

          {/* ARMA SECRETA #1 EN VUELOS: Convierte un usuario gratuito de vuelo en comisión directa */}
          <div className="mt-3 rounded-xl border border-white/10 bg-[#191916] p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-ancla-signal">
                ARMA #1 · REPROGRAMA CON EL {houseMoney.porcentajeDelAhorroUsado}% DE TU REEMBOLSO:
              </span>
              <span className="font-mono text-[10px] text-[#8ef0cc]">
                +${houseMoney.comisionExtraLuannaUsd} USD comisión Luanna
              </span>
            </div>

            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
              {houseMoney.urlVueloAlternativo ? (
                <a
                  href={houseMoney.urlVueloAlternativo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="press-scale flex items-center justify-between rounded-lg border border-white/12 bg-black/50 px-2.5 py-2 font-mono text-[11px] text-[#fdfcfa] hover:border-white/30"
                >
                  <span>Nuevo Vuelo</span>
                  <IconArrowUpRight className="h-3 w-3 text-[#8ef0cc]" />
                </a>
              ) : null}
              <a
                href={houseMoney.urlEsimAfiliado}
                target="_blank"
                rel="noopener noreferrer"
                className="press-scale flex items-center justify-between rounded-lg border border-white/12 bg-black/50 px-2.5 py-2 font-mono text-[11px] text-[#fdfcfa] hover:border-white/30"
              >
                <span>eSIM 5GB</span>
                <IconArrowUpRight className="h-3 w-3 text-[#8ef0cc]" />
              </a>
              <a
                href={houseMoney.urlSeguroAfiliado}
                target="_blank"
                rel="noopener noreferrer"
                className="press-scale flex items-center justify-between rounded-lg border border-white/12 bg-black/50 px-2.5 py-2 font-mono text-[11px] text-[#fdfcfa] hover:border-white/30"
              >
                <span>Seguro Anti-NoShow</span>
                <IconArrowUpRight className="h-3 w-3 text-[#8ef0cc]" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => onCopiarExpediente(expedienteTexto)}
            className="press-scale flex w-full items-center justify-center gap-2 rounded-full bg-[#fdfcfa] px-4 py-3 font-sans text-xs font-semibold text-[#11110f] transition-colors hover:bg-[#e5e1d8]"
          >
            {copiadoReclamo ? (
              <>
                <IconCheck className="h-4 w-4 text-ancla-clinical" />
                <span>Escrito legal copiado al portapapeles</span>
              </>
            ) : (
              <>
                <IconCopy className="h-4 w-4" />
                <span>1. Copiar escrito seleccionado ({caso.pnr})</span>
              </>
            )}
          </button>

          <a
            href={caso.urlPortalDevolucionAerolinea}
            target="_blank"
            rel="noopener noreferrer"
            className="press-scale flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2.5 font-sans text-xs font-medium text-white hover:bg-white/12"
          >
            <span>2. Pegar en portal oficial de {caso.aerolinea}</span>
            <IconArrowUpRight className="h-3.5 w-3.5" />
          </a>

          <button
            type="button"
            onClick={copiarPaseViralVuelo}
            className="press-scale flex w-full items-center justify-center gap-2 rounded-full border border-white/12 bg-transparent px-4 py-2 font-mono text-[11px] text-[#b8b3a8] hover:border-white/30 hover:text-white"
          >
            {copiadoViralVuelo ? (
              <>
                <IconCheck className="h-3.5 w-3.5 text-[#8ef0cc]" />
                <span>Alerta copiada para pasajeros del mismo vuelo</span>
              </>
            ) : (
              <>
                <IconCopy className="h-3.5 w-3.5" />
                <span>Arma #8 · Avisar a compañeros del vuelo {caso.rutaIata}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function afiliadosSafeUrl(url: string): string {
  return url || 'https://search.hotellook.com/'
}

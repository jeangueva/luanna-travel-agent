'use client'

import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  CASOS_AUDITORIA_DEMO,
  analizarTextoReservaDeterminista,
  construirEnlaceRebookingAfiliado,
  construirEnlacesHouseMoney,
  type CasoAuditoria,
  type TipoAuditoria,
} from '@/lib/auditor-engine'
import {
  IconArrowUpRight,
  IconCheck,
  IconCopy,
  IconCrosshair,
  IconTerminal,
  SegmentedControl,
  SpotlightTray,
  TabularNumber,
} from '@/components/ui/reactbits'
import { WidgetAuditorInteractivo } from '@/components/WidgetAnclaInteractivo'

const PLANTILLAS_PRUEBA = {
  hotel: `Confirmación Booking.com #BKG-992140
Hotel: JW Marriott El Convento Cusco
Check-in: 2026-12-14 | Check-out: 2026-12-18 (4 noches)
Habitación: Deluxe King con Cancelación Gratuita hasta 12 Dic
Total pagado: $920.00 USD`,
  vuelo: `Confirmación LATAM Airlines PNR: M7X4LP
Ruta: LIM -> BOG -> LIM (Boleto No Volado / No-Show)
Tarifa Light No Reembolsable
Total pagado: $385.00 USD (Incluye TUUA Lima + Tasa Aerocivil Bogotá + Impuestos de Salida)`,
}

interface ArchivoAdjunto {
  nombre: string
  mime: string
  base64: string
  tamanoKb: number
}

export function ConsolaAncla({
  onVolverLanding,
}: {
  onVolverLanding?: () => void
}) {
  const formId = useId()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [boveda, setBoveda] = useState<CasoAuditoria[]>(CASOS_AUDITORIA_DEMO)
  const [filtroTipo, setFiltroTipo] = useState<'todos' | TipoAuditoria>('todos')
  const [casoActivoId, setCasoActivoId] = useState<string>(CASOS_AUDITORIA_DEMO[0].id)

  // Live scanner input state (Text + PDF/Image + Email alert)
  const [textoVoucher, setTextoVoucher] = useState<string>('')
  const [archivoAdjunto, setArchivoAdjunto] = useState<ArchivoAdjunto | null>(null)
  const [emailAlerta, setEmailAlerta] = useState<string>('')
  const [procesando, setProcesando] = useState<boolean>(false)
  const [ultimoMotorUsado, setUltimoMotorUsado] = useState<string>('Listo para escanear')
  const [avisoPersistencia, setAvisoPersistencia] = useState<string>('')
  const [copiadoCorreo, setCopiadoCorreo] = useState<boolean>(false)

  // Load persisted reservations from Neon Postgres on mount
  useEffect(() => {
    let cancelado = false
    fetch('/api/auditar')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { casos?: CasoAuditoria[]; fuente?: string } | null) => {
        if (cancelado || !data?.casos?.length) return
        setBoveda(data.casos)
        setCasoActivoId(data.casos[0].id)
        if (data.fuente === 'neon') {
          setUltimoMotorUsado('Sincronizado con Neon DB')
        }
      })
      .catch(() => {
        // Mantiene catálogo inicial si está offline
      })
    return () => {
      cancelado = true
    }
  }, [])

  const casoActivo = useMemo(
    () => boveda.find((c) => c.id === casoActivoId) ?? boveda[0],
    [boveda, casoActivoId]
  )

  const casosFiltrados = useMemo(() => {
    if (filtroTipo === 'todos') return boveda
    return boveda.filter((c) => c.tipo === filtroTipo)
  }, [boveda, filtroTipo])

  // Aggregate vault metrics across all 8 Secret Weapons
  const metricasBoveda = useMemo(() => {
    let totalAhorroHoteles = 0
    let totalTasasVuelos = 0
    let totalComisionAfiliadaLuanna = 0

    for (const item of boveda) {
      const hm = construirEnlacesHouseMoney(item)
      if (item.tipo === 'hotel') {
        totalAhorroHoteles +=
          item.ahorroNetoViajeroUsd +
          (item.exoneracionTributaria?.ahorroTributarioEstimadoUsd ?? 0) +
          (item.cargosFantasma?.ahorroEstimadoUsd ?? 0)
        totalComisionAfiliadaLuanna +=
          item.comisionDirectaLuannaUsd + hm.comisionExtraLuannaUsd
      } else {
        totalTasasVuelos += item.totalRecuperablePasajeroUsd
        totalComisionAfiliadaLuanna += hm.comisionExtraLuannaUsd
      }
    }

    return {
      totalAhorroHoteles,
      totalTasasVuelos,
      totalRecuperadoClientes: totalAhorroHoteles + totalTasasVuelos,
      totalComisionAfiliadaLuanna,
    }
  }, [boveda])

  const handleSeleccionarArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 4.5 * 1024 * 1024) {
      setAvisoPersistencia('El archivo supera 4.5 MB. Usa un PDF o captura más ligera.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const resultado = typeof reader.result === 'string' ? reader.result : ''
      if (resultado) {
        setArchivoAdjunto({
          nombre: file.name,
          mime: file.type || 'application/pdf',
          base64: resultado,
          tamanoKb: Math.max(1, Math.round(file.size / 1024)),
        })
        setAvisoPersistencia('')
      }
    }
    reader.readAsDataURL(file)
  }

  const handleAuditarTexto = async (e: React.FormEvent) => {
    e.preventDefault()
    const limpio = textoVoucher.trim()
    if (!limpio && !archivoAdjunto) return

    setProcesando(true)
    setAvisoPersistencia('')
    try {
      const response = await fetch('/api/auditar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          texto: limpio,
          archivoBase64: archivoAdjunto?.base64,
          archivoMime: archivoAdjunto?.mime,
          archivoNombre: archivoAdjunto?.nombre,
          email: emailAlerta.trim() || undefined,
        }),
      })

      if (response.ok) {
        const data = (await response.json()) as {
          caso: CasoAuditoria
          motor: string
          persistidoEnNeon?: boolean
          correoEnviado?: boolean
        }
        setBoveda((prev) => [data.caso, ...prev])
        setCasoActivoId(data.caso.id)
        setUltimoMotorUsado(
          data.motor === 'claude-vision-pdf'
            ? 'PDF/Imagen auditado con Claude'
            : data.motor === 'claude-api'
              ? 'Auditado con Claude API'
              : 'Auditado al instante'
        )
        const badges: string[] = []
        if (data.persistidoEnNeon) badges.push('Guardado en Neon Postgres')
        if (data.correoEnviado) badges.push(`Alerta enviada a ${emailAlerta.trim()}`)
        setAvisoPersistencia(badges.join(' · '))
      } else {
        const local = analizarTextoReservaDeterminista(
          limpio || archivoAdjunto?.nombre || 'Reserva Hotel $720'
        )
        setBoveda((prev) => [local, ...prev])
        setCasoActivoId(local.id)
        setUltimoMotorUsado('Auditado en modo local')
      }
    } catch {
      const local = analizarTextoReservaDeterminista(
        limpio || archivoAdjunto?.nombre || 'Reserva Hotel $720'
      )
      setBoveda((prev) => [local, ...prev])
      setCasoActivoId(local.id)
      setUltimoMotorUsado('Auditado en modo local')
    } finally {
      setProcesando(false)
      setTextoVoucher('')
      setArchivoAdjunto(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleCopiarCorreoIngesta = async () => {
    try {
      await navigator.clipboard.writeText('auditoria@luanna.app')
    } catch {
      // Ignorar si no hay permiso
    }
    setCopiadoCorreo(true)
    window.setTimeout(() => setCopiadoCorreo(false), 2000)
  }

  return (
    <section
      aria-labelledby="consola-heading"
      className="mx-auto max-w-[1380px] px-4 py-8 sm:px-8 sm:py-12"
    >
      {/* Top Studio Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-ancla-line pb-6 lg:flex-row lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ancla-obsidian px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-[#fdfcfa]">
              <IconCrosshair className="h-3.5 w-3.5 text-ancla-signal" />
              <span>BÓVEDA DE AUDITORÍA POST-RESERVA</span>
            </span>
            <span className="rounded-full bg-ancla-clinicalSoft px-3 py-1 font-mono text-[11px] font-medium text-ancla-clinical">
              Claude PDF/Vision + Neon DB + Resend + Stay22/TP Activos
            </span>
          </div>

          <h1
            id="consola-heading"
            className="mt-3 font-display text-2xl font-semibold tracking-[-0.025em] text-ancla-ink sm:text-3xl"
          >
            Centro de Arbitraje de Hoteles &amp; Rescate de Tasas Aéreas
          </h1>
          <p className="mt-1 max-w-[70ch] text-sm text-ancla-inkSecondary">
            Sube tu PDF o captura de pantalla de Booking, Expedia o aerolínea, o pega el correo de confirmación. Guardamos el monitoreo en Neon Postgres y enviamos el enlace afiliado de ahorro o el escrito legal directo a tu correo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onVolverLanding ? (
            <button
              type="button"
              onClick={onVolverLanding}
              className="press-scale rounded-full border border-ancla-lineStrong bg-ancla-paper px-4 py-2 font-sans text-xs font-medium text-ancla-ink hover:border-ancla-ink"
            >
              ← Volver a la portada
            </button>
          ) : (
            <a
              href="/"
              className="press-scale rounded-full border border-ancla-lineStrong bg-ancla-paper px-4 py-2 font-sans text-xs font-medium text-ancla-ink hover:border-ancla-ink"
            >
              ← Volver a la portada
            </a>
          )}

          <button
            type="button"
            onClick={handleCopiarCorreoIngesta}
            className="press-scale inline-flex items-center gap-2 rounded-full bg-ancla-obsidian px-4 py-2 font-mono text-xs text-[#fdfcfa] hover:bg-black"
          >
            {copiadoCorreo ? (
              <>
                <IconCheck className="h-3.5 w-3.5 text-[#8ef0cc]" />
                <span>auditoria@luanna.app copiado</span>
              </>
            ) : (
              <>
                <IconCopy className="h-3.5 w-3.5" />
                <span>Bandeja: auditoria@luanna.app</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Live Vault Telemetry Summary */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SpotlightTray variant="light" coreClassName="p-4">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ancla-inkMuted">
            DINERO TOTAL DETECTADO A CLIENTES
          </span>
          <p className="mt-1 font-display text-2xl font-semibold text-ancla-ink">
            <TabularNumber
              value={metricasBoveda.totalRecuperadoClientes}
              prefix="$"
              suffix=" USD"
            />
          </p>
          <span className="font-mono text-[11px] text-ancla-inkSecondary">
            En {boveda.length} reservas activas en bóveda
          </span>
        </SpotlightTray>

        <SpotlightTray variant="light" coreClassName="p-4">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ancla-inkMuted">
            AHORRO EN HOTELES (RE-PRICER)
          </span>
          <p className="mt-1 font-display text-2xl font-semibold text-ancla-ink">
            <TabularNumber
              value={metricasBoveda.totalAhorroHoteles}
              prefix="$"
              suffix=" USD"
            />
          </p>
          <span className="font-mono text-[11px] text-ancla-clinical">
            100% gratis para el viajero
          </span>
        </SpotlightTray>

        <SpotlightTray variant="light" coreClassName="p-4">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ancla-inkMuted">
            TASAS Y COMPENSACIONES AÉREAS
          </span>
          <p className="mt-1 font-display text-2xl font-semibold text-ancla-ink">
            <TabularNumber
              value={metricasBoveda.totalTasasVuelos}
              prefix="$"
              suffix=" USD"
            />
          </p>
          <span className="font-mono text-[11px] text-ancla-inkSecondary">
            TUUA / Aerocivil / RAC 3 / Profeco
          </span>
        </SpotlightTray>

        <SpotlightTray variant="light" coreClassName="p-4">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ancla-signal">
            TU COMISIÓN AFILIADA DIRECTA
          </span>
          <p className="mt-1 font-display text-2xl font-semibold text-ancla-clinical">
            <TabularNumber
              value={metricasBoveda.totalComisionAfiliadaLuanna}
              prefix="+$"
              suffix=" USD"
            />
          </p>
          <span className="font-mono text-[11px] text-ancla-inkSecondary">
            Vía Stay22 + Travelpayouts
          </span>
        </SpotlightTray>
      </div>

      {/* Main Workspace Grid: Left Scanner & Vault List (5 cols) + Right Forensic Radiograph (7 cols) */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left 5 Cols: Live Scanner Input + Audited Reservations List */}
        <div className="space-y-6 lg:col-span-5">
          {/* 1. Live Claude Voucher + PDF/Image Scanner */}
          <SpotlightTray variant="light" coreClassName="p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ancla-ink">
                01 · ESCÁNER DE RESERVA (PDF, CAPTURA O TEXTO)
              </h2>
              <span className="font-mono text-[11px] text-ancla-clinical">
                {ultimoMotorUsado}
              </span>
            </div>

            <form onSubmit={handleAuditarTexto} className="mt-3 space-y-3">
              {/* File Upload Dropzone */}
              <div>
                <input
                  ref={fileInputRef}
                  id={`${formId}-file`}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  onChange={handleSeleccionarArchivo}
                  className="sr-only"
                />
                <div className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-ancla-lineStrong bg-ancla-canvas/80 px-3.5 py-2.5">
                  <div className="truncate">
                    <span className="block font-mono text-[10px] uppercase tracking-wider text-ancla-inkMuted">
                      ARCHIVO DE RESERVA O PASAJE (OPCIONAL)
                    </span>
                    <span className="block truncate font-sans text-xs font-medium text-ancla-ink">
                      {archivoAdjunto
                        ? `${archivoAdjunto.nombre} (${archivoAdjunto.tamanoKb} KB)`
                        : 'PDF de Booking/LATAM o captura PNG/JPG'}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {archivoAdjunto ? (
                      <button
                        type="button"
                        onClick={() => {
                          setArchivoAdjunto(null)
                          if (fileInputRef.current) fileInputRef.current.value = ''
                        }}
                        className="rounded-full border border-ancla-lineStrong bg-white px-2.5 py-1 font-mono text-[11px] text-ancla-signal"
                      >
                        Quitar
                      </button>
                    ) : null}
                    <label
                      htmlFor={`${formId}-file`}
                      className="press-scale cursor-pointer rounded-full bg-ancla-obsidian px-3 py-1.5 font-mono text-[11px] text-white hover:bg-black"
                    >
                      Subir PDF / Foto
                    </label>
                  </div>
                </div>
              </div>

              {/* Raw Text Input */}
              <div>
                <label htmlFor={`${formId}-voucher`} className="sr-only">
                  Pegar texto de confirmación de hotel o boleto de avión
                </label>
                <textarea
                  id={`${formId}-voucher`}
                  rows={3}
                  value={textoVoucher}
                  onChange={(e) => setTextoVoucher(e.target.value)}
                  placeholder="O pega aquí el texto del correo de Booking.com, Expedia o aerolínea..."
                  className="w-full rounded-xl border border-ancla-lineStrong bg-white p-3 font-mono text-xs leading-relaxed text-ancla-ink placeholder:text-ancla-inkMuted"
                />
              </div>

              {/* Optional Email for Resend Alert + Neon Persistence */}
              <div>
                <label
                  htmlFor={`${formId}-email-alerta`}
                  className="block font-mono text-[10px] uppercase tracking-wider text-ancla-inkMuted"
                >
                  CORREO PARA RECIBIR EL ENLACE DE AHORRO O ESCRITO LEGAL (OPCIONAL):
                </label>
                <input
                  id={`${formId}-email-alerta`}
                  type="email"
                  value={emailAlerta}
                  onChange={(e) => setEmailAlerta(e.target.value)}
                  placeholder="viajero@tuempresa.com"
                  className="mt-1 w-full rounded-lg border border-ancla-lineStrong bg-white px-3 py-2 font-sans text-xs text-ancla-ink placeholder:text-ancla-inkMuted"
                />
              </div>

              {/* Quick Test Preset Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[10px] uppercase text-ancla-inkMuted">
                  PLANTILLAS RÁPIDAS:
                </span>
                <button
                  type="button"
                  onClick={() => setTextoVoucher(PLANTILLAS_PRUEBA.hotel)}
                  className="rounded-full border border-ancla-lineStrong bg-ancla-canvas px-2.5 py-1 font-mono text-[11px] text-ancla-ink hover:border-ancla-ink"
                >
                  + Hotel Cusco ($920)
                </button>
                <button
                  type="button"
                  onClick={() => setTextoVoucher(PLANTILLAS_PRUEBA.vuelo)}
                  className="rounded-full border border-ancla-lineStrong bg-ancla-canvas px-2.5 py-1 font-mono text-[11px] text-ancla-ink hover:border-ancla-ink"
                >
                  + Vuelo No Volado ($385)
                </button>
              </div>

              {avisoPersistencia ? (
                <p
                  role="status"
                  aria-live="polite"
                  className="rounded-lg bg-ancla-clinicalSoft px-3 py-1.5 font-mono text-[11px] text-ancla-clinical"
                >
                  {avisoPersistencia}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={procesando || (!textoVoucher.trim() && !archivoAdjunto)}
                className="press-scale w-full rounded-full bg-ancla-obsidian py-2.5 font-sans text-xs font-semibold text-white transition-colors hover:bg-black disabled:opacity-50"
              >
                {procesando
                  ? 'Auditando con Claude y verificando tarifas...'
                  : 'Auditar reserva y guardar en bóveda →'}
              </button>
            </form>
          </SpotlightTray>

          {/* 2. Active Vault Queue */}
          <SpotlightTray variant="light" coreClassName="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ancla-inkSecondary">
                02 · COLA ACTIVA DE AUDITORÍA ({casosFiltrados.length})
              </h2>
              <SegmentedControl
                ariaLabel="Filtrar bóveda por tipo de reserva"
                size="sm"
                options={[
                  { id: 'todos', label: 'Todas' },
                  { id: 'hotel', label: 'Hoteles' },
                  { id: 'vuelo', label: 'Vuelos' },
                ]}
                value={filtroTipo}
                onChange={setFiltroTipo}
              />
            </div>

            <div
              role="listbox"
              aria-label="Reservas monitoreadas en bóveda"
              className="mt-4 space-y-2"
            >
              {casosFiltrados.map((item) => {
                const activo = item.id === casoActivo.id
                const montoRecuperable =
                  item.tipo === 'hotel'
                    ? item.ahorroNetoViajeroUsd
                    : item.totalRecuperablePasajeroUsd

                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={activo}
                    onClick={() => setCasoActivoId(item.id)}
                    className={`press-scale w-full rounded-xl border p-3.5 text-left transition-colors ${
                      activo
                        ? 'border-ancla-ink bg-ancla-obsidian text-[#fdfcfa]'
                        : 'border-ancla-line bg-ancla-canvas/60 text-ancla-ink hover:border-ancla-lineStrong'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                          item.tipo === 'hotel'
                            ? activo
                              ? 'bg-[#19674e] text-[#b4f5dc]'
                              : 'bg-ancla-clinicalSoft text-ancla-clinical'
                            : activo
                              ? 'bg-ancla-signal text-white'
                              : 'bg-ancla-signalSoft text-ancla-signal'
                        }`}
                      >
                        {item.tipo === 'hotel'
                          ? `HOTEL · ${item.canalOriginal}`
                          : `VUELO · ${item.aerolinea}`}
                      </span>
                      <span
                        className={`font-mono text-xs font-semibold tabular-nums ${
                          activo ? 'text-[#8ef0cc]' : 'text-ancla-clinical'
                        }`}
                      >
                        +${montoRecuperable} USD
                      </span>
                    </div>

                    <p className="mt-1.5 font-display text-sm font-semibold">
                      {item.tipo === 'hotel'
                        ? `${item.hotelNombre} (${item.ciudad})`
                        : `${item.rutaIata} · PNR ${item.pnr}`}
                    </p>

                    <p
                      className={`mt-0.5 text-xs ${
                        activo ? 'text-[#d5d1c8]' : 'text-ancla-inkSecondary'
                      }`}
                    >
                      {item.tipo === 'hotel'
                        ? `Pagó $${item.precioPagadoUsd} → Detectado a $${item.tarifaMayoristaDetectadaUsd} (Tu comisión: +$${item.comisionDirectaLuannaUsd})`
                        : item.etiquetaIncidencia}
                    </p>
                  </button>
                )
              })}
            </div>
          </SpotlightTray>
        </div>

        {/* Right 7 Cols: Live Interactive Forensic Radiograph + Email Ingestion Architecture */}
        <div className="space-y-6 lg:col-span-7">
          <WidgetAuditorInteractivo
            caso={casoActivo}
            mostrarSelectorInterno={false}
          />

          {/* Automated Inbox & Affiliate Conversion Pipeline Card */}
          <SpotlightTray variant="light" coreClassName="p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <IconTerminal className="h-4 w-4 text-ancla-signal" />
              <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ancla-ink">
                03 · PIPELINE DE PRODUCCIÓN (CLOUDFLARE EMAIL + NEON DB + RESEND)
              </h2>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-ancla-line bg-ancla-canvas/70 p-3.5">
                <span className="font-mono text-[10px] font-semibold uppercase text-ancla-signal">
                  PASO 01 · INGESTIÓN MULTIMODAL
                </span>
                <p className="mt-1 font-display text-sm font-semibold text-ancla-ink">
                  PDF, Foto o Email Worker
                </p>
                <p className="mt-1 text-xs text-ancla-inkSecondary">
                  Sube el PDF/captura o reenvía el correo a <code className="font-mono text-[11px]">auditoria@luanna.app</code>. Claude extrae todos los campos en 2 segundos.
                </p>
              </div>

              <div className="rounded-xl border border-ancla-line bg-ancla-canvas/70 p-3.5">
                <span className="font-mono text-[10px] font-semibold uppercase text-ancla-signal">
                  PASO 02 · PERSISTENCIA &amp; CRON
                </span>
                <p className="mt-1 font-display text-sm font-semibold text-ancla-ink">
                  Tabla boveda_auditorias
                </p>
                <p className="mt-1 text-xs text-ancla-inkSecondary">
                  Se guarda en Neon Postgres y el cron <code className="font-mono text-[11px]">/api/auditar/cron</code> revisa bajadas de precio antes de que venza la cancelación gratuita.
                </p>
              </div>

              <div className="rounded-xl border border-ancla-line bg-ancla-canvas/70 p-3.5">
                <span className="font-mono text-[10px] font-semibold uppercase text-ancla-signal">
                  PASO 03 · ALERTA CON RESEND
                </span>
                <p className="mt-1 font-display text-sm font-semibold text-ancla-ink">
                  Conversión Afiliada Directa
                </p>
                <p className="mt-1 text-xs text-ancla-inkSecondary">
                  El usuario recibe en su correo el botón con tu enlace de Stay22 / Travelpayouts o el reclamo legal listo para presentar.
                </p>
              </div>
            </div>
          </SpotlightTray>
        </div>
      </div>

      {/* Bottom Table: Complete Audit Ledger */}
      <SpotlightTray variant="light" className="mt-8" coreClassName="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ancla-line pb-4">
          <div>
            <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ancla-inkSecondary">
              04 · REGISTRO GENERAL DE AHORROS Y COMISIONES DIRECTAS
            </h2>
            <p className="mt-0.5 text-xs text-ancla-inkMuted">
              Haz clic en cualquier fila para abrir su radiografía o disparar el enlace de re-reserva afiliado.
            </p>
          </div>
          <span className="rounded-full bg-ancla-clinicalSoft px-3 py-1 font-mono text-[11px] font-medium text-ancla-clinical">
            Cero riesgo de contracargo · Cobro vía Stay22 / Travelpayouts / Stripe SaaS
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-ancla-line font-mono text-[11px] uppercase tracking-wider text-ancla-inkMuted">
                <th className="py-2.5 pr-4">Código</th>
                <th className="py-2.5 px-3">Tipo / Proveedor</th>
                <th className="py-2.5 px-3">Detalle de Reserva</th>
                <th className="py-2.5 px-3 text-right">Pagado Original</th>
                <th className="py-2.5 px-3 text-right">Ahorro / Reembolso Cliente</th>
                <th className="py-2.5 px-3 text-right">Tu Comisión Directa</th>
                <th className="py-2.5 pl-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ancla-line/70 font-sans">
              {boveda.map((item) => {
                const esHotel = item.tipo === 'hotel'
                const linkAccion = esHotel
                  ? construirEnlaceRebookingAfiliado(item).urlReservaDirecta
                  : item.urlPortalDevolucionAerolinea

                return (
                  <tr
                    key={item.id}
                    onClick={() => setCasoActivoId(item.id)}
                    className="cursor-pointer hover:bg-ancla-canvas/60"
                  >
                    <td className="py-3 pr-4 font-mono font-medium text-ancla-ink">
                      {esHotel ? item.codigoConfirmacion : item.pnr}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`mr-2 inline-block rounded px-1.5 py-0.5 font-mono text-[10px] uppercase ${
                          esHotel
                            ? 'bg-ancla-clinicalSoft text-ancla-clinical'
                            : 'bg-ancla-signalSoft text-ancla-signal'
                        }`}
                      >
                        {esHotel ? 'HOTEL RE-PRICE' : 'TASAS VUELO'}
                      </span>
                      <span className="font-medium text-ancla-ink">
                        {esHotel ? item.canalOriginal : item.aerolinea}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-ancla-inkSecondary">
                      {esHotel
                        ? `${item.hotelNombre} (${item.ciudad})`
                        : `${item.rutaIata} · ${item.jurisdiccion}`}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-ancla-inkSecondary">
                      ${esHotel ? item.precioPagadoUsd : item.precioBoletoPagadoUsd} USD
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-ancla-clinical">
                      +${esHotel ? item.ahorroNetoViajeroUsd : item.totalRecuperablePasajeroUsd} USD
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-ancla-ink">
                      {esHotel ? `+$${item.comisionDirectaLuannaUsd} USD` : 'Incluido en Plan Pro'}
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <a
                        href={linkAccion}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 rounded-full bg-ancla-obsidian px-2.5 py-1 font-mono text-[11px] text-white hover:bg-black"
                      >
                        <span>{esHotel ? 'Re-reservar' : 'Portal reembolso'}</span>
                        <IconArrowUpRight className="h-3 w-3" />
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SpotlightTray>
    </section>
  )
}

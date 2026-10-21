'use client'

import React, { useId, useMemo, useState } from 'react'
import {
  ANCLAS_CATALOGO,
  LIQUIDACIONES_RECIENTES,
  calcularEconomiaAncla,
  filtrarAlojamientosPorReglas,
  generarSnippetSdk,
  type AnclaGeoConfig,
  type VerticalAncla,
} from '@/lib/ancla-engine'
import {
  IconCheck,
  IconCopy,
  IconCrosshair,
  IconTerminal,
  SegmentedControl,
  SpotlightTray,
  TabularNumber,
} from '@/components/ui/reactbits'
import { WidgetAnclaInteractivo } from '@/components/WidgetAnclaInteractivo'

export function ConsolaAncla({
  onVolverLanding,
}: {
  onVolverLanding?: () => void
}) {
  const formId = useId()
  const [catalogo, setCatalogo] = useState<AnclaGeoConfig[]>(ANCLAS_CATALOGO)
  const [filtroVertical, setFiltroVertical] = useState<'todas' | VerticalAncla>('todas')
  const [anclaActivaId, setAnclaActivaId] = useState<string>(ANCLAS_CATALOGO[0].id)

  const anclaActiva = useMemo(
    () => catalogo.find((a) => a.id === anclaActivaId) ?? catalogo[0],
    [catalogo, anclaActivaId]
  )

  // Live calibration state per anchor
  const [isocronaMinutos, setIsocronaMinutos] = useState<number>(anclaActiva.isocronaMinutos)
  const [markupPorcentaje, setMarkupPorcentaje] = useState<number>(anclaActiva.markupPorcentaje)
  const [noches, setNoches] = useState<number>(anclaActiva.nochesSugeridas)
  const [duffelFlex, setDuffelFlex] = useState<boolean>(anclaActiva.duffelFlexActivo)
  const [esimIncluida, setEsimIncluida] = useState<boolean>(anclaActiva.esimIncluida)
  const [seguroActivo, setSeguroActivo] = useState<boolean>(anclaActiva.seguroActivo)
  const [volumenMensual, setVolumenMensual] = useState<number>(anclaActiva.volumenMensualBase)
  const [reglasActivasIds, setReglasActivasIds] = useState<string[]>(
    anclaActiva.reglasDisponibles.filter((r) => r.obligatoriaPorDefecto).map((r) => r.id)
  )
  const [origenIata, setOrigenIata] = useState<string>(anclaActiva.origenesFrecuentes[0] ?? 'MIA')
  const [alojamientoId, setAlojamientoId] = useState<string>(
    anclaActiva.alojamientos[0]?.id ?? ''
  )

  // SDK export state
  const [formatoSdk, setFormatoSdk] = useState<'web-component' | 'react-sdk' | 'rest-api'>(
    'web-component'
  )
  const [copiadoEstado, setCopiadoEstado] = useState<'ninguno' | 'sdk' | 'link'>('ninguno')

  // Inline new anchor creator drawer state
  const [creandoAncla, setCreandoAncla] = useState(false)
  const [nuevoNombreOrg, setNuevoNombreOrg] = useState('')
  const [nuevoTitulo, setNuevoTitulo] = useState('')
  const [nuevaVertical, setNuevaVertical] = useState<VerticalAncla>('clinica')
  const [nuevaCiudad, setNuevaCiudad] = useState('Medellín')
  const [nuevoIata, setNuevoIata] = useState('MDE')
  const [nuevaLat, setNuevaLat] = useState('6.2104')
  const [nuevaLon, setNuevaLon] = useState('-75.5671')

  const seleccionarAncla = (nueva: AnclaGeoConfig) => {
    setAnclaActivaId(nueva.id)
    setIsocronaMinutos(nueva.isocronaMinutos)
    setMarkupPorcentaje(nueva.markupPorcentaje)
    setNoches(nueva.nochesSugeridas)
    setDuffelFlex(nueva.duffelFlexActivo)
    setEsimIncluida(nueva.esimIncluida)
    setSeguroActivo(nueva.seguroActivo)
    setVolumenMensual(nueva.volumenMensualBase)
    setReglasActivasIds(
      nueva.reglasDisponibles.filter((r) => r.obligatoriaPorDefecto).map((r) => r.id)
    )
    setOrigenIata(nueva.origenesFrecuentes[0] ?? 'MIA')
    setAlojamientoId(nueva.alojamientos[0]?.id ?? '')
  }

  const anclasVisibles = useMemo(() => {
    if (filtroVertical === 'todas') return catalogo
    return catalogo.filter((a) => a.vertical === filtroVertical)
  }, [catalogo, filtroVertical])

  const alojamientosFiltrados = useMemo(
    () => filtrarAlojamientosPorReglas(anclaActiva, reglasActivasIds, isocronaMinutos),
    [anclaActiva, reglasActivasIds, isocronaMinutos]
  )

  const alojamientoSeleccionado = useMemo(
    () =>
      alojamientosFiltrados.find((a) => a.id === alojamientoId) ??
      alojamientosFiltrados[0] ??
      anclaActiva.alojamientos[0],
    [alojamientosFiltrados, alojamientoId, anclaActiva]
  )

  const cotizacion = useMemo(
    () =>
      calcularEconomiaAncla({
        tarifaNetaNocheUsd: alojamientoSeleccionado?.tarifaNetaUsd ?? 88,
        noches,
        markupPorcentaje,
        duffelFlexActivo: duffelFlex,
        esimIncluida,
        seguroActivo,
        volumenMensualViajeros: volumenMensual,
        tasaConversionPostCheckout: anclaActiva.tasaConversionPostCheckout,
      }),
    [
      alojamientoSeleccionado,
      noches,
      markupPorcentaje,
      duffelFlex,
      esimIncluida,
      seguroActivo,
      volumenMensual,
      anclaActiva.tasaConversionPostCheckout,
    ]
  )

  const snippetCodigo = useMemo(
    () =>
      generarSnippetSdk({
        ancla: {
          ...anclaActiva,
          nochesSugeridas: noches,
          duffelFlexActivo: duffelFlex,
          esimIncluida,
        },
        formato: formatoSdk,
        isocronaMinutos,
        markupPorcentaje,
        reglasIds: reglasActivasIds,
      }),
    [anclaActiva, noches, duffelFlex, esimIncluida, formatoSdk, isocronaMinutos, markupPorcentaje, reglasActivasIds]
  )

  const linkDirectoCheckout = `https://ancla.luanna.lat/c/${anclaActiva.slug}?iso=${isocronaMinutos}m&nights=${noches}&flex=${duffelFlex ? '1' : '0'}`

  const toggleRegla = (id: string) => {
    setReglasActivasIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const copiarTexto = async (texto: string, tipo: 'sdk' | 'link') => {
    try {
      await navigator.clipboard.writeText(texto)
    } catch {
      // Fallback silencioso si el navegador bloquea clipboard en entorno sin permisos
    }
    setCopiadoEstado(tipo)
    window.setTimeout(() => setCopiadoEstado('ninguno'), 2200)
  }

  const handleCrearAncla = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevoNombreOrg.trim() || !nuevoTitulo.trim()) return

    const slugLimpio = nuevoNombreOrg
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    const nuevaAncla: AnclaGeoConfig = {
      id: `custom-${Date.now()}`,
      slug: slugLimpio || `ancla-${Date.now()}`,
      vertical: nuevaVertical,
      organizacion: nuevoNombreOrg.trim(),
      titulo: nuevoTitulo.trim(),
      subtitulo:
        nuevaVertical === 'clinica'
          ? 'Protocolo clínico con alojamiento verificado y tarifa aérea flexible'
          : 'Logística oficial post-checkout sincronizada con la sede del evento',
      ciudad: nuevaCiudad.trim() || 'Medellín',
      pais: 'LATAM',
      codigoIataDestino: (nuevoIata.trim() || 'MDE').toUpperCase().slice(0, 3),
      origenesFrecuentes: ['MIA', 'BOG', 'LIM', 'SCL'],
      lat: Number.parseFloat(nuevaLat) || 6.2088,
      lon: Number.parseFloat(nuevaLon) || -75.5658,
      isocronaMinutos: 8,
      nochesSugeridas: nuevaVertical === 'clinica' ? 5 : 3,
      markupPorcentaje: 14,
      duffelFlexActivo: true,
      esimIncluida: true,
      seguroActivo: true,
      volumenMensualBase: nuevaVertical === 'clinica' ? 75 : 350,
      tasaConversionPostCheckout: nuevaVertical === 'clinica' ? 0.62 : 0.34,
      reglasDisponibles:
        ANCLAS_CATALOGO.find((a) => a.vertical === nuevaVertical)?.reglasDisponibles ??
        ANCLAS_CATALOGO[0].reglasDisponibles,
      alojamientos:
        ANCLAS_CATALOGO.find((a) => a.vertical === nuevaVertical)?.alojamientos ??
        ANCLAS_CATALOGO[0].alojamientos,
    }

    setCatalogo((prev) => [nuevaAncla, ...prev])
    seleccionarAncla(nuevaAncla)
    setCreandoAncla(false)
    setNuevoNombreOrg('')
    setNuevoTitulo('')
  }

  return (
    <section
      aria-labelledby="consola-heading"
      className="mx-auto max-w-[1380px] px-4 py-8 sm:px-8 sm:py-12"
    >
      {/* Top Studio Header Bar */}
      <div className="flex flex-col justify-between gap-4 border-b border-ancla-line pb-6 lg:flex-row lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ancla-obsidian px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-[#fdfcfa]">
              <IconCrosshair className="h-3.5 w-3.5 text-ancla-signal" />
              <span>CONSOLA B2B · ESTUDIO DE ANCLAS</span>
            </span>
            <span className="rounded-full bg-ancla-clinicalSoft px-3 py-1 font-mono text-[11px] font-medium text-ancla-clinical">
              LiteAPI + Stay22 + Duffel + Airalo Activos
            </span>
          </div>

          <h1
            id="consola-heading"
            className="mt-3 font-display text-2xl font-semibold tracking-[-0.025em] text-ancla-ink sm:text-3xl"
          >
            Calibrador de Logística Geo-Anclada & SDK
          </h1>
          <p className="mt-1 max-w-[68ch] text-sm text-ancla-inkSecondary">
            Configura las coordenadas de tu clínica o evento, define filtros obligatorios de estancia y exporta el componente web o enlace de checkout con tu propio margen sobre tarifa neta.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onVolverLanding ? (
            <button
              type="button"
              onClick={onVolverLanding}
              className="press-scale rounded-full border border-ancla-lineStrong bg-ancla-paper px-4 py-2 font-sans text-xs font-medium text-ancla-ink hover:border-ancla-ink"
            >
              ← Volver a vista pública
            </button>
          ) : (
            <a
              href="/"
              className="press-scale rounded-full border border-ancla-lineStrong bg-ancla-paper px-4 py-2 font-sans text-xs font-medium text-ancla-ink hover:border-ancla-ink"
            >
              ← Volver a vista pública
            </a>
          )}

          <button
            type="button"
            onClick={() => setCreandoAncla((v) => !v)}
            aria-expanded={creandoAncla}
            className="press-scale rounded-full bg-ancla-signal px-4 py-2 font-sans text-xs font-medium text-white hover:bg-[#9f3819]"
          >
            {creandoAncla ? 'Cerrar formulario' : '+ Crear nueva ancla'}
          </button>
        </div>
      </div>

      {/* Expandable New Anchor Form */}
      {creandoAncla ? (
        <SpotlightTray variant="light" className="mt-6" coreClassName="p-5 sm:p-6">
          <form onSubmit={handleCrearAncla} aria-label="Crear nueva ancla logística">
            <div className="flex items-center justify-between border-b border-ancla-line pb-3">
              <h2 className="font-display text-base font-semibold text-ancla-ink">
                Registrar nueva sede clínica o evento
              </h2>
              <span className="font-mono text-xs text-ancla-inkMuted">
                Geocodificación directa sin WhatsApp
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <div className="lg:col-span-2">
                <label
                  htmlFor={`${formId}-org`}
                  className="block font-mono text-[11px] uppercase tracking-wider text-ancla-inkSecondary"
                >
                  Clínica u Organizador
                </label>
                <input
                  id={`${formId}-org`}
                  type="text"
                  required
                  placeholder="Ej. Clínica Dental Bocagrande"
                  value={nuevoNombreOrg}
                  onChange={(e) => setNuevoNombreOrg(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-ancla-lineStrong bg-white px-3 py-2 text-sm text-ancla-ink"
                />
              </div>

              <div className="lg:col-span-2">
                <label
                  htmlFor={`${formId}-titulo`}
                  className="block font-mono text-[11px] uppercase tracking-wider text-ancla-inkSecondary"
                >
                  Protocolo o Evento
                </label>
                <input
                  id={`${formId}-titulo`}
                  type="text"
                  required
                  placeholder="Ej. Rehabilitación Oral 6 Días"
                  value={nuevoTitulo}
                  onChange={(e) => setNuevoTitulo(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-ancla-lineStrong bg-white px-3 py-2 text-sm text-ancla-ink"
                />
              </div>

              <div>
                <label
                  htmlFor={`${formId}-vertical`}
                  className="block font-mono text-[11px] uppercase tracking-wider text-ancla-inkSecondary"
                >
                  Vertical
                </label>
                <select
                  id={`${formId}-vertical`}
                  value={nuevaVertical}
                  onChange={(e) => setNuevaVertical(e.target.value as VerticalAncla)}
                  className="mt-1.5 w-full rounded-lg border border-ancla-lineStrong bg-white px-3 py-2 text-sm text-ancla-ink"
                >
                  <option value="clinica">Turismo Médico / Clínica</option>
                  <option value="evento">Ticketera / Evento</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor={`${formId}-ciudad`}
                    className="block font-mono text-[11px] uppercase tracking-wider text-ancla-inkSecondary"
                  >
                    Ciudad
                  </label>
                  <input
                    id={`${formId}-ciudad`}
                    type="text"
                    value={nuevaCiudad}
                    onChange={(e) => setNuevaCiudad(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-ancla-lineStrong bg-white px-2.5 py-2 text-sm text-ancla-ink"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`${formId}-iata`}
                    className="block font-mono text-[11px] uppercase tracking-wider text-ancla-inkSecondary"
                  >
                    IATA
                  </label>
                  <input
                    id={`${formId}-iata`}
                    type="text"
                    maxLength={3}
                    value={nuevoIata}
                    onChange={(e) => setNuevoIata(e.target.value.toUpperCase())}
                    className="mt-1.5 w-full rounded-lg border border-ancla-lineStrong bg-white px-2.5 py-2 font-mono text-sm uppercase text-ancla-ink"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-ancla-line pt-4">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label
                    htmlFor={`${formId}-lat`}
                    className="block font-mono text-[10px] uppercase tracking-wider text-ancla-inkMuted"
                  >
                    Latitud sede
                  </label>
                  <input
                    id={`${formId}-lat`}
                    type="text"
                    value={nuevaLat}
                    onChange={(e) => setNuevaLat(e.target.value)}
                    className="mt-1 w-28 rounded border border-ancla-lineStrong bg-white px-2.5 py-1 font-mono text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`${formId}-lon`}
                    className="block font-mono text-[10px] uppercase tracking-wider text-ancla-inkMuted"
                  >
                    Longitud sede
                  </label>
                  <input
                    id={`${formId}-lon`}
                    type="text"
                    value={nuevaLon}
                    onChange={(e) => setNuevaLon(e.target.value)}
                    className="mt-1 w-28 rounded border border-ancla-lineStrong bg-white px-2.5 py-1 font-mono text-xs tabular-nums"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="press-scale rounded-full bg-ancla-obsidian px-5 py-2.5 font-sans text-xs font-medium text-white hover:bg-black"
              >
                Guardar y calibrar ancla →
              </button>
            </div>
          </form>
        </SpotlightTray>
      ) : null}

      {/* Main Studio Grid: Left Controls (5 cols) + Right Live Preview & SDK Generator (7 cols) */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Anchor Catalog + Calibration Controls */}
        <div className="space-y-6 lg:col-span-5">
          {/* 1. Anchor Selector Box */}
          <SpotlightTray variant="light" coreClassName="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ancla-inkSecondary">
                01 · SEDES Y EVENTOS ACTIVOS
              </h2>
              <SegmentedControl
                ariaLabel="Filtrar catálogo por vertical"
                size="sm"
                options={[
                  { id: 'todas', label: 'Todas' },
                  { id: 'clinica', label: 'Clínicas' },
                  { id: 'evento', label: 'Eventos' },
                ]}
                value={filtroVertical}
                onChange={setFiltroVertical}
              />
            </div>

            <div
              className="mt-4 space-y-2"
              role="listbox"
              aria-label="Seleccionar ancla activa para calibrar"
            >
              {anclasVisibles.map((item) => {
                const activo = item.id === anclaActiva.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={activo}
                    onClick={() => seleccionarAncla(item)}
                    className={`press-scale w-full rounded-xl border p-3.5 text-left transition-colors ${
                      activo
                        ? 'border-ancla-ink bg-ancla-obsidian text-[#fdfcfa]'
                        : 'border-ancla-line bg-ancla-canvas/60 text-ancla-ink hover:border-ancla-lineStrong'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                          item.vertical === 'clinica'
                            ? activo
                              ? 'bg-[#19674e] text-[#b4f5dc]'
                              : 'bg-ancla-clinicalSoft text-ancla-clinical'
                            : activo
                              ? 'bg-ancla-signal text-white'
                              : 'bg-ancla-signalSoft text-ancla-signal'
                        }`}
                      >
                        {item.vertical === 'clinica' ? 'CLÍNICA / MÉDICO' : 'TICKETERA / EVENTO'}
                      </span>
                      <span
                        className={`font-mono text-[11px] tabular-nums ${
                          activo ? 'text-[#b8b3a8]' : 'text-ancla-inkMuted'
                        }`}
                      >
                        {item.ciudad} ({item.codigoIataDestino})
                      </span>
                    </div>
                    <p className="mt-1.5 font-display text-sm font-semibold">
                      {item.organizacion}
                    </p>
                    <p
                      className={`mt-0.5 text-xs ${
                        activo ? 'text-[#d5d1c8]' : 'text-ancla-inkSecondary'
                      }`}
                    >
                      {item.titulo}
                    </p>
                  </button>
                )
              })}
            </div>
          </SpotlightTray>

          {/* 2. Isochrone, Markup & Ancillaries Calibrator */}
          <SpotlightTray variant="light" coreClassName="p-5">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ancla-inkSecondary">
              02 · CALIBRACIÓN DE REGLAS Y MARGEN NETO
            </h2>

            <div className="mt-4 space-y-5">
              {/* Isochrone Slider */}
              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor={`${formId}-iso-slider`}
                    className="text-xs font-medium text-ancla-ink"
                  >
                    Isócrona máxima en hora pico
                  </label>
                  <span className="rounded bg-ancla-tray px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-ancla-ink">
                    {isocronaMinutos} min
                  </span>
                </div>
                <input
                  id={`${formId}-iso-slider`}
                  type="range"
                  min={5}
                  max={20}
                  step={1}
                  value={isocronaMinutos}
                  onChange={(e) => setIsocronaMinutos(Number(e.target.value))}
                  className="mt-2 w-full accent-ancla-signal"
                />
                <div className="mt-1 flex justify-between font-mono text-[10px] text-ancla-inkMuted">
                  <span>5 min (Caminable)</span>
                  <span>10 min (Óptimo)</span>
                  <span>20 min (Radio urbano)</span>
                </div>
              </div>

              {/* Net-Rate Markup Slider */}
              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor={`${formId}-markup-slider`}
                    className="text-xs font-medium text-ancla-ink"
                  >
                    Markup sobre Tarifa Neta Hotel (LiteAPI)
                  </label>
                  <span className="rounded bg-ancla-clinicalSoft px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-ancla-clinical">
                    +{markupPorcentaje}%
                  </span>
                </div>
                <input
                  id={`${formId}-markup-slider`}
                  type="range"
                  min={6}
                  max={22}
                  step={1}
                  value={markupPorcentaje}
                  onChange={(e) => setMarkupPorcentaje(Number(e.target.value))}
                  className="mt-2 w-full accent-ancla-clinical"
                />
                <p className="mt-1 text-[11px] text-ancla-inkMuted">
                  Al usar tarifa neta mayorista, aún con +{markupPorcentaje}% el viajero paga igual o menos que en una OTA tradicional.
                </p>
              </div>

              {/* Nights & Volume Controls */}
              <div className="grid grid-cols-2 gap-3 border-t border-ancla-line pt-4">
                <div>
                  <label
                    htmlFor={`${formId}-noches`}
                    className="block font-mono text-[11px] text-ancla-inkSecondary"
                  >
                    Noches por estancia
                  </label>
                  <input
                    id={`${formId}-noches`}
                    type="number"
                    min={1}
                    max={21}
                    value={noches}
                    onChange={(e) => setNoches(Math.max(1, Number(e.target.value) || 1))}
                    className="mt-1 w-full rounded-lg border border-ancla-lineStrong bg-white px-3 py-1.5 font-mono text-sm tabular-nums"
                  />
                </div>

                <div>
                  <label
                    htmlFor={`${formId}-volumen`}
                    className="block font-mono text-[11px] text-ancla-inkSecondary"
                  >
                    {anclaActiva.vertical === 'clinica'
                      ? 'Pacientes foráneos / mes'
                      : 'Asistentes foráneos / mes'}
                  </label>
                  <input
                    id={`${formId}-volumen`}
                    type="number"
                    min={10}
                    max={10000}
                    step={10}
                    value={volumenMensual}
                    onChange={(e) =>
                      setVolumenMensual(Math.max(10, Number(e.target.value) || 10))
                    }
                    className="mt-1 w-full rounded-lg border border-ancla-lineStrong bg-white px-3 py-1.5 font-mono text-sm tabular-nums"
                  />
                </div>
              </div>

              {/* API Modules Toggles */}
              <div className="space-y-2 border-t border-ancla-line pt-4">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-ancla-inkMuted">
                  MÓDULOS DE ALTO MARGEN EN CHECKOUT
                </span>

                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-ancla-line bg-ancla-canvas/50 px-3 py-2 text-xs">
                  <span>
                    <strong className="font-medium text-ancla-ink">Duffel Flex Air:</strong>{' '}
                    <span className="text-ancla-inkSecondary">
                      Cambio de fecha sin penalidad (+$34 fee)
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={duffelFlex}
                    onChange={(e) => setDuffelFlex(e.target.checked)}
                    className="h-4 w-4 accent-ancla-signal"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-ancla-line bg-ancla-canvas/50 px-3 py-2 text-xs">
                  <span>
                    <strong className="font-medium text-ancla-ink">Airalo eSIM SDK:</strong>{' '}
                    <span className="text-ancla-inkSecondary">
                      Datos locales activos al aterrizar (+$6 neto)
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={esimIncluida}
                    onChange={(e) => setEsimIncluida(e.target.checked)}
                    className="h-4 w-4 accent-ancla-signal"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-ancla-line bg-ancla-canvas/50 px-3 py-2 text-xs">
                  <span>
                    <strong className="font-medium text-ancla-ink">
                      {anclaActiva.vertical === 'clinica'
                        ? 'Cobertura Post-Op:'
                        : 'Seguro Cancelación Dorsal:'}
                    </strong>{' '}
                    <span className="text-ancla-inkSecondary">
                      Póliza embebida (+$16 neto)
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={seguroActivo}
                    onChange={(e) => setSeguroActivo(e.target.checked)}
                    className="h-4 w-4 accent-ancla-signal"
                  />
                </label>
              </div>
            </div>
          </SpotlightTray>
        </div>

        {/* Right Column: Live Widget Preview + Monthly Revenue Telemetry + SDK Code Generator */}
        <div className="space-y-6 lg:col-span-7">
          {/* Live Projected Partner Revenue Banner */}
          <SpotlightTray variant="light" coreClassName="p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-ancla-inkMuted">
                  RESERVAS ESTIMADAS / MES
                </span>
                <p className="mt-1 font-display text-2xl font-semibold text-ancla-ink">
                  <TabularNumber value={cotizacion.reservasMensualesEstimadas} suffix=" paquetes" />
                </p>
                <span className="font-mono text-[11px] text-ancla-inkSecondary">
                  Conversión post-checkout {(anclaActiva.tasaConversionPostCheckout * 100).toFixed(0)}%
                </span>
              </div>

              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-ancla-inkMuted">
                  COMISIÓN NETA SOCIO / MES
                </span>
                <p className="mt-1 font-display text-2xl font-semibold text-ancla-clinical">
                  <TabularNumber
                    value={cotizacion.ingresoNetoMensualSocioUsd}
                    prefix="$"
                    suffix=" USD"
                  />
                </p>
                <span className="font-mono text-[11px] text-ancla-inkSecondary">
                  70% rev-share automático
                </span>
              </div>

              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-ancla-inkMuted">
                  PROYECCIÓN ANUAL SOCIO
                </span>
                <p className="mt-1 font-display text-2xl font-semibold text-ancla-ink">
                  <TabularNumber
                    value={cotizacion.ingresoNetoAnualSocioUsd}
                    prefix="$"
                    suffix=" USD"
                  />
                </p>
                <span className="font-mono text-[11px] text-ancla-signal">
                  CAC $0 · Tráfico propio
                </span>
              </div>
            </div>
          </SpotlightTray>

          {/* Live Calibrated Widget */}
          <WidgetAnclaInteractivo
            ancla={anclaActiva}
            alojamientosFiltrados={alojamientosFiltrados}
            alojamientoSeleccionado={alojamientoSeleccionado}
            onSelectAlojamiento={(aloj) => setAlojamientoId(aloj.id)}
            isocronaMinutos={isocronaMinutos}
            reglasActivasIds={reglasActivasIds}
            onToggleRegla={toggleRegla}
            cotizacion={cotizacion}
            origenSeleccionado={origenIata}
            onSelectOrigen={setOrigenIata}
          />

          {/* SDK & Direct Patient/Attendee Link Exporter */}
          <SpotlightTray variant="light" coreClassName="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <IconTerminal className="h-4 w-4 text-ancla-signal" />
                <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ancla-ink">
                  03 · DESPLIEGUE DEL PAQUETE TECNOLÓGICO
                </h2>
              </div>

              <SegmentedControl
                ariaLabel="Formato de integración técnica"
                size="sm"
                options={[
                  { id: 'web-component', label: 'Web Component' },
                  { id: 'react-sdk', label: 'React SDK' },
                  { id: 'rest-api', label: 'REST API' },
                ]}
                value={formatoSdk}
                onChange={setFormatoSdk}
              />
            </div>

            {/* Code Box */}
            <div className="mt-3 overflow-x-auto rounded-xl border border-ancla-lineStrong bg-[#121210] p-4 text-xs text-[#e8e4dc]">
              <pre className="font-mono leading-relaxed">
                <code>{snippetCodigo}</code>
              </pre>
            </div>

            {/* Direct Link + Copy Actions */}
            <div
              aria-live="polite"
              className="mt-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"
            >
              <div className="flex items-center gap-2 overflow-hidden rounded-lg border border-ancla-line bg-ancla-canvas px-3 py-1.5">
                <span className="shrink-0 font-mono text-[10px] uppercase text-ancla-inkMuted">
                  LINK DIRECTO:
                </span>
                <code className="truncate font-mono text-xs text-ancla-ink">
                  {linkDirectoCheckout}
                </code>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => copiarTexto(linkDirectoCheckout, 'link')}
                  className="press-scale inline-flex items-center gap-1.5 rounded-full border border-ancla-lineStrong bg-white px-3.5 py-1.5 font-sans text-xs font-medium text-ancla-ink hover:border-ancla-ink"
                >
                  {copiadoEstado === 'link' ? (
                    <>
                      <IconCheck className="h-3.5 w-3.5 text-ancla-clinical" />
                      <span>Link copiado</span>
                    </>
                  ) : (
                    <>
                      <IconCopy className="h-3.5 w-3.5" />
                      <span>Copiar link</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => copiarTexto(snippetCodigo, 'sdk')}
                  className="press-scale inline-flex items-center gap-1.5 rounded-full bg-ancla-obsidian px-4 py-1.5 font-sans text-xs font-medium text-white hover:bg-black"
                >
                  {copiadoEstado === 'sdk' ? (
                    <>
                      <IconCheck className="h-3.5 w-3.5 text-[#7ce2be]" />
                      <span>Código copiado</span>
                    </>
                  ) : (
                    <>
                      <IconCopy className="h-3.5 w-3.5" />
                      <span>Copiar SDK</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </SpotlightTray>
        </div>
      </div>

      {/* Bottom Ledger: Recent Settlements Across Both Verticals */}
      <SpotlightTray variant="light" className="mt-8" coreClassName="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ancla-line pb-4">
          <div>
            <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ancla-inkSecondary">
              04 · LIBRO MAYOR DE LIQUIDACIONES RECIENTES (TIEMPO REAL)
            </h2>
            <p className="mt-0.5 text-xs text-ancla-inkMuted">
              Conciliación automática de tarifas netas mayoristas (LiteAPI / Duffel) y dispersión del 70% de margen al socio.
            </p>
          </div>
          <span className="rounded-full bg-ancla-clinicalSoft px-3 py-1 font-mono text-[11px] font-medium text-ancla-clinical">
            Liquidación T+2 vía Stripe Connect / Transferencia Local
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-ancla-line font-mono text-[11px] uppercase tracking-wider text-ancla-inkMuted">
                <th className="py-2.5 pr-4">Reserva</th>
                <th className="py-2.5 px-3">Vertical / Sede</th>
                <th className="py-2.5 px-3">Ruta Aérea</th>
                <th className="py-2.5 px-3 text-right">Costo Neto API</th>
                <th className="py-2.5 px-3 text-right">Checkout Total</th>
                <th className="py-2.5 px-3 text-right">Tu Comisión (70%)</th>
                <th className="py-2.5 pl-3 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ancla-line/70 font-sans">
              {LIQUIDACIONES_RECIENTES.map((liq) => (
                <tr key={liq.id} className="hover:bg-ancla-canvas/60">
                  <td className="py-3 pr-4 font-mono font-medium text-ancla-ink">
                    {liq.codigoReserva}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`mr-2 inline-block rounded px-1.5 py-0.5 font-mono text-[10px] uppercase ${
                        liq.vertical === 'clinica'
                          ? 'bg-ancla-clinicalSoft text-ancla-clinical'
                          : 'bg-ancla-signalSoft text-ancla-signal'
                      }`}
                    >
                      {liq.vertical === 'clinica' ? 'CLÍNICA' : 'EVENTO'}
                    </span>
                    <span className="font-medium text-ancla-ink">{liq.anclaNombre}</span>
                  </td>
                  <td className="py-3 px-3 font-mono tabular-nums text-ancla-inkSecondary">
                    {liq.rutaIata} · {liq.noches}n
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-ancla-inkSecondary">
                    ${liq.tarifaNetaTotalUsd.toFixed(0)} USD
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums font-medium text-ancla-ink">
                    ${liq.precioCheckoutUsd.toFixed(0)} USD
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-ancla-clinical">
                    +${liq.margenSocioUsd.toFixed(2)} USD
                  </td>
                  <td className="py-3 pl-3 text-right">
                    <span className="inline-flex items-center gap-1 rounded-full bg-ancla-tray px-2.5 py-0.5 font-mono text-[11px] text-ancla-ink">
                      {liq.estado} · {liq.haceMinutos}m
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SpotlightTray>
    </section>
  )
}

'use client'

import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  CASOS_AUDITORIA_DEMO,
  analizarTextoReservaDeterminista,
  calcularEconomiaAuditor,
  type CasoAuditoria,
} from '@/lib/auditor-engine'
import {
  BlurWordReveal,
  IconCheck,
  IconCrosshair,
  IslandButton,
  SegmentedControl,
  SpotlightTray,
  TabularNumber,
} from '@/components/ui/reactbits'
import { WidgetAuditorInteractivo } from '@/components/WidgetAnclaInteractivo'
import { ConsolaAncla } from '@/components/plataforma/ConsolaAncla'

export default function AnclaLanding() {
  const simId = useId()
  const [vistaPrincipal, setVistaPrincipal] = useState<'landing' | 'consola'>('landing')

  // Hero interactive audit state
  const [casosHero, setCasosHero] = useState<CasoAuditoria[]>(CASOS_AUDITORIA_DEMO)
  const [casoHeroActivo, setCasoHeroActivo] = useState<CasoAuditoria>(
    CASOS_AUDITORIA_DEMO[0]
  )
  const [inputRapidoHero, setInputRapidoHero] = useState<string>('')
  const [escaneandoHero, setEscaneandoHero] = useState<boolean>(false)
  const heroFileRef = useRef<HTMLInputElement | null>(null)

  const ejecutarAuditoriaHero = async (payload: {
    texto?: string
    archivoBase64?: string
    archivoMime?: string
    archivoNombre?: string
  }) => {
    setEscaneandoHero(true)
    try {
      const r = await fetch('/api/auditar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (r.ok) {
        const data = (await r.json()) as { caso: CasoAuditoria }
        setCasosHero((prev) => [data.caso, ...prev.slice(0, 3)])
        setCasoHeroActivo(data.caso)
        return
      }
    } catch {
      // Fallback determinista inmediato
    } finally {
      setEscaneandoHero(false)
    }

    const nuevo = analizarTextoReservaDeterminista(
      payload.texto || payload.archivoNombre || 'Hotel Auditado $760 USD'
    )
    setCasosHero((prev) => [nuevo, ...prev.slice(0, 3)])
    setCasoHeroActivo(nuevo)
  }

  const handleEscaneoRapidoHero = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputRapidoHero.trim()) return
    const texto = inputRapidoHero.trim()
    setInputRapidoHero('')
    await ejecutarAuditoriaHero({ texto })
  }

  const handleSubirArchivoHero = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || file.size > 4.5 * 1024 * 1024) return
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = typeof reader.result === 'string' ? reader.result : ''
      if (base64) {
        void ejecutarAuditoriaHero({
          archivoBase64: base64,
          archivoMime: file.type || 'application/pdf',
          archivoNombre: file.name,
        })
      }
    }
    reader.readAsDataURL(file)
  }

  // Revenue Simulator State
  const [reservasMesSim, setReservasMesSim] = useState<number>(350)
  const [ticketHotelSim, setTicketHotelSim] = useState<number>(680)
  const [empresasB2BSim, setEmpresasB2BSim] = useState<number>(18)

  const proyeccionSim = useMemo(
    () =>
      calcularEconomiaAuditor({
        reservasAuditadasMes: reservasMesSim,
        ticketPromedioHotelUsd: ticketHotelSim,
        empresasSuscritasB2B: empresasB2BSim,
      }),
    [reservasMesSim, ticketHotelSim, empresasB2BSim]
  )

  // IntersectionObserver for scroll reveals
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    const elements = Array.from(root.querySelectorAll<HTMLElement>('.reveal-item'))
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      elements.forEach((el) => el.setAttribute('data-visible', 'true'))
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.setAttribute('data-visible', 'true')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12 }
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [vistaPrincipal])

  return (
    <div ref={containerRef} className="min-h-svh bg-ancla-canvas text-ancla-ink">
      {/* Floating Island Navigation Header */}
      <header className="sticky top-4 z-40 mx-auto max-w-[1340px] px-4 sm:px-8">
        <nav
          aria-label="Navegación principal de Luanna"
          className="flex flex-wrap items-center justify-between gap-3 rounded-full border border-ancla-lineStrong/80 bg-ancla-paper/90 px-4 py-2.5 backdrop-blur-md sm:px-6"
        >
          <div className="flex items-center gap-3">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault()
                setVistaPrincipal('landing')
              }}
              className="flex items-center gap-2 font-display text-lg font-bold tracking-[-0.03em] text-ancla-ink"
            >
              <span>luanna</span>
              <span className="rounded bg-ancla-obsidian px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#fdfcfa]">
                POST-BOOKING AUDIT
              </span>
            </a>

            <span className="hidden border-l border-ancla-line pl-3 font-mono text-[11px] text-ancla-inkMuted xl:inline-block">
              RE-PRICER MAYORISTA &amp; RESCATE DE TASAS AÉREAS
            </span>
          </div>

          {vistaPrincipal === 'landing' ? (
            <div className="hidden items-center gap-6 md:flex">
              <a
                href="#motores"
                className="font-sans text-xs font-medium text-ancla-inkSecondary transition-colors hover:text-ancla-ink"
              >
                Cómo Funciona
              </a>
              <a
                href="#comparativa"
                className="font-sans text-xs font-medium text-ancla-inkSecondary transition-colors hover:text-ancla-ink"
              >
                Ventaja en LATAM
              </a>
              <a
                href="#rentabilidad"
                className="font-sans text-xs font-medium text-ancla-inkSecondary transition-colors hover:text-ancla-ink"
              >
                Modelo de Ingresos
              </a>
              <a
                href="/eventos"
                className="font-sans text-xs font-medium text-ancla-inkSecondary transition-colors hover:text-ancla-ink"
              >
                Eventos Deportivos
              </a>
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <SegmentedControl
              ariaLabel="Cambiar entre portada pública y bóveda de auditoría"
              size="sm"
              options={[
                { id: 'landing', label: '01. Portada' },
                { id: 'consola', label: '02. Bóveda en Vivo', badge: 'APP' },
              ]}
              value={vistaPrincipal}
              onChange={setVistaPrincipal}
            />
          </div>
        </nav>
      </header>

      {vistaPrincipal === 'consola' ? (
        <main id="contenido">
          <ConsolaAncla onVolverLanding={() => setVistaPrincipal('landing')} />
        </main>
      ) : (
        <main id="contenido" className="overflow-hidden">
          {/* HERO SECTION: Asymmetric Editorial + Live Forensic Reservation Scanner */}
          <section
            aria-labelledby="hero-title"
            className="relative mx-auto max-w-[1380px] px-4 pt-10 pb-20 sm:px-8 sm:pt-14 sm:pb-28"
          >
            <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-8">
              {/* Left 5 Cols: Editorial Value Proposition & Instant Voucher Input */}
              <div className="lg:col-span-5 lg:pt-1">
                <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-ancla-lineStrong bg-ancla-paper px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-ancla-signal" aria-hidden="true" />
                  <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ancla-ink">
                    AUDITORÍA POST-COMPRA · B2C GRATIS &amp; B2B SAAS
                  </span>
                </div>

                <BlurWordReveal
                  as="h1"
                  text="Recupera el dinero escondido en tus hoteles ya reservados y vuelos no usados."
                  highlightWords={['dinero', 'escondido', 'hoteles', 'vuelos']}
                  className="mt-5 font-display text-[clamp(2.1rem,3.8vw,3.35rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-ancla-ink"
                />

                <p className="mt-4 max-w-[60ch] font-sans text-base leading-[1.6] text-ancla-inkSecondary">
                  No cambies dónde compras tus viajes. Sube o reenvía tu confirmación de{' '}
                  <strong className="font-medium text-ancla-ink">Booking, Expedia, LATAM o Avianca</strong> y deja que nuestro motor con Claude haga dos cosas en automático:
                </p>

                <ul className="mt-4 space-y-2 text-xs text-ancla-inkSecondary">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 rounded bg-ancla-clinicalSoft px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ancla-clinical">
                      01
                    </span>
                    <span>
                      <strong className="text-ancla-ink">Re-Pricer Mayorista de Hoteles (Gratis):</strong>{' '}
                      Monitorea tu reserva cada 6 horas y te alerta con enlace directo cuando la misma habitación baja hasta un 28%.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 rounded bg-ancla-signalSoft px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ancla-signal">
                      02
                    </span>
                    <span>
                      <strong className="text-ancla-ink">Rescate de Tasas de Boletos Perdidos:</strong>{' '}
                      Si no pudiste volar un pasaje &ldquo;no reembolsable&rdquo;, autogenera el reclamo legal para que la aerolínea te devuelva el 100% de las tasas de embarque (<code className="font-mono">TUUA / TUA / Aerocivil</code>).
                    </span>
                  </li>
                </ul>

                {/* Quick Instant Voucher Scanner Form */}
                <form
                  onSubmit={handleEscaneoRapidoHero}
                  className="mt-6 rounded-2xl border border-ancla-lineStrong bg-ancla-paper p-3.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label
                      htmlFor="hero-quick-scan"
                      className="block font-mono text-[10px] uppercase tracking-[0.12em] text-ancla-inkMuted"
                    >
                      PRUEBA EL ESCÁNER AHORA (PEGA TEXTO O SUBE PDF/FOTO):
                    </label>
                    <input
                      ref={heroFileRef}
                      id="hero-file-upload"
                      type="file"
                      accept="application/pdf,image/png,image/jpeg,image/webp"
                      onChange={handleSubirArchivoHero}
                      className="sr-only"
                    />
                    <label
                      htmlFor="hero-file-upload"
                      className="cursor-pointer rounded-full border border-ancla-lineStrong bg-ancla-canvas px-2.5 py-0.5 font-mono text-[10px] font-medium text-ancla-ink hover:border-ancla-ink"
                    >
                      + Subir PDF / Captura
                    </label>
                  </div>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                      id="hero-quick-scan"
                      type="text"
                      value={inputRapidoHero}
                      onChange={(e) => setInputRapidoHero(e.target.value)}
                      placeholder="Ej. Reserva Booking Hotel Medellín $820 o Vuelo LATAM $390..."
                      className="flex-1 rounded-full border border-ancla-lineStrong bg-white px-4 py-2.5 font-sans text-xs text-ancla-ink placeholder:text-ancla-inkMuted"
                    />
                    <button
                      type="submit"
                      disabled={escaneandoHero}
                      className="press-scale shrink-0 rounded-full bg-ancla-obsidian px-4 py-2.5 font-mono text-xs font-medium text-white hover:bg-black disabled:opacity-50"
                    >
                      {escaneandoHero ? 'Auditando...' : 'Auditar →'}
                    </button>
                  </div>
                </form>

                {/* Primary Actions */}
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <IslandButton
                    variant="obsidian"
                    onClick={() => setVistaPrincipal('consola')}
                  >
                    Abrir bóveda de auditoría completa
                  </IslandButton>

                  <a
                    href="#rentabilidad"
                    className="press-scale inline-flex items-center gap-2 rounded-full border border-ancla-lineStrong bg-ancla-paper px-5 py-3 font-sans text-xs font-semibold uppercase tracking-[0.08em] text-ancla-ink hover:border-ancla-ink"
                  >
                    Ver modelo de comisiones
                  </a>
                </div>

                {/* Key Metrics Bar */}
                <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-ancla-line pt-5">
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-ancla-inkMuted">
                      BAJADA HOTEL MEDIA
                    </dt>
                    <dd className="mt-1 font-mono text-xl font-semibold tabular-nums text-ancla-clinical">
                      -$185 USD
                    </dd>
                    <span className="text-[11px] text-ancla-inkSecondary">
                      En reservas reembolsables
                    </span>
                  </div>

                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-ancla-inkMuted">
                      TASAS POR BOLETO
                    </dt>
                    <dd className="mt-1 font-mono text-xl font-semibold tabular-nums text-ancla-ink">
                      35% – 55%
                    </dd>
                    <span className="text-[11px] text-ancla-inkSecondary">
                      Exigible por ley en LATAM
                    </span>
                  </div>

                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-ancla-inkMuted">
                      COMISIÓN DIRECTA
                    </dt>
                    <dd className="mt-1 font-mono text-xl font-semibold tabular-nums text-ancla-signal">
                      100% Tuya
                    </dd>
                    <span className="text-[11px] text-ancla-inkSecondary">
                      Stay22 + Travelpayouts
                    </span>
                  </div>
                </dl>
              </div>

              {/* Right 7 Cols: Interactive Forensic Radiograph Widget */}
              <div className="lg:col-span-7">
                <WidgetAuditorInteractivo
                  caso={casoHeroActivo}
                  casosDisponibles={casosHero}
                  onSelectCaso={setCasoHeroActivo}
                  mostrarSelectorInterno={true}
                />
              </div>
            </div>
          </section>

          {/* SECTION 2: ASYMMETRICAL BENTO — HOW BOTH ENGINES MAKE MONEY WITHOUT STOPPERS */}
          <section
            id="motores"
            aria-labelledby="motores-heading"
            className="border-t border-ancla-line bg-ancla-paper py-24 sm:py-32"
          >
            <div className="mx-auto max-w-[1380px] px-4 sm:px-8">
              <div className="reveal-item max-w-3xl">
                <span className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ancla-signal">
                  ARQUITECTURA DE MONETIZACIÓN SIN BARRERAS
                </span>
                <h2
                  id="motores-heading"
                  className="mt-3 font-display text-[clamp(1.75rem,3vw,2.65rem)] font-semibold leading-[1.12] tracking-[-0.025em] text-ancla-ink"
                >
                  Gratis e irresistible para el viajero. Comisión afiliada directa y suscripción B2B para ti.
                </h2>
                <p className="mt-4 max-w-[65ch] text-base leading-relaxed text-ancla-inkSecondary">
                  Diseñado específicamente para funcionar hoy mismo con tus integraciones de Claude, Neon Postgres, Stay22 y Travelpayouts sin procesar tarjetas de crédito ajenas ni esperar litigios largos.
                </p>
              </div>

              <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* Engine 1: Hotel Re-Pricer (7 cols) */}
                <SpotlightTray
                  as="article"
                  variant="light"
                  className="reveal-item lg:col-span-7"
                  coreClassName="p-6 sm:p-8 h-full flex flex-col justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded-full bg-ancla-clinicalSoft px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-ancla-clinical">
                        MOTOR 01 · RE-PRICER MAYORISTA DE HOTELES
                      </span>
                      <span className="font-mono text-xs tabular-nums text-ancla-inkMuted">
                        COMISIÓN INMEDIATA DÍA 1
                      </span>
                    </div>

                    <h3 className="mt-5 font-display text-2xl font-semibold tracking-[-0.02em] text-ancla-ink">
                      El cliente ahorra $180 USD gratis; tú te llevas la comisión de la nueva reserva
                    </h3>

                    <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-ancla-inkSecondary">
                      Más del 60% de las habitaciones reservadas en Booking o Expedia bajan de precio antes de la fecha de viaje. Cuando el usuario sube su confirmación a Luanna, nuestro worker compara el precio contra el inventario geolocalizado de Stay22, Hotellook/Travelpayouts y LiteAPI.
                    </p>

                    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-ancla-line bg-ancla-canvas/70 p-4">
                        <div className="flex items-center gap-2 font-mono text-xs font-semibold text-ancla-ink">
                          <IconCheck className="h-3.5 w-3.5 text-ancla-clinical" />
                          <span>Cero fricción de pago</span>
                        </div>
                        <p className="mt-1.5 text-xs text-ancla-inkSecondary">
                          No tienes que cobrarle nada al usuario. Él reserva el precio más barato a través de tu enlace de afiliado y cancela su reserva cara anterior.
                        </p>
                      </div>

                      <div className="rounded-xl border border-ancla-line bg-ancla-canvas/70 p-4">
                        <div className="flex items-center gap-2 font-mono text-xs font-semibold text-ancla-ink">
                          <IconCrosshair className="h-3.5 w-3.5 text-ancla-signal" />
                          <span>Alternativa a &lt;250 metros</span>
                        </div>
                        <p className="mt-1.5 text-xs text-ancla-inkSecondary">
                          Si su mismo hotel no bajó, el mapa de Stay22 le sugiere el hotel 4★/5★ de al lado con un 25% de descuento.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-ancla-line pt-5">
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-ancla-inkMuted">
                        GANANCIA POR RE-RESERVA
                      </span>
                      <p className="font-sans text-xs font-medium text-ancla-ink">
                        +$45 a +$95 USD directos en tu panel de Stay22 / Travelpayouts
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCasoHeroActivo(CASOS_AUDITORIA_DEMO[0])
                        setVistaPrincipal('consola')
                      }}
                      className="press-scale rounded-full bg-ancla-obsidian px-4 py-2 font-mono text-xs text-white hover:bg-black"
                    >
                      Probar Re-Pricer en vivo →
                    </button>
                  </div>
                </SpotlightTray>

                {/* Engine 2: Flight Tax & Delay Recovery (5 cols) */}
                <SpotlightTray
                  as="article"
                  variant="light"
                  className="reveal-item lg:col-span-5"
                  coreClassName="p-6 sm:p-8 h-full flex flex-col justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded-full bg-ancla-signalSoft px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-ancla-signal">
                        MOTOR 02 · RESCATE DE TASAS AÉREAS
                      </span>
                      <span className="font-mono text-xs tabular-nums text-ancla-inkMuted">
                        IMÁN VIRAL &amp; B2B
                      </span>
                    </div>

                    <h3 className="mt-5 font-display text-2xl font-semibold tracking-[-0.02em] text-ancla-ink">
                      El dinero que las aerolíneas retienen cuando alguien pierde un vuelo
                    </h3>

                    <p className="mt-3 text-sm leading-relaxed text-ancla-inkSecondary">
                      En Perú, Colombia, México, Chile y Brasil, si no abordas un vuelo &ldquo;No Reembolsable&rdquo;, la aerolínea está obligada por ley a devolverte el 100% de las tasas de embarque (<code className="font-mono">TUUA, TUA, Aerocivil</code>). Nadie lo reclama porque está oculto.
                    </p>

                    <div className="mt-6 space-y-2.5">
                      <div className="rounded-xl border border-ancla-line bg-ancla-canvas/70 p-3.5">
                        <p className="font-mono text-xs font-semibold text-ancla-ink">
                          Sin cartas poder ni espera de 6 meses
                        </p>
                        <p className="mt-1 text-xs text-ancla-inkSecondary">
                          Claude desglosa los códigos de impuestos del pasaje y redacta el requerimiento legal exacto para que la aerolínea reembolse directo a la tarjeta del pasajero o empresa.
                        </p>
                      </div>

                      <div className="rounded-xl border border-ancla-line bg-ancla-canvas/70 p-3.5">
                        <p className="font-mono text-xs font-semibold text-ancla-ink">
                          Suscripción B2B para Empresas y Agencias
                        </p>
                        <p className="mt-1 text-xs text-ancla-inkSecondary">
                          Las empresas pierden decenas de boletos al año por cambios de reuniones. Pagan $129 USD/mes por tener todos sus pasajes y hoteles auditados.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-ancla-line pt-5">
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-ancla-inkMuted">
                        COBERTURA REGULATORIA
                      </span>
                      <p className="font-sans text-xs font-medium text-ancla-ink">
                        Indecopi (PE) · SIC/RAC3 (CO) · Profeco (MX) · Sernac (CL)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCasoHeroActivo(CASOS_AUDITORIA_DEMO[1])
                        setVistaPrincipal('consola')
                      }}
                      className="press-scale rounded-full border border-ancla-ink bg-transparent px-4 py-2 font-mono text-xs font-medium text-ancla-ink hover:bg-ancla-ink hover:text-white"
                    >
                      Ver reclamo legal →
                    </button>
                  </div>
                </SpotlightTray>
              </div>
            </div>
          </section>

          {/* SECTION 3: COMPETITIVE MATRIX — WHY LUANNA WINS IN LATAM */}
          <section
            id="comparativa"
            aria-labelledby="comparativa-heading"
            className="border-t border-ancla-line bg-ancla-canvas py-24 sm:py-32"
          >
            <div className="mx-auto max-w-[1380px] px-4 sm:px-8">
              <div className="reveal-item max-w-3xl">
                <span className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ancla-inkMuted">
                  POSICIONAMIENTO DIFERENCIADO
                </span>
                <h2
                  id="comparativa-heading"
                  className="mt-3 font-display text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.12] tracking-[-0.025em] text-ancla-ink"
                >
                  Por qué unir el Re-Pricer de Hoteles + Rescate de Tasas crea una categoría propia en LATAM.
                </h2>
              </div>

              <SpotlightTray
                variant="light"
                className="reveal-item mt-10"
                coreClassName="p-5 sm:p-7 overflow-x-auto"
              >
                <table className="w-full min-w-[680px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-ancla-lineStrong font-mono text-[11px] uppercase tracking-wider text-ancla-inkMuted">
                      <th className="py-3 pr-4">Capacidad</th>
                      <th className="py-3 px-4 text-ancla-ink">Luanna Audit (Tu Plataforma)</th>
                      <th className="py-3 px-4">Pruvo (Global)</th>
                      <th className="py-3 px-4">AirHelp / Abogados</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ancla-line font-sans">
                    <tr>
                      <td className="py-3.5 pr-4 font-medium text-ancla-ink">
                        Monitoreo y rebaja de hoteles ya reservados
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-ancla-clinical">
                        Gratis para el usuario (Ganas comisión Stay22 / TP)
                      </td>
                      <td className="py-3.5 px-4 text-ancla-inkSecondary">
                        Sí, pero sin mapa de alternativas al lado
                      </td>
                      <td className="py-3.5 px-4 text-ancla-inkMuted">No tiene</td>
                    </tr>
                    <tr>
                      <td className="py-3.5 pr-4 font-medium text-ancla-ink">
                        Rescate de tasas de boletos perdidos (No-Show Taxes)
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-ancla-clinical">
                        Instantáneo con Claude ($0.002 costo por expediente)
                      </td>
                      <td className="py-3.5 px-4 text-ancla-inkMuted">No tiene</td>
                      <td className="py-3.5 px-4 text-ancla-inkSecondary">
                        No lo hacen (no les es rentable para tickets de $80 USD)
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3.5 pr-4 font-medium text-ancla-ink">
                        Tiempo para que el cliente reciba su dinero
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-ancla-ink">
                        Inmediato en hotel · 7 a 15 días directo a su tarjeta en vuelo
                      </td>
                      <td className="py-3.5 px-4 text-ancla-inkSecondary">Inmediato en hotel</td>
                      <td className="py-3.5 px-4 text-ancla-inkSecondary">
                        4 a 9 meses reteniendo entre 35% y 50%
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3.5 pr-4 font-medium text-ancla-ink">
                        Detector de Exoneración Tributaria (-18% IGV PE / -19% IVA CL-CO)
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-ancla-clinical">
                        Automático según país y pasaporte
                      </td>
                      <td className="py-3.5 px-4 text-ancla-inkMuted">No tiene</td>
                      <td className="py-3.5 px-4 text-ancla-inkMuted">No tiene</td>
                    </tr>
                    <tr>
                      <td className="py-3.5 pr-4 font-medium text-ancla-ink">
                        Negociador directo con recepción (cuando hay paridad tarifaria)
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-ancla-clinical">
                        Carta VIP de igualación o Upgrade gratis en 1 clic
                      </td>
                      <td className="py-3.5 px-4 text-ancla-inkMuted">Se rinde si hay paridad</td>
                      <td className="py-3.5 px-4 text-ancla-inkMuted">No aplica</td>
                    </tr>
                    <tr>
                      <td className="py-3.5 pr-4 font-medium text-ancla-ink">
                        Arbitraje por Cambio de Horario Aéreo + Endoso de Nombre (Armas #4 y #5)
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-ancla-clinical">
                        Convierte tarifa Light en 100% reembolsable o transferible a otro pasajero
                      </td>
                      <td className="py-3.5 px-4 text-ancla-inkMuted">No tiene</td>
                      <td className="py-3.5 px-4 text-ancla-inkMuted">No tiene</td>
                    </tr>
                    <tr>
                      <td className="py-3.5 pr-4 font-medium text-ancla-ink">
                        Bóveda B2B para PYMEs y Agencias en LATAM
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-ancla-clinical">
                        Incluida (auditoria@luanna.app)
                      </td>
                      <td className="py-3.5 px-4 text-ancla-inkMuted">Enfoque B2C antiguo</td>
                      <td className="py-3.5 px-4 text-ancla-inkMuted">Solo reclamos sueltos</td>
                    </tr>
                  </tbody>
                </table>
              </SpotlightTray>

              {/* THE 8 SECRET WEAPONS BENTO GRID */}
              <div className="reveal-item mt-14">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ancla-signal">
                      ARSENAL PROPIETARIO DE 8 ARMAS POST-RESERVA
                    </span>
                    <h3 className="mt-1 font-display text-xl font-semibold text-ancla-ink sm:text-2xl">
                      Las 8 palancas financieras y legales activas en cada voucher que entra a Luanna
                    </h3>
                  </div>
                  <span className="font-mono text-xs text-ancla-inkMuted">
                    ACTIVAS EN HOTELES &amp; VUELOS LATAM
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    {
                      num: 'ARMA 01',
                      titulo: 'Efecto Dinero Gratis (House Money)',
                      desc: 'Invierte el 8% del ahorro recién descubierto en eSIM Airalo, Seguro de Viaje o nuevo vuelo con comisión afiliada directa.',
                      meta: '+$14 a +$26 USD extra p/ti',
                    },
                    {
                      num: 'ARMA 02',
                      titulo: 'Exoneración IGV / IVA Hotelero',
                      desc: 'Detecta automáticamente el ahorro legal de -18% IGV en Perú y -19% IVA en Chile y Colombia para no domiciliados.',
                      meta: '-18% a -19% en check-in',
                    },
                    {
                      num: 'ARMA 03',
                      titulo: 'Negociador VIP Anti-Paridad',
                      desc: 'Si todas las OTAs tienen el mismo precio, redacta una contraoferta a recepción pidiendo igualar tarifa mayorista o Upgrade a suite + desayuno.',
                      meta: 'Cero paridad OTA',
                    },
                    {
                      num: 'ARMA 04',
                      titulo: 'Schedule Change Hack Aéreo',
                      desc: 'Cuando la aerolínea mueve el horario (>15-60 min), convierte una tarifa Light No Reembolsable en 100% reembolsable o cambio gratis al vuelo caro.',
                      meta: '100% del boleto rescatado',
                    },
                    {
                      num: 'ARMA 05',
                      titulo: 'Endoso Legal de Pasaje a Tercero',
                      desc: 'Transfiere un pasaje no usado a otra persona sin pagar penalidad (Ley 29571 Art. 66.7 en Perú, Ley 21.392 en Chile y RAC 3 en Colombia).',
                      meta: 'Cero pérdida corporativa',
                    },
                    {
                      num: 'ARMA 06',
                      titulo: 'Rescate de Asiento y Equipaje',
                      desc: 'Exige devolución de asientos pagados por cambio de avión y activa indemnización del Convenio de Montreal por demora de maleta.',
                      meta: 'Hasta $1,680 USD (1,288 DEG)',
                    },
                    {
                      num: 'ARMA 07',
                      titulo: 'Escudo Anti-Cargos Fantasma',
                      desc: 'Bloquea cobros voluntarios en check-in como el Seguro Hotelero en Colombia, Resort Fees sorpresivos y conversión DCC en POS.',
                      meta: '+$28 a +$45 USD evitados',
                    },
                    {
                      num: 'ARMA 08',
                      titulo: 'Pase Viral de Compañeros de Viaje',
                      desc: 'En 1 clic genera un aviso para colegas o amigos del mismo hotel o vuelo para que también rebajen su habitación o reclamen sus tasas.',
                      meta: 'Crecimiento viral K-factor',
                    },
                  ].map((arma) => (
                    <div
                      key={arma.num}
                      className="flex flex-col justify-between rounded-2xl border border-ancla-lineStrong bg-ancla-paper p-4"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="rounded bg-ancla-obsidian px-2 py-0.5 font-mono text-[10px] font-semibold text-white">
                            {arma.num}
                          </span>
                          <span className="font-mono text-[10px] font-medium text-ancla-clinical">
                            {arma.meta}
                          </span>
                        </div>
                        <h4 className="mt-3 font-display text-sm font-semibold text-ancla-ink">
                          {arma.titulo}
                        </h4>
                        <p className="mt-1.5 text-xs leading-relaxed text-ancla-inkSecondary">
                          {arma.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 4: INTERACTIVE BUSINESS & COMMISSION SIMULATOR */}
          <section
            id="rentabilidad"
            aria-labelledby="rentabilidad-heading"
            className="border-t border-ancla-line bg-ancla-paper py-24 sm:py-32"
          >
            <div className="mx-auto max-w-[1380px] px-4 sm:px-8">
              <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
                <div className="lg:col-span-5">
                  <span className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ancla-clinical">
                    SIMULADOR DE INGRESOS DIRECTOS
                  </span>
                  <h2
                    id="rentabilidad-heading"
                    className="mt-3 font-display text-[clamp(1.75rem,2.8vw,2.45rem)] font-semibold leading-[1.12] tracking-[-0.025em] text-ancla-ink"
                  >
                    Cuánto factura Luanna combinando comisiones de re-booking + cuentas B2B.
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-ancla-inkSecondary">
                    Cada reserva de hotel que baja de precio te genera comisión afiliada directa en Stay22 / Travelpayouts. Cada empresa o agencia conectada suma ingresos recurrentes mensuales (MRR).
                  </p>

                  <div className="mt-6 space-y-5 rounded-2xl border border-ancla-lineStrong bg-ancla-canvas p-5">
                    <div>
                      <div className="flex justify-between text-xs">
                        <label htmlFor={`${simId}-res`} className="font-medium text-ancla-ink">
                          Reservas auditadas al mes (B2C + B2B)
                        </label>
                        <span className="font-mono font-semibold tabular-nums">
                          {reservasMesSim} reservas
                        </span>
                      </div>
                      <input
                        id={`${simId}-res`}
                        type="range"
                        min={50}
                        max={2500}
                        step={50}
                        value={reservasMesSim}
                        onChange={(e) => setReservasMesSim(Number(e.target.value))}
                        className="mt-2 w-full accent-ancla-signal"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs">
                        <label htmlFor={`${simId}-ticket`} className="font-medium text-ancla-ink">
                          Valor promedio de reserva de hotel
                        </label>
                        <span className="font-mono font-semibold tabular-nums">
                          ${ticketHotelSim} USD
                        </span>
                      </div>
                      <input
                        id={`${simId}-ticket`}
                        type="range"
                        min={300}
                        max={1600}
                        step={50}
                        value={ticketHotelSim}
                        onChange={(e) => setTicketHotelSim(Number(e.target.value))}
                        className="mt-2 w-full accent-ancla-obsidian"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs">
                        <label htmlFor={`${simId}-b2b`} className="font-medium text-ancla-ink">
                          Empresas / Agencias en Plan Pro ($129/mes)
                        </label>
                        <span className="font-mono font-semibold tabular-nums text-ancla-clinical">
                          {empresasB2BSim} cuentas B2B
                        </span>
                      </div>
                      <input
                        id={`${simId}-b2b`}
                        type="range"
                        min={0}
                        max={120}
                        step={2}
                        value={empresasB2BSim}
                        onChange={(e) => setEmpresasB2BSim(Number(e.target.value))}
                        className="mt-2 w-full accent-ancla-clinical"
                      />
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-7">
                  <SpotlightTray variant="dark" coreClassName="p-6 sm:p-8">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-4">
                      <span className="font-mono text-xs uppercase tracking-[0.14em] text-[#b8b3a8]">
                        PROYECCIÓN FINANCIERA MENSUAL Y ANUAL (USD)
                      </span>
                      <span className="rounded-full bg-[#19674e]/35 border border-[#45b892]/40 px-3 py-0.5 font-mono text-[11px] text-[#9ef0d2]">
                        Ahorro generado a clientes: ${proyeccionSim.ahorroTotalGeneradoClientesMesUsd.toLocaleString('en-US')}/mes
                      </span>
                    </div>

                    <div
                      aria-live="polite"
                      className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3"
                    >
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[#9e998e]">
                          COMISIONES HOTEL AFILIADO / MES
                        </span>
                        <p className="mt-2 font-display text-3xl font-semibold text-[#fdfcfa]">
                          <TabularNumber
                            value={proyeccionSim.comisionHotelesAfiliadosMesUsd}
                            prefix="$"
                          />
                        </p>
                        <p className="mt-1 font-mono text-[11px] text-[#9e998e]">
                          En {proyeccionSim.hotelesConBajadaDetectadaMes} re-reservas exitosas
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[#9e998e]">
                          SUSCRIPCIONES B2B / MES
                        </span>
                        <p className="mt-2 font-display text-3xl font-semibold text-[#fdfcfa]">
                          <TabularNumber
                            value={proyeccionSim.ingresoSaasB2BMesUsd}
                            prefix="$"
                          />
                        </p>
                        <p className="mt-1 font-mono text-[11px] text-[#9e998e]">
                          +{proyeccionSim.boletosConTasasRecuperadasMes} boletos rescatados/mes
                        </p>
                      </div>

                      <div className="rounded-xl border border-[#45b892]/35 bg-[#19674e]/20 p-4">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[#9ef0d2]">
                          INGRESO NETO LUANNA / MES
                        </span>
                        <p className="mt-2 font-display text-3xl font-semibold text-[#9ef0d2]">
                          <TabularNumber
                            value={proyeccionSim.ingresoNetoTotalLuannaMesUsd}
                            prefix="$"
                          />
                        </p>
                        <p className="mt-1 font-mono text-[11px] text-[#d5d1c8]">
                          <TabularNumber
                            value={proyeccionSim.ingresoNetoTotalLuannaAnualUsd}
                            prefix="$"
                            suffix=" USD / año"
                          />
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-col justify-between gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center">
                      <p className="max-w-md text-xs text-[#b8b3a8]">
                        Todo el flujo de afiliados entra directo a tus cuentas actuales de{' '}
                        <strong className="text-white">Stay22 y Travelpayouts</strong> sin intermediar fondos.
                      </p>

                      <IslandButton
                        variant="signal"
                        onClick={() => setVistaPrincipal('consola')}
                      >
                        Entrar a la bóveda de auditoría
                      </IslandButton>
                    </div>
                  </SpotlightTray>
                </div>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* Minimal Architectural Footer */}
      <footer className="border-t border-ancla-line bg-ancla-canvas py-10">
        <div className="mx-auto flex max-w-[1380px] flex-col items-start justify-between gap-4 px-4 sm:flex-row sm:items-center sm:px-8">
          <div className="flex items-center gap-3">
            <span className="font-display text-base font-bold text-ancla-ink">
              luanna / audit
            </span>
            <span className="font-mono text-xs text-ancla-inkMuted">
              Arbitraje Mayorista de Hoteles &amp; Rescate de Tasas Aéreas · LATAM
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-5 font-mono text-xs text-ancla-inkSecondary">
            <button
              type="button"
              onClick={() => setVistaPrincipal('landing')}
              className="hover:text-ancla-ink"
            >
              Portada Pública
            </button>
            <button
              type="button"
              onClick={() => setVistaPrincipal('consola')}
              className="hover:text-ancla-ink"
            >
              Bóveda de Auditoría
            </button>
            <a href="/plataforma" className="hover:text-ancla-ink">
              /plataforma
            </a>
            <a href="/eventos" className="hover:text-ancla-ink">
              /eventos
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

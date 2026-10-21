'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  ANCLAS_CATALOGO,
  calcularEconomiaAncla,
  filtrarAlojamientosPorReglas,
  type VerticalAncla,
} from '@/lib/ancla-engine'
import {
  BlurWordReveal,
  IconCheck,
  IconRoute,
  IslandButton,
  SegmentedControl,
  SpotlightTray,
  TabularNumber,
} from '@/components/ui/reactbits'
import { WidgetAnclaInteractivo } from '@/components/WidgetAnclaInteractivo'
import { ConsolaAncla } from '@/components/plataforma/ConsolaAncla'

export default function AnclaLanding() {
  const simId = useId()
  const [vistaPrincipal, cambiarVistaPrincipal] = useState<'landing' | 'consola'>('landing')
  const setVistaPrincipal = (vista: 'landing' | 'consola') => {
    if (vista === 'consola') window.location.assign('/plataforma')
    else cambiarVistaPrincipal(vista)
  }

  // Hero interactive anchor state
  const [verticalHero, setVerticalHero] = useState<VerticalAncla>('clinica')
  const anclaHero = useMemo(
    () =>
      ANCLAS_CATALOGO.find((a) => a.vertical === verticalHero) ?? ANCLAS_CATALOGO[0],
    [verticalHero]
  )

  const [origenHero, setOrigenHero] = useState<string>(
    anclaHero.origenesFrecuentes[0] ?? 'MIA'
  )
  const [reglasHero, setReglasHero] = useState<string[]>(
    anclaHero.reglasDisponibles.filter((r) => r.obligatoriaPorDefecto).map((r) => r.id)
  )
  const [alojamientoHeroId, setAlojamientoHeroId] = useState<string>(
    anclaHero.alojamientos[0]?.id ?? ''
  )

  useEffect(() => {
    setOrigenHero(anclaHero.origenesFrecuentes[0] ?? 'MIA')
    setReglasHero(
      anclaHero.reglasDisponibles.filter((r) => r.obligatoriaPorDefecto).map((r) => r.id)
    )
    setAlojamientoHeroId(anclaHero.alojamientos[0]?.id ?? '')
  }, [anclaHero])

  const alojamientosHeroFiltrados = useMemo(
    () =>
      filtrarAlojamientosPorReglas(
        anclaHero,
        reglasHero,
        anclaHero.isocronaMinutos
      ),
    [anclaHero, reglasHero]
  )

  const alojamientoHeroSeleccionado = useMemo(
    () =>
      alojamientosHeroFiltrados.find((a) => a.id === alojamientoHeroId) ??
      alojamientosHeroFiltrados[0] ??
      anclaHero.alojamientos[0],
    [alojamientosHeroFiltrados, alojamientoHeroId, anclaHero]
  )

  const cotizacionHero = useMemo(
    () =>
      calcularEconomiaAncla({
        tarifaNetaNocheUsd: alojamientoHeroSeleccionado?.tarifaNetaUsd ?? 90,
        noches: anclaHero.nochesSugeridas,
        markupPorcentaje: anclaHero.markupPorcentaje,
        duffelFlexActivo: anclaHero.duffelFlexActivo,
        esimIncluida: anclaHero.esimIncluida,
        seguroActivo: anclaHero.seguroActivo,
        volumenMensualViajeros: anclaHero.volumenMensualBase,
        tasaConversionPostCheckout: anclaHero.tasaConversionPostCheckout,
      }),
    [alojamientoHeroSeleccionado, anclaHero]
  )

  // Section 3: Interactive Unit Economics Simulator State
  const [verticalSim, setVerticalSim] = useState<VerticalAncla>('clinica')
  const [volumenSim, setVolumenSim] = useState<number>(90)
  const [nochesSim, setNochesSim] = useState<number>(5)
  const [markupSim, setMarkupSim] = useState<number>(14)

  const handleCambiarVerticalSim = (nueva: VerticalAncla) => {
    setVerticalSim(nueva)
    if (nueva === 'clinica') {
      setVolumenSim(90)
      setNochesSim(5)
      setMarkupSim(14)
    } else {
      setVolumenSim(650)
      setNochesSim(3)
      setMarkupSim(12)
    }
  }

  const cotizacionSim = useMemo(
    () =>
      calcularEconomiaAncla({
        tarifaNetaNocheUsd: verticalSim === 'clinica' ? 92 : 84,
        noches: nochesSim,
        markupPorcentaje: markupSim,
        duffelFlexActivo: true,
        esimIncluida: true,
        seguroActivo: verticalSim === 'clinica',
        volumenMensualViajeros: volumenSim,
        tasaConversionPostCheckout: verticalSim === 'clinica' ? 0.64 : 0.32,
      }),
    [verticalSim, nochesSim, markupSim, volumenSim]
  )

  // IntersectionObserver for scroll-entry sections
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

  const toggleReglaHero = (id: string) => {
    setReglasHero((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  return (
    <div ref={containerRef} className="min-h-svh bg-ancla-canvas text-ancla-ink">
      {/* Floating Island Navigation Header */}
      <header className="sticky top-4 z-40 mx-auto max-w-[1340px] px-4 sm:px-8">
        <nav
          aria-label="Navegación principal de Luanna Ancla"
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
                ANCLA SDK
              </span>
            </a>

            <span className="hidden border-l border-ancla-line pl-3 font-mono text-[11px] text-ancla-inkMuted xl:inline-block">
              LATAM · B2B2C LOGISTICS ENGINE
            </span>
          </div>

          {/* Center Navigation Links (visible in Landing mode) */}
          {vistaPrincipal === 'landing' ? (
            <div className="hidden items-center gap-6 md:flex">
              <a
                href="#verticales"
                className="font-sans text-xs font-medium text-ancla-inkSecondary transition-colors hover:text-ancla-ink"
              >
                Verticales B2B
              </a>
              <a
                href="#arquitectura"
                className="font-sans text-xs font-medium text-ancla-inkSecondary transition-colors hover:text-ancla-ink"
              >
                Stack de APIs
              </a>
              <a
                href="#rentabilidad"
                className="font-sans text-xs font-medium text-ancla-inkSecondary transition-colors hover:text-ancla-ink"
              >
                Unit Economics
              </a>
              <a
                href="/eventos"
                className="font-sans text-xs font-medium text-ancla-inkSecondary transition-colors hover:text-ancla-ink"
              >
                Eventos SEO
              </a>
            </div>
          ) : null}

          {/* Mode Switcher: Vista Pública vs Consola Interna */}
          <div className="flex items-center gap-2">
            <SegmentedControl
              ariaLabel="Cambiar entre vista pública y consola interna"
              size="sm"
              options={[
                { id: 'landing', label: '01. Propuesta' },
                { id: 'consola', label: '02. Mi plataforma' },
              ]}
              value={vistaPrincipal}
              onChange={setVistaPrincipal}
            />
          </div>
        </nav>
      </header>

      <p className="mx-auto mt-6 max-w-[1340px] px-4 text-sm text-ancla-inkSecondary sm:px-8">
        Demo del producto: las tarifas, proyecciones e integraciones mostradas aquí
        son ilustrativas. En Mi plataforma puedes gestionar sedes y publicar
        portales de alojamiento.
      </p>

      {/* Conditional View: Either Internal Platform Console or Public Landing */}
      {vistaPrincipal === 'consola' ? (
        <main id="contenido">
          <ConsolaAncla onVolverLanding={() => setVistaPrincipal('landing')} />
        </main>
      ) : (
        <main id="contenido" className="overflow-hidden">
          {/* HERO SECTION: Asymmetric Editorial + Live Hardware Widget */}
          <section
            aria-labelledby="hero-title"
            className="relative mx-auto max-w-[1380px] px-4 pt-10 pb-20 sm:px-8 sm:pt-14 sm:pb-28"
          >
            <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-8">
              {/* Left 5 Cols: Editorial Thesis & Controls */}
              <div className="lg:col-span-5 lg:pt-2">
                <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-ancla-lineStrong bg-ancla-paper px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-ancla-signal" aria-hidden="true" />
                  <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ancla-ink">
                    INFRAESTRUCTURA B2B2C · CERO WHATSAPP
                  </span>
                </div>

                <BlurWordReveal
                  as="h1"
                  text="Logística geo-anclada donde ya existe una cita médica o una entrada pagada."
                  highlightWords={['geo-anclada', 'médica', 'pagada']}
                  className="mt-5 font-display text-[clamp(2.15rem,3.9vw,3.45rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-ancla-ink"
                />

                <p className="mt-5 max-w-[60ch] font-sans text-base leading-[1.62] text-ancla-inkSecondary">
                  Un paquete tecnológico web (<code className="rounded bg-ancla-tray px-1.5 py-0.5 font-mono text-xs text-ancla-ink">&lt;luanna-anchor /&gt;</code>) para que{' '}
                  <strong className="font-medium text-ancla-ink">clínicas de turismo médico</strong> y{' '}
                  <strong className="font-medium text-ancla-ink">ticketeras de eventos</strong> en LATAM vendan vuelos flexibles, hoteles verificados por isócrona y eSIM en su propia pantalla de confirmación, capturando el 70% del margen neto.
                </p>

                {/* Interactive Case Switcher */}
                <div className="mt-7 rounded-2xl border border-ancla-lineStrong bg-ancla-paper p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ancla-inkMuted">
                      PRUEBA EL MOTOR EN VIVO:
                    </span>
                    <span className="font-mono text-[11px] text-ancla-clinical">
                      Cambia el caso ↓
                    </span>
                  </div>

                  <div className="mt-2.5">
                    <SegmentedControl
                      ariaLabel="Seleccionar vertical demostrativa en vivo"
                      options={[
                        {
                          id: 'clinica',
                          label: 'Clínica Internacional',
                          badge: 'MDE',
                        },
                        {
                          id: 'evento',
                          label: 'Ticketera / Maratón',
                          badge: 'LIM',
                        },
                      ]}
                      value={verticalHero}
                      onChange={setVerticalHero}
                    />
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-ancla-inkSecondary">
                    {verticalHero === 'clinica'
                      ? 'Caso activo: Paciente de Miami agendado para implante bifásico en Medellín. El widget filtra suites con ascensor directo, licuadora y vuelo Duffel con cambio sin penalidad.'
                      : 'Caso activo: Corredor de Santiago inscrito en los 42K de Lima. El widget ancla hoteles a <900m caminables de la partida con desayuno 04:00 AM y late check-out.'}
                  </p>
                </div>

                {/* Primary CTAs */}
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <IslandButton
                    variant="obsidian"
                    onClick={() => setVistaPrincipal('consola')}
                  >
                    Abrir consola y generador SDK
                  </IslandButton>

                  <a
                    href="#rentabilidad"
                    className="press-scale inline-flex items-center gap-2 rounded-full border border-ancla-lineStrong bg-ancla-paper px-5 py-3 font-sans text-xs font-semibold uppercase tracking-[0.08em] text-ancla-ink hover:border-ancla-ink"
                  >
                    Simular márgenes B2B
                  </a>
                </div>

                {/* Key Technical Differentiators */}
                <dl className="mt-9 grid grid-cols-3 gap-4 border-t border-ancla-line pt-6">
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-ancla-inkMuted">
                      CAC DE ADQUISICIÓN
                    </dt>
                    <dd className="mt-1 font-mono text-xl font-semibold tabular-nums text-ancla-ink">
                      $0 USD
                    </dd>
                    <span className="text-[11px] text-ancla-inkSecondary">
                      Tráfico post-checkout
                    </span>
                  </div>

                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-ancla-inkMuted">
                      MARKUP HOTEL NETO
                    </dt>
                    <dd className="mt-1 font-mono text-xl font-semibold tabular-nums text-ancla-clinical">
                      12% – 18%
                    </dd>
                    <span className="text-[11px] text-ancla-inkSecondary">
                      Vía LiteAPI / Stay22
                    </span>
                  </div>

                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-ancla-inkMuted">
                      PESO DEL BUNDLE
                    </dt>
                    <dd className="mt-1 font-mono text-xl font-semibold tabular-nums text-ancla-ink">
                      13.8 KB
                    </dd>
                    <span className="text-[11px] text-ancla-inkSecondary">
                      Web Component aislado
                    </span>
                  </div>
                </dl>
              </div>

              {/* Right 7 Cols: Live Interactive Geo-Anchor Hardware Tray */}
              <div className="lg:col-span-7">
                <WidgetAnclaInteractivo
                  ancla={anclaHero}
                  alojamientosFiltrados={alojamientosHeroFiltrados}
                  alojamientoSeleccionado={alojamientoHeroSeleccionado}
                  onSelectAlojamiento={(aloj) => setAlojamientoHeroId(aloj.id)}
                  isocronaMinutos={anclaHero.isocronaMinutos}
                  reglasActivasIds={reglasHero}
                  onToggleRegla={toggleReglaHero}
                  cotizacion={cotizacionHero}
                  origenSeleccionado={origenHero}
                  onSelectOrigen={setOrigenHero}
                />
              </div>
            </div>
          </section>

          {/* SECTION 2: ASYMMETRICAL BENTO — TWO HIGH-MARGIN VERTICALS ON ONE ENGINE */}
          <section
            id="verticales"
            aria-labelledby="verticales-heading"
            className="border-t border-ancla-line bg-ancla-paper py-24 sm:py-32"
          >
            <div className="mx-auto max-w-[1380px] px-4 sm:px-8">
              <div className="reveal-item max-w-3xl">
                <span className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ancla-signal">
                  TESIS DE OCÉANO AZUL EN LATINOAMÉRICA
                </span>
                <h2
                  id="verticales-heading"
                  className="mt-3 font-display text-[clamp(1.75rem,3vw,2.65rem)] font-semibold leading-[1.12] tracking-[-0.025em] text-ancla-ink"
                >
                  No competimos por el turista vacacional indeciso. Capturamos viajes con fecha y coordenada obligatorias.
                </h2>
                <p className="mt-4 max-w-[65ch] text-base leading-relaxed text-ancla-inkSecondary">
                  Cuando una persona paga una cirugía en Medellín o un dorsal de maratón en Lima, el viaje no es opcional. Sin embargo, las clínicas y ticketeras de LATAM regalan el 100% de esa transacción logística a OTAs genéricas.
                </p>
              </div>

              {/* Asymmetrical Bento Grid (7 cols + 5 cols) */}
              <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* Vertical 1: Medical & Dental Tourism (7 cols) */}
                <SpotlightTray
                  as="article"
                  variant="light"
                  className="reveal-item lg:col-span-7"
                  coreClassName="p-6 sm:p-8 h-full flex flex-col justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded-full bg-ancla-clinicalSoft px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-ancla-clinical">
                        VERTICAL 01 · TURISMO MÉDICO Y DENTAL B2B
                      </span>
                      <span className="font-mono text-xs tabular-nums text-ancla-inkMuted">
                        TICKET LOGÍSTICO: $1,200 – $4,500 USD
                      </span>
                    </div>

                    <h3 className="mt-5 font-display text-2xl font-semibold tracking-[-0.02em] text-ancla-ink">
                      Portales de recuperación quirúrgica sin hojas de cálculo
                    </h3>

                    <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-ancla-inkSecondary">
                      Clínicas odontológicas, oftalmológicas y plásticas en Colombia, México, Costa Rica y Perú pierden hasta el 35% de pacientes internacionales por fricción logística. Luanna genera un checkout anclado al quirófano con requerimientos médicos auditados.
                    </p>

                    <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <li className="rounded-xl border border-ancla-line bg-ancla-canvas/70 p-3.5">
                        <div className="flex items-center gap-2 font-mono text-xs font-semibold text-ancla-ink">
                          <IconCheck className="h-3.5 w-3.5 text-ancla-clinical" />
                          <span>Filtros de post-operatorio</span>
                        </div>
                        <p className="mt-1 text-xs text-ancla-inkSecondary">
                          Ascensor sin escalones, licuadora/cocina para dieta blanda, cortinas blackout y ruido menor a 45 dB.
                        </p>
                      </li>

                      <li className="rounded-xl border border-ancla-line bg-ancla-canvas/70 p-3.5">
                        <div className="flex items-center gap-2 font-mono text-xs font-semibold text-ancla-ink">
                          <IconRoute className="h-3.5 w-3.5 text-ancla-signal" />
                          <span>Vuelos Duffel Flex (2 fases)</span>
                        </div>
                        <p className="mt-1 text-xs text-ancla-inkSecondary">
                          Tarifas que permiten postergar el vuelo de retorno sin penalidad si el especialista extiende el control clínico.
                        </p>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-ancla-line pt-5">
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-ancla-inkMuted">
                        MODELO PARA LA CLÍNICA
                      </span>
                      <p className="font-sans text-xs font-medium text-ancla-ink">
                        SaaS $199/mes + 70% del markup mayorista ($85–$160 USD por paciente)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setVerticalHero('clinica')
                        setVistaPrincipal('consola')
                      }}
                      className="press-scale rounded-full bg-ancla-obsidian px-4 py-2 font-mono text-xs text-white hover:bg-black"
                    >
                      Calibrar clínica en consola →
                    </button>
                  </div>
                </SpotlightTray>

                {/* Vertical 2: Event Ticketing & Sports Logistics (5 cols) */}
                <SpotlightTray
                  as="article"
                  variant="light"
                  className="reveal-item lg:col-span-5"
                  coreClassName="p-6 sm:p-8 h-full flex flex-col justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded-full bg-ancla-signalSoft px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-ancla-signal">
                        VERTICAL 02 · TICKETERAS Y EVENTOS
                      </span>
                      <span className="font-mono text-xs tabular-nums text-ancla-inkMuted">
                        ALTO VOLUMEN
                      </span>
                    </div>

                    <h3 className="mt-5 font-display text-2xl font-semibold tracking-[-0.02em] text-ancla-ink">
                      El componente post-checkout para maratones y congresos
                    </h3>

                    <p className="mt-3 text-sm leading-relaxed text-ancla-inkSecondary">
                      Se inserta con 2 líneas de código en la página de confirmación de cualquier ticketera o congreso. Ancla el inventario hotelero exactamente en la coordenada del corral de partida o centro de convenciones.
                    </p>

                    <div className="mt-6 space-y-2.5">
                      <div className="rounded-xl border border-ancla-line bg-ancla-canvas/70 p-3.5">
                        <p className="font-mono text-xs font-semibold text-ancla-ink">
                          Isócronas reales de cierre vial (05:00 AM)
                        </p>
                        <p className="mt-1 text-xs text-ancla-inkSecondary">
                          Filtra hoteles a distancia caminable real de la partida, con desayuno a las 04:00 AM y late check-out tras cruzar la meta.
                        </p>
                      </div>

                      <div className="rounded-xl border border-ancla-line bg-ancla-canvas/70 p-3.5">
                        <p className="font-mono text-xs font-semibold text-ancla-ink">
                          Patrocinio de Hoteles Oficiales + Rev-Share
                        </p>
                        <p className="mt-1 text-xs text-ancla-inkSecondary">
                          El organizador monetiza cada asistente foráneo sin asumir riesgo de bloqueo de habitaciones.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-ancla-line pt-5">
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-ancla-inkMuted">
                        INTEGRACIÓN
                      </span>
                      <p className="font-sans text-xs font-medium text-ancla-ink">
                        Instalación gratis · 70/30 Revenue Share automático
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setVerticalHero('evento')
                        setVistaPrincipal('consola')
                      }}
                      className="press-scale rounded-full border border-ancla-ink bg-transparent px-4 py-2 font-mono text-xs font-medium text-ancla-ink hover:bg-ancla-ink hover:text-white"
                    >
                      Probar SDK de eventos →
                    </button>
                  </div>
                </SpotlightTray>
              </div>
            </div>
          </section>

          {/* SECTION 3: LOW-COST API & WHITE-LABEL INFRASTRUCTURE */}
          <section
            id="arquitectura"
            aria-labelledby="arquitectura-heading"
            className="border-t border-ancla-line bg-ancla-canvas py-24 sm:py-32"
          >
            <div className="mx-auto max-w-[1380px] px-4 sm:px-8">
              <div className="reveal-item flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
                <div className="max-w-2xl">
                  <span className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ancla-inkMuted">
                    ARQUITECTURA PLUG-AND-PLAY · COSTO FIJO CASI CERO
                  </span>
                  <h2
                    id="arquitectura-heading"
                    className="mt-3 font-display text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.12] tracking-[-0.025em] text-ancla-ink"
                  >
                    Construido sobre APIs de tarifa neta y white-labels sin mínimos mensuales.
                  </h2>
                </div>

                <p className="max-w-md text-sm text-ancla-inkSecondary">
                  Sin acreditación IATA costosa, sin depósitos de garantía en aerolíneas y sin servidores pesados. Todo corre sobre Cloudflare Workers, Neon Postgres y cuatro proveedores de inventario conectables hoy mismo.
                </p>
              </div>

              <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    codigo: 'CAPA 01 · HOTELES TARIFA NETA',
                    proveedor: 'LiteAPI + Stay22',
                    detalle:
                      'Acceso inmediato a más de 2 millones de propiedades con tarifas mayoristas netas. Permite inyectar un markup dinámico del 10% al 18% por encima del costo neto sin contratos manuales.',
                    costo: '$0 fijo mensual · Pago por reserva',
                  },
                  {
                    codigo: 'CAPA 02 · VUELOS FLEXIBLES',
                    proveedor: 'Duffel Flights API',
                    detalle:
                      'Emisión de vuelos reales en más de 300 aerolíneas sin licencia IATA. Soporta tarifas con cambios médicos sin penalidad, equipaje deportivo y cobro de markup directo en el checkout.',
                    costo: 'Sin depósito inicial · Pay-as-you-go',
                  },
                  {
                    codigo: 'CAPA 03 · ISÓCRONAS Y RUTAS',
                    proveedor: 'Mapbox Isochrone + R2',
                    detalle:
                      'Calcula polígonos reales de tiempo de traslado en hora pico para Lima, Bogotá, Medellín, San José, Santiago y CDMX, más trazados GPX servidos desde Cloudflare R2.',
                    costo: 'Capa gratuita generosa + caché en Edge',
                  },
                  {
                    codigo: 'CAPA 04 · EXTRAS DE ALTO MARGEN',
                    proveedor: 'Airalo Partner + Seguros',
                    detalle:
                      'Acopla eSIM de datos locales y seguro de complicaciones post-operatorias o cancelación de dorsal en un solo clic, sumando hasta $22 USD de margen limpio adicional por viajero.',
                    costo: '15% a 30% de comisión directa',
                  },
                ].map((item) => (
                  <SpotlightTray
                    key={item.codigo}
                    as="article"
                    variant="light"
                    className="reveal-item"
                    coreClassName="p-5 h-full flex flex-col justify-between"
                  >
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ancla-signal">
                        {item.codigo}
                      </span>
                      <h3 className="mt-2 font-display text-lg font-semibold text-ancla-ink">
                        {item.proveedor}
                      </h3>
                      <p className="mt-2.5 text-xs leading-relaxed text-ancla-inkSecondary">
                        {item.detalle}
                      </p>
                    </div>

                    <div className="mt-5 border-t border-ancla-line pt-3">
                      <span className="font-mono text-[11px] font-medium text-ancla-clinical">
                        {item.costo}
                      </span>
                    </div>
                  </SpotlightTray>
                ))}
              </div>
            </div>
          </section>

          {/* SECTION 4: INTERACTIVE UNIT ECONOMICS SIMULATOR */}
          <section
            id="rentabilidad"
            aria-labelledby="rentabilidad-heading"
            className="border-t border-ancla-line bg-ancla-paper py-24 sm:py-32"
          >
            <div className="mx-auto max-w-[1380px] px-4 sm:px-8">
              <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
                {/* Left 5 Cols: Controls */}
                <div className="lg:col-span-5">
                  <span className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ancla-clinical">
                    SIMULADOR DE RENTABILIDAD B2B2C
                  </span>
                  <h2
                    id="rentabilidad-heading"
                    className="mt-3 font-display text-[clamp(1.75rem,2.8vw,2.45rem)] font-semibold leading-[1.12] tracking-[-0.025em] text-ancla-ink"
                  >
                    Calcula el retorno mensual por clínica o ticketera aliada.
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-ancla-inkSecondary">
                    Ajusta el volumen mensual de pacientes o asistentes foráneos y el porcentaje de markup sobre tarifa neta mayorista.
                  </p>

                  <div className="mt-6 space-y-5 rounded-2xl border border-ancla-lineStrong bg-ancla-canvas p-5">
                    <div>
                      <span className="block font-mono text-[11px] uppercase tracking-wider text-ancla-inkMuted">
                        TIPO DE ALIADO B2B
                      </span>
                      <div className="mt-2">
                        <SegmentedControl
                          ariaLabel="Tipo de aliado para simular rentabilidad"
                          options={[
                            { id: 'clinica', label: 'Clínica Médica / Dental' },
                            { id: 'evento', label: 'Ticketera / Evento' },
                          ]}
                          value={verticalSim}
                          onChange={handleCambiarVerticalSim}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs">
                        <label htmlFor={`${simId}-vol`} className="font-medium text-ancla-ink">
                          {verticalSim === 'clinica'
                            ? 'Pacientes internacionales / mes'
                            : 'Asistentes viajeros / mes'}
                        </label>
                        <span className="font-mono font-semibold tabular-nums">
                          {volumenSim} viajeros
                        </span>
                      </div>
                      <input
                        id={`${simId}-vol`}
                        type="range"
                        min={verticalSim === 'clinica' ? 20 : 100}
                        max={verticalSim === 'clinica' ? 300 : 3000}
                        step={verticalSim === 'clinica' ? 10 : 50}
                        value={volumenSim}
                        onChange={(e) => setVolumenSim(Number(e.target.value))}
                        className="mt-2 w-full accent-ancla-signal"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex justify-between text-xs">
                          <label htmlFor={`${simId}-noches`} className="font-medium text-ancla-ink">
                            Noches promedio
                          </label>
                          <span className="font-mono font-semibold tabular-nums">
                            {nochesSim}n
                          </span>
                        </div>
                        <input
                          id={`${simId}-noches`}
                          type="range"
                          min={2}
                          max={12}
                          step={1}
                          value={nochesSim}
                          onChange={(e) => setNochesSim(Number(e.target.value))}
                          className="mt-2 w-full accent-ancla-obsidian"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs">
                          <label htmlFor={`${simId}-markup`} className="font-medium text-ancla-ink">
                            Markup Hotel Neto
                          </label>
                          <span className="font-mono font-semibold tabular-nums text-ancla-clinical">
                            +{markupSim}%
                          </span>
                        </div>
                        <input
                          id={`${simId}-markup`}
                          type="range"
                          min={8}
                          max={20}
                          step={1}
                          value={markupSim}
                          onChange={(e) => setMarkupSim(Number(e.target.value))}
                          className="mt-2 w-full accent-ancla-clinical"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right 7 Cols: Live Telemetry Output */}
                <div className="lg:col-span-7">
                  <SpotlightTray variant="dark" coreClassName="p-6 sm:p-8">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-4">
                      <span className="font-mono text-xs uppercase tracking-[0.14em] text-[#b8b3a8]">
                        DESGLOSE UNITARIO Y MENSUAL (EN USD)
                      </span>
                      <span className="rounded-full bg-[#19674e]/35 border border-[#45b892]/40 px-3 py-0.5 font-mono text-[11px] text-[#9ef0d2]">
                        Reparto 70% Aliado / 30% Luanna
                      </span>
                    </div>

                    <div
                      aria-live="polite"
                      className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3"
                    >
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[#9e998e]">
                          MARGEN SOCIO / RESERVA
                        </span>
                        <p className="mt-2 font-display text-3xl font-semibold text-[#fdfcfa]">
                          <TabularNumber
                            value={cotizacionSim.ingresoNetoSocioPorReservaUsd}
                            prefix="$"
                          />
                        </p>
                        <p className="mt-1 font-mono text-[11px] text-[#9e998e]">
                          +<TabularNumber value={cotizacionSim.ingresoNetoLuannaPorReservaUsd} prefix="$" /> para Luanna
                        </p>
                      </div>

                      <div className="rounded-xl border border-[#45b892]/35 bg-[#19674e]/20 p-4">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[#9ef0d2]">
                          INGRESO NETO ALIADO / MES
                        </span>
                        <p className="mt-2 font-display text-3xl font-semibold text-[#9ef0d2]">
                          <TabularNumber
                            value={cotizacionSim.ingresoNetoMensualSocioUsd}
                            prefix="$"
                          />
                        </p>
                        <p className="mt-1 font-mono text-[11px] text-[#d5d1c8]">
                          En {cotizacionSim.reservasMensualesEstimadas} reservas confirmadas
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[#9e998e]">
                          FLUJO ANUAL POR 1 ALIADO
                        </span>
                        <p className="mt-2 font-display text-3xl font-semibold text-[#fdfcfa]">
                          <TabularNumber
                            value={cotizacionSim.ingresoNetoAnualSocioUsd}
                            prefix="$"
                          />
                        </p>
                        <p className="mt-1 font-mono text-[11px] text-ancla-signal">
                          Escalable a múltiples sedes
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-col justify-between gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center">
                      <p className="max-w-md text-xs text-[#b8b3a8]">
                        Con solo <strong className="text-white">15 clínicas o ticketeras activas</strong> en LATAM, Luanna captura su propio 30% de comisión recurrente más suscripciones SaaS sin gastar un dólar en pauta B2C.
                      </p>

                      <IslandButton
                        variant="signal"
                        onClick={() => setVistaPrincipal('consola')}
                      >
                        Configurar ancla en consola
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
              luanna / ancla
            </span>
            <span className="font-mono text-xs text-ancla-inkMuted">
              Infraestructura B2B2C de Logística Geo-Anclada · LATAM
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-5 font-mono text-xs text-ancla-inkSecondary">
            <button
              type="button"
              onClick={() => setVistaPrincipal('landing')}
              className="hover:text-ancla-ink"
            >
              Propuesta Pública
            </button>
            <button
              type="button"
              onClick={() => setVistaPrincipal('consola')}
              className="hover:text-ancla-ink"
            >
              Consola Interna
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

export type VerticalAncla = 'clinica' | 'evento'

export interface ReglaOperativa {
  id: string
  etiqueta: string
  descripcion: string
  obligatoriaPorDefecto: boolean
}

export interface AlojamientoVerificado {
  id: string
  nombre: string
  distanciaMinutos: number
  distanciaMetros: number
  tarifaNetaUsd: number
  calificacion: number
  cumpleReglas: string[]
  offsetMapa: { x: number; y: number }
  proveedorApi: 'LiteAPI Net' | 'Stay22 Geo' | 'RateHawk B2B'
}

export interface AnclaGeoConfig {
  id: string
  slug: string
  vertical: VerticalAncla
  organizacion: string
  titulo: string
  subtitulo: string
  ciudad: string
  pais: string
  codigoIataDestino: string
  origenesFrecuentes: string[]
  lat: number
  lon: number
  isocronaMinutos: number
  nochesSugeridas: number
  markupPorcentaje: number
  duffelFlexActivo: boolean
  esimIncluida: boolean
  seguroActivo: boolean
  volumenMensualBase: number
  tasaConversionPostCheckout: number
  reglasDisponibles: ReglaOperativa[]
  alojamientos: AlojamientoVerificado[]
}

export interface LiquidacionReciente {
  id: string
  codigoReserva: string
  vertical: VerticalAncla
  anclaNombre: string
  rutaIata: string
  noches: number
  tarifaNetaTotalUsd: number
  precioCheckoutUsd: number
  margenSocioUsd: number
  estado: 'Liquidado' | 'Vuelo emitido' | 'Check-in activo'
  haceMinutos: number
}

export interface CotizacionEconomica {
  noches: number
  tarifaNetaHotelTotalUsd: number
  markupHotelUsd: number
  tarifaVueloBaseUsd: number
  feeVueloFlexibleUsd: number
  ancillariesNetoUsd: number
  precioTotalViajeroUsd: number
  ingresoNetoSocioPorReservaUsd: number
  ingresoNetoLuannaPorReservaUsd: number
  reservasMensualesEstimadas: number
  ingresoNetoMensualSocioUsd: number
  ingresoNetoAnualSocioUsd: number
}

export const ANCLAS_CATALOGO: AnclaGeoConfig[] = [
  {
    id: 'med-implante-mde',
    slug: 'clinica-rehabilitacion-oral-medellin',
    vertical: 'clinica',
    organizacion: 'Instituto Odontológico Quirúrgico El Poblado',
    titulo: 'Protocolo Implante Bifásico & Rehabilitación',
    subtitulo: '5 noches post-operatorias con vuelo flexible ante inflamación',
    ciudad: 'Medellín',
    pais: 'Colombia',
    codigoIataDestino: 'MDE',
    origenesFrecuentes: ['MIA', 'MCO', 'PTY', 'YYZ'],
    lat: 6.2088,
    lon: -75.5658,
    isocronaMinutos: 8,
    nochesSugeridas: 5,
    markupPorcentaje: 14,
    duffelFlexActivo: true,
    esimIncluida: true,
    seguroActivo: true,
    volumenMensualBase: 85,
    tasaConversionPostCheckout: 0.64,
    reglasDisponibles: [
      {
        id: 'ascensor-directo',
        etiqueta: 'Ascensor sin escalones',
        descripcion: 'Acceso directo desde lobby vehicular hasta habitación.',
        obligatoriaPorDefecto: true,
      },
      {
        id: 'dieta-blanda',
        etiqueta: 'Cocina y licuadora en suite',
        descripcion: 'Equipamiento verificado para dieta líquida/blanda post-injerto.',
        obligatoriaPorDefecto: true,
      },
      {
        id: 'aislamiento-acustico',
        etiqueta: 'Ruido nocturno < 45 dB',
        descripcion: 'Habitaciones internas alejadas de corredores nocturnos.',
        obligatoriaPorDefecto: true,
      },
      {
        id: 'duffel-flex',
        etiqueta: 'Vuelo con cambio sin penalidad',
        descripcion: 'Permite mover el retorno +48h si el cirujano extiende el control.',
        obligatoriaPorDefecto: true,
      },
    ],
    alojamientos: [
      {
        id: 'ht-mde-1',
        nombre: 'Suites Médicas Castropol 14',
        distanciaMinutos: 4,
        distanciaMetros: 420,
        tarifaNetaUsd: 92,
        calificacion: 4.9,
        cumpleReglas: ['ascensor-directo', 'dieta-blanda', 'aislamiento-acustico', 'duffel-flex'],
        offsetMapa: { x: 44, y: 42 },
        proveedorApi: 'LiteAPI Net',
      },
      {
        id: 'ht-mde-2',
        nombre: 'Apart-Hotel Clínica Las Lomas',
        distanciaMinutos: 7,
        distanciaMetros: 780,
        tarifaNetaUsd: 84,
        calificacion: 4.8,
        cumpleReglas: ['ascensor-directo', 'dieta-blanda', 'aislamiento-acustico', 'duffel-flex'],
        offsetMapa: { x: 63, y: 35 },
        proveedorApi: 'LiteAPI Net',
      },
      {
        id: 'ht-mde-3',
        nombre: 'Residencia Ejecutiva San Fernando',
        distanciaMinutos: 11,
        distanciaMetros: 1350,
        tarifaNetaUsd: 76,
        calificacion: 4.7,
        cumpleReglas: ['ascensor-directo', 'aislamiento-acustico', 'duffel-flex'],
        offsetMapa: { x: 29, y: 68 },
        proveedorApi: 'RateHawk B2B',
      },
    ],
  },
  {
    id: 'evt-maraton-lim',
    slug: 'maraton-internacional-andes-42k',
    vertical: 'evento',
    organizacion: 'Maratón Internacional de los Andes 42K',
    titulo: 'Corral de Partida Parque Kennedy — 05:30 AM',
    subtitulo: 'Alojamiento a distancia caminable de la largada con desayuno 04:00 AM',
    ciudad: 'Lima',
    pais: 'Perú',
    codigoIataDestino: 'LIM',
    origenesFrecuentes: ['SCL', 'BOG', 'EZE', 'UIO'],
    lat: -12.1219,
    lon: -77.0297,
    isocronaMinutos: 10,
    nochesSugeridas: 3,
    markupPorcentaje: 12,
    duffelFlexActivo: true,
    esimIncluida: true,
    seguroActivo: false,
    volumenMensualBase: 640,
    tasaConversionPostCheckout: 0.31,
    reglasDisponibles: [
      {
        id: 'caminable-partida',
        etiqueta: 'A < 900 m del arco de largada',
        descripcion: 'Sin necesidad de taxi durante el cierre vial de las 04:30 AM.',
        obligatoriaPorDefecto: true,
      },
      {
        id: 'desayuno-madrugada',
        etiqueta: 'Mesa de carbohidratos 04:00 AM',
        descripcion: 'Apertura temprana de comedor confirmada con el hotel.',
        obligatoriaPorDefecto: true,
      },
      {
        id: 'late-checkout',
        etiqueta: 'Late check-out 16:00 garantizado',
        descripcion: 'Permite ducha y descanso tras cruzar la meta.',
        obligatoriaPorDefecto: true,
      },
      {
        id: 'duffel-flex',
        etiqueta: 'Equipaje deportivo pre-pagado',
        descripcion: 'Tarifa aérea con maleta documentada y cambio de fecha.',
        obligatoriaPorDefecto: false,
      },
    ],
    alojamientos: [
      {
        id: 'ht-lim-1',
        nombre: 'Hotel Diagonal Parque Kennedy',
        distanciaMinutos: 3,
        distanciaMetros: 260,
        tarifaNetaUsd: 88,
        calificacion: 4.9,
        cumpleReglas: ['caminable-partida', 'desayuno-madrugada', 'late-checkout', 'duffel-flex'],
        offsetMapa: { x: 54, y: 47 },
        proveedorApi: 'Stay22 Geo',
      },
      {
        id: 'ht-lim-2',
        nombre: 'Miraflores Colón Runner Suites',
        distanciaMinutos: 6,
        distanciaMetros: 540,
        tarifaNetaUsd: 79,
        calificacion: 4.8,
        cumpleReglas: ['caminable-partida', 'desayuno-madrugada', 'late-checkout'],
        offsetMapa: { x: 38, y: 58 },
        proveedorApi: 'LiteAPI Net',
      },
      {
        id: 'ht-lim-3',
        nombre: 'Pardo Business Apartments',
        distanciaMinutos: 9,
        distanciaMetros: 820,
        tarifaNetaUsd: 71,
        calificacion: 4.7,
        cumpleReglas: ['caminable-partida', 'late-checkout'],
        offsetMapa: { x: 67, y: 63 },
        proveedorApi: 'Stay22 Geo',
      },
    ],
  },
  {
    id: 'med-oftalmo-lim',
    slug: 'instituto-cirugia-refractiva-san-isidro',
    vertical: 'clinica',
    organizacion: 'Centro Oftalmológico & Retina San Isidro',
    titulo: 'Cirugía Bilateral & Control Post-72h',
    subtitulo: 'Suites con control lumínico total a 6 minutos del quirófano',
    ciudad: 'Lima',
    pais: 'Perú',
    codigoIataDestino: 'LIM',
    origenesFrecuentes: ['SCL', 'LPB', 'GYE', 'PTY'],
    lat: -12.0968,
    lon: -77.0342,
    isocronaMinutos: 8,
    nochesSugeridas: 4,
    markupPorcentaje: 15,
    duffelFlexActivo: true,
    esimIncluida: true,
    seguroActivo: true,
    volumenMensualBase: 65,
    tasaConversionPostCheckout: 0.68,
    reglasDisponibles: [
      {
        id: 'blackout-total',
        etiqueta: 'Blackout óptico 100%',
        descripcion: 'Cortinas opacas selladas para fotofobia post-quirúrgica.',
        obligatoriaPorDefecto: true,
      },
      {
        id: 'ascensor-directo',
        etiqueta: 'Piso bajo o ascensor sin desnivel',
        descripcion: 'Cero escalones desde recepción hasta la cama.',
        obligatoriaPorDefecto: true,
      },
      {
        id: 'traslado-clinico',
        etiqueta: 'Traslado puerta a puerta incluido',
        descripcion: 'Recogida aeropuerto-hotel-clínica sincronizada con el alta.',
        obligatoriaPorDefecto: true,
      },
    ],
    alojamientos: [
      {
        id: 'ht-oft-1',
        nombre: 'San Isidro Golf Recovery Suites',
        distanciaMinutos: 5,
        distanciaMetros: 490,
        tarifaNetaUsd: 96,
        calificacion: 4.9,
        cumpleReglas: ['blackout-total', 'ascensor-directo', 'traslado-clinico'],
        offsetMapa: { x: 48, y: 39 },
        proveedorApi: 'LiteAPI Net',
      },
      {
        id: 'ht-oft-2',
        nombre: 'Basadre Clinical Residence',
        distanciaMinutos: 7,
        distanciaMetros: 680,
        tarifaNetaUsd: 85,
        calificacion: 4.8,
        cumpleReglas: ['blackout-total', 'ascensor-directo'],
        offsetMapa: { x: 61, y: 55 },
        proveedorApi: 'LiteAPI Net',
      },
    ],
  },
  {
    id: 'evt-cardiologia-bog',
    slug: 'congreso-latam-cardiologia-bogota',
    vertical: 'evento',
    organizacion: 'Congreso LATAM de Cardiología Intervencionista',
    titulo: 'Centro de Convenciones Ágora Bogotá',
    subtitulo: 'Isócrona en hora pico < 10 min con facturación corporativa automática',
    ciudad: 'Bogotá',
    pais: 'Colombia',
    codigoIataDestino: 'BOG',
    origenesFrecuentes: ['MEX', 'LIM', 'GRU', 'SCL'],
    lat: 4.6295,
    lon: -74.0906,
    isocronaMinutos: 10,
    nochesSugeridas: 4,
    markupPorcentaje: 13,
    duffelFlexActivo: true,
    esimIncluida: true,
    seguroActivo: true,
    volumenMensualBase: 420,
    tasaConversionPostCheckout: 0.38,
    reglasDisponibles: [
      {
        id: 'corredor-peatonal',
        etiqueta: 'Corredor seguro a Ágora / Corferias',
        descripcion: 'Evita hasta 55 minutos de trancón en Av. Esperanza hora pico.',
        obligatoriaPorDefecto: true,
      },
      {
        id: 'factura-corporativa',
        etiqueta: 'Factura fiscal unificada (Vuelo + Hotel)',
        descripcion: 'Descarga inmediata para reembolso de laboratorio o hospital.',
        obligatoriaPorDefecto: true,
      },
      {
        id: 'esim-aterrizaje',
        etiqueta: 'eSIM 5GB activa al aterrizar en BOG',
        descripcion: 'Instalación directa sin hacer fila en El Dorado.',
        obligatoriaPorDefecto: true,
      },
    ],
    alojamientos: [
      {
        id: 'ht-bog-1',
        nombre: 'Grand Corferias Executive',
        distanciaMinutos: 4,
        distanciaMetros: 340,
        tarifaNetaUsd: 104,
        calificacion: 4.9,
        cumpleReglas: ['corredor-peatonal', 'factura-corporativa', 'esim-aterrizaje'],
        offsetMapa: { x: 52, y: 44 },
        proveedorApi: 'LiteAPI Net',
      },
      {
        id: 'ht-bog-2',
        nombre: 'Quinta Paredes Congress Suites',
        distanciaMinutos: 7,
        distanciaMetros: 620,
        tarifaNetaUsd: 91,
        calificacion: 4.8,
        cumpleReglas: ['corredor-peatonal', 'factura-corporativa', 'esim-aterrizaje'],
        offsetMapa: { x: 37, y: 52 },
        proveedorApi: 'Stay22 Geo',
      },
    ],
  },
]

export const LIQUIDACIONES_RECIENTES: LiquidacionReciente[] = [
  {
    id: 'liq-01',
    codigoReserva: 'ANC-8941',
    vertical: 'clinica',
    anclaNombre: 'Implante Bifásico · Medellín',
    rutaIata: 'MIA → MDE',
    noches: 5,
    tarifaNetaTotalUsd: 780,
    precioCheckoutUsd: 912,
    margenSocioUsd: 92.4,
    estado: 'Check-in activo',
    haceMinutos: 6,
  },
  {
    id: 'liq-02',
    codigoReserva: 'ANC-8940',
    vertical: 'evento',
    anclaNombre: 'Maratón Andes 42K · Lima',
    rutaIata: 'SCL → LIM',
    noches: 3,
    tarifaNetaTotalUsd: 495,
    precioCheckoutUsd: 569,
    margenSocioUsd: 51.8,
    estado: 'Vuelo emitido',
    haceMinutos: 14,
  },
  {
    id: 'liq-03',
    codigoReserva: 'ANC-8939',
    vertical: 'clinica',
    anclaNombre: 'Cirugía Refractiva · Lima',
    rutaIata: 'UIO → LIM',
    noches: 4,
    tarifaNetaTotalUsd: 640,
    precioCheckoutUsd: 758,
    margenSocioUsd: 82.6,
    estado: 'Liquidado',
    haceMinutos: 29,
  },
  {
    id: 'liq-04',
    codigoReserva: 'ANC-8938',
    vertical: 'evento',
    anclaNombre: 'Congreso Cardiología · Bogotá',
    rutaIata: 'MEX → BOG',
    noches: 4,
    tarifaNetaTotalUsd: 710,
    precioCheckoutUsd: 824,
    margenSocioUsd: 79.8,
    estado: 'Liquidado',
    haceMinutos: 43,
  },
]

export function filtrarAlojamientosPorReglas(
  ancla: AnclaGeoConfig,
  reglasActivasIds: string[],
  isocronaMaximaMinutos: number
): AlojamientoVerificado[] {
  const filtrados = ancla.alojamientos.filter((aloj) => {
    const dentroDeIsocrona = aloj.distanciaMinutos <= isocronaMaximaMinutos
    const cumpleTodas = reglasActivasIds.every((reglaId) =>
      aloj.cumpleReglas.includes(reglaId)
    )
    return dentroDeIsocrona && cumpleTodas
  })

  // Si un filtro extremo deja 0 resultados, devolvemos el más cercano a la clínica/sede
  if (filtrados.length === 0) {
    return [...ancla.alojamientos].sort((a, b) => a.distanciaMinutos - b.distanciaMinutos)
  }

  return filtrados.sort((a, b) => a.distanciaMinutos - b.distanciaMinutos)
}

export function calcularEconomiaAncla(params: {
  tarifaNetaNocheUsd: number
  noches: number
  markupPorcentaje: number
  duffelFlexActivo: boolean
  esimIncluida: boolean
  seguroActivo: boolean
  volumenMensualViajeros: number
  tasaConversionPostCheckout: number
}): CotizacionEconomica {
  const noches = Math.max(1, params.noches)
  const tarifaNetaHotelTotalUsd = Math.round(params.tarifaNetaNocheUsd * noches)
  const markupHotelUsd = Math.round(
    tarifaNetaHotelTotalUsd * (params.markupPorcentaje / 100)
  )

  const tarifaVueloBaseUsd = 310
  const feeVueloFlexibleUsd = params.duffelFlexActivo ? 34 : 14

  // Airalo eSIM ($6 net margin) + Medical/Event Protection ($16 net margin)
  const ancillariesNetoUsd =
    (params.esimIncluida ? 6 : 0) + (params.seguroActivo ? 16 : 0)

  const margenBrutoTotalPorReserva =
    markupHotelUsd + feeVueloFlexibleUsd + ancillariesNetoUsd

  // Reparto 70% Socio (Clínica o Ticketera) / 30% Luanna Ancla
  const ingresoNetoSocioPorReservaUsd = Math.round(margenBrutoTotalPorReserva * 0.7)
  const ingresoNetoLuannaPorReservaUsd =
    margenBrutoTotalPorReserva - ingresoNetoSocioPorReservaUsd

  const precioTotalViajeroUsd =
    tarifaNetaHotelTotalUsd +
    tarifaVueloBaseUsd +
    margenBrutoTotalPorReserva

  const reservasMensualesEstimadas = Math.max(
    1,
    Math.round(params.volumenMensualViajeros * params.tasaConversionPostCheckout)
  )

  const ingresoNetoMensualSocioUsd =
    reservasMensualesEstimadas * ingresoNetoSocioPorReservaUsd
  const ingresoNetoAnualSocioUsd = ingresoNetoMensualSocioUsd * 12

  return {
    noches,
    tarifaNetaHotelTotalUsd,
    markupHotelUsd,
    tarifaVueloBaseUsd,
    feeVueloFlexibleUsd,
    ancillariesNetoUsd,
    precioTotalViajeroUsd,
    ingresoNetoSocioPorReservaUsd,
    ingresoNetoLuannaPorReservaUsd,
    reservasMensualesEstimadas,
    ingresoNetoMensualSocioUsd,
    ingresoNetoAnualSocioUsd,
  }
}

export function generarSnippetSdk(params: {
  ancla: AnclaGeoConfig
  formato: 'web-component' | 'react-sdk' | 'rest-api'
  isocronaMinutos: number
  markupPorcentaje: number
  reglasIds: string[]
}): string {
  const { ancla, formato, isocronaMinutos, markupPorcentaje, reglasIds } = params

  if (formato === 'web-component') {
    return `<!-- 1. Carga el SDK ligero en tu pantalla Post-Checkout (<14 KB gzip) -->
<script type="module" src="https://cdn.luanna.lat/anchor/v2/luanna-anchor.esm.js"></script>

<!-- 2. Ancla el mapa isócrono + hoteles LiteAPI + vuelos Duffel -->
<luanna-anchor
  anchor-id="${ancla.slug}"
  vertical="${ancla.vertical}"
  coords="${ancla.lat},${ancla.lon}"
  destination-iata="${ancla.codigoIataDestino}"
  isochrone-minutes="${isocronaMinutos}"
  nights="${ancla.nochesSugeridas}"
  partner-markup="${markupPorcentaje}"
  mandatory-rules="${reglasIds.join(',')}"
  duffel-flex="${ancla.duffelFlexActivo}"
  airalo-esim="${ancla.esimIncluida}"
></luanna-anchor>`
  }

  if (formato === 'react-sdk') {
    return `import { LuannaAnchorCheckout } from '@luanna/anchor-sdk/react'

export function ConfirmacionPostCompra({ idPacienteOAsistente }: { idPacienteOAsistente: string }) {
  return (
    <LuannaAnchorCheckout
      anchorId="${ancla.slug}"
      vertical="${ancla.vertical}"
      coordinates={{ lat: ${ancla.lat}, lon: ${ancla.lon} }}
      destinationIata="${ancla.codigoIataDestino}"
      isochroneMinutes={${isocronaMinutos}}
      defaultNights={${ancla.nochesSugeridas}}
      partnerMarkupPct={${markupPorcentaje}}
      mandatoryRules={${JSON.stringify(reglasIds)}}
      duffelFlex=${ancla.duffelFlexActivo ? '{true}' : '{false}'}
      referenceId={idPacienteOAsistente}
    />
  )
}`
  }

  return `POST https://api.luanna.lat/v1/anchors/checkout-session
Authorization: Bearer lna_live_98f2a4c1...
Content-Type: application/json

{
  "anchor_id": "${ancla.slug}",
  "vertical": "${ancla.vertical}",
  "geo_anchor": { "lat": ${ancla.lat}, "lon": ${ancla.lon}, "isochrone_min": ${isocronaMinutos} },
  "destination_iata": "${ancla.codigoIataDestino}",
  "nights": ${ancla.nochesSugeridas},
  "pricing": { "partner_markup_pct": ${markupPorcentaje}, "revenue_split": "70/30" },
  "Inventory_providers": ["liteapi_net", "duffel_flex", "stay22_geo", "airalo_esim"],
  "mandatory_filters": ${JSON.stringify(reglasIds)}
}`
}

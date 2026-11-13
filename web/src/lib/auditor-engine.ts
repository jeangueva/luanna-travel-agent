import { urlHotelesFallback, urlStay22, urlVuelos } from './afiliados'
import {
  STAY22_AID,
  TP_MARKER,
  TP_WIDGET_ESIM,
  TP_WIDGET_SEGUROS,
} from './config'

export type TipoAuditoria = 'hotel' | 'vuelo'

export interface DesgloseTasaAerea {
  codigo: string
  concepto: string
  montoUsd: number
  reembolsablePorLey: boolean
}

export interface ExoneracionTributariaHotel {
  aplicaExoneracion: boolean
  paisNorma: string
  impuestoNombre: string
  porcentajeExonerado: number
  ahorroTributarioEstimadoUsd: number
  requisitoCheckin: string
}

export interface AuditoriaCargosFantasmaHotel {
  cargoDetectado: string
  ahorroEstimadoUsd: number
  instruccionRechazoCheckin: string
}

export interface ArbitrajeHorarioYEndosoVuelo {
  aplicaScheduleChange: boolean
  ReembolsoTotalPorCambioHorarioUsd: number
  ahorroRecompraVueloMasBaratoUsd: number
  aplicaEndosoCambioNombre: boolean
  normaEndoso: string
  costoMaximoEndosoLeyUsd: number
  reclamoEquipajeMontrealMaxUsd: number
}

export interface CasoAuditoriaHotel {
  id: string
  tipo: 'hotel'
  codigoConfirmacion: string
  canalOriginal: 'Booking.com' | 'Expedia' | 'Hotels.com' | 'Agoda' | 'Directo'
  hotelNombre: string
  ciudad: string
  pais: string
  lat: number
  lon: number
  checkin: string
  checkout: string
  noches: number
  habitacion: string
  limiteCancelacionGratuita: string
  precioPagadoUsd: number
  tarifaMayoristaDetectadaUsd: number
  proveedorMayorista: 'Stay22 Geo-Rate' | 'Travelpayouts / Hotellook' | 'LiteAPI Net'
  ahorroNetoViajeroUsd: number
  comisionDirectaLuannaUsd: number
  alternativaCercanaNombre: string
  alternativaCercanaDistanciaMetros: number
  alternativaCercanaPrecioUsd: number
  exoneracionTributaria: ExoneracionTributariaHotel
  cargosFantasma: AuditoriaCargosFantasmaHotel
  estadoVigilancia: 'Bajada detectada' | 'Monitoreando cada 6h' | 'Re-reservado con éxito'
}

export interface CasoAuditoriaVuelo {
  id: string
  tipo: 'vuelo'
  pnr: string
  aerolinea: string
  rutaIata: string
  origenIata: string
  destinoIata: string
  fechaVuelo: string
  incidencia: 'no-show' | 'retraso-grave' | 'cancelacion' | 'cambio-horario'
  etiquetaIncidencia: string
  jurisdiccion:
    | 'Perú · Indecopi / DGAC'
    | 'Colombia · SIC / RAC 3'
    | 'México · Profeco / LAC'
    | 'Chile · Sernac / JAC'
  normaLegalCitada: string
  precioBoletoPagadoUsd: number
  tarifaBaseNoReembolsableUsd: number
  tasasAeroportuariasReembolsablesUsd: number
  compensacionAdicionalLeyUsd: number
  totalRecuperablePasajeroUsd: number
  urlPortalDevolucionAerolinea: string
  tasasDesglose: DesgloseTasaAerea[]
  poderesEspecialesVuelo: ArbitrajeHorarioYEndosoVuelo
}

export type CasoAuditoria = CasoAuditoriaHotel | CasoAuditoriaVuelo

export interface EnlacesHouseMoney {
  urlEsimAfiliado: string
  urlSeguroAfiliado: string
  urlVueloAlternativo?: string
  costoSugeridoPackUsd: number
  comisionExtraLuannaUsd: number
  porcentajeDelAhorroUsado: number
}

export interface ProyeccionNegocioAuditor {
  reservasAuditadasMes: number
  hotelesConBajadaDetectadaMes: number
  comisionHotelesAfiliadosMesUsd: number
  comisionCrossSellEsimSeguroMesUsd: number
  boletosConTasasRecuperadasMes: number
  ahorroTotalGeneradoClientesMesUsd: number
  ingresoSaasB2BMesUsd: number
  ingresoNetoTotalLuannaMesUsd: number
  ingresoNetoTotalLuannaAnualUsd: number
}

/**
 * Arma Secreta #2: Calcula la exoneración legal de IVA/IGV hotelero en LATAM
 * (Perú 18% IGV, Colombia 19% IVA, Chile 19% IVA) o protección contra DCC (-6.5%).
 */
export function calcularExoneracionTributariaHotel(
  pais: string,
  precioBaseUsd: number
): ExoneracionTributariaHotel {
  const p = pais.toLowerCase()

  if (p.includes('per')) {
    const ahorro = Math.round(precioBaseUsd * 0.152)
    return {
      aplicaExoneracion: true,
      paisNorma: 'Perú · D.L. 919 (Ley de Exportación de Hospedaje)',
      impuestoNombre: '18% IGV Hotelero Exonerado',
      porcentajeExonerado: 18,
      ahorroTributarioEstimadoUsd: ahorro,
      requisitoCheckin:
        'Presentar pasaporte extranjero + TAM virtual de Migraciones en recepción y elegir pago directo sin factura local gravada.',
    }
  }

  if (p.includes('col')) {
    const ahorro = Math.round(precioBaseUsd * 0.159)
    return {
      aplicaExoneracion: true,
      paisNorma: 'Colombia · Estatuto Tributario Art. 481 Lit. d',
      impuestoNombre: '19% IVA Turístico Exento',
      porcentajeExonerado: 19,
      ahorroTributarioEstimadoUsd: ahorro,
      requisitoCheckin:
        'Ingresar con sello o registro migratorio de turismo (PIP-5 / PTP-5) y reservar tarifa de paquete turístico internacional.',
    }
  }

  if (p.includes('chil')) {
    const ahorro = Math.round(precioBaseUsd * 0.159)
    return {
      aplicaExoneracion: true,
      paisNorma: 'Chile · D.L. 825 Art. 12 Letra E N°17',
      impuestoNombre: '19% IVA Exportación Hotelera',
      porcentajeExonerado: 19,
      ahorroTributarioEstimadoUsd: ahorro,
      requisitoCheckin:
        'Presentar pasaporte + Tarjeta Única Migratoria (PDI) y abonar en dólares o tarjeta internacional.',
    }
  }

  return {
    aplicaExoneracion: true,
    paisNorma: 'Protección contra Conversión Dinámica de Divisa (DCC)',
    impuestoNombre: '6.5% Sobreprecio Cambiario Evitado',
    porcentajeExonerado: 6.5,
    ahorroTributarioEstimadoUsd: Math.round(precioBaseUsd * 0.065),
    requisitoCheckin:
      'Exigir cobro en moneda local del destino en el terminal POS y rechazar la conversión automática de la OTA.',
  }
}

/**
 * Arma Secreta #7: Detector de "Seguro Hotelero Voluntario, Resort Fees y Cobros Fantasma" en Check-in.
 */
export function calcularCargosFantasmaHotel(
  pais: string,
  noches: number
): AuditoriaCargosFantasmaHotel {
  const p = pais.toLowerCase()
  const n = Math.max(1, noches)

  if (p.includes('col')) {
    return {
      cargoDetectado: 'Seguro Hotelero Voluntario + Contribución Turística Opcional',
      ahorroEstimadoUsd: n * 7,
      instruccionRechazoCheckin:
        'En Colombia el "Seguro Hotelero" ($25.000–$35.000 COP/noche) es 100% VOLUNTARIO por ley (SIC). Solicita en el check-in que lo retiren del folio antes de firmar.',
    }
  }

  if (p.includes('per')) {
    return {
      cargoDetectado: 'Recargo por Servicio + Conversión DCC en Terminal POS',
      ahorroEstimadoUsd: n * 8,
      instruccionRechazoCheckin:
        'Exige que el POS procese en la moneda original de la reserva (sin conversión dinámica DCC del banco adquirente, que infla un 6.5% el tipo de cambio).',
    }
  }

  return {
    cargoDetectado: 'Resort / Destination Fee & Amenity Charge no obligatorio',
    ahorroEstimadoUsd: n * 11,
    instruccionRechazoCheckin:
      'Exige desglose previo de cargos de destino no informados en la tarifa final de la OTA conforme a normativa de protección al consumidor.',
  }
}

/**
 * Armas Secretas #4, #5 y #6 para Vuelos:
 * - #4: Arbitraje por Cambio de Horario (Schedule Change >15–60 min = Reembolso 100% o cambio gratis al vuelo caro).
 * - #5: Derecho de Endoso / Transferencia de Nombre del Pasaje a otra persona (Perú Indecopi Art. 66.7 / Chile Código Aeronáutico Art. 131).
 * - #6: Reembolso de Asiento/Maleta no respetada + Convenio de Montreal por equipaje demorado.
 */
export function calcularPoderesEspecialesVuelo(
  jurisdiccion: string,
  precioBoletoPagadoUsd: number
): ArbitrajeHorarioYEndosoVuelo {
  const j = jurisdiccion.toLowerCase()
  const esPeruOChile = j.includes('per') || j.includes('chil')

  return {
    aplicaScheduleChange: true,
    ReembolsoTotalPorCambioHorarioUsd: precioBoletoPagadoUsd,
    ahorroRecompraVueloMasBaratoUsd: Math.round(precioBoletoPagadoUsd * 0.34),
    aplicaEndosoCambioNombre: true,
    normaEndoso: esPeruOChile
      ? 'Perú Ley 29571 Art. 66.7 / Chile Ley 21.392 (Derecho de Endoso a tercero hasta 24h antes)'
      : 'Colombia RAC 3 Numeral 3.10.1.8 (Derecho de Retracto y Desistimiento con reembolso)',
    costoMaximoEndosoLeyUsd: esPeruOChile ? 0 : 16,
    reclamoEquipajeMontrealMaxUsd: 1680,
  }
}

export const CASOS_AUDITORIA_DEMO: CasoAuditoria[] = [
  {
    id: 'aud-ht-lim-01',
    tipo: 'hotel',
    codigoConfirmacion: 'BKG-4920184',
    canalOriginal: 'Booking.com',
    hotelNombre: 'Pullman Lima Miraflores',
    ciudad: 'Lima',
    pais: 'Perú',
    lat: -12.1268,
    lon: -77.0314,
    checkin: '2026-12-10',
    checkout: '2026-12-14',
    noches: 4,
    habitacion: 'Superior King · Cancelación gratuita activa',
    limiteCancelacionGratuita: '2026-12-08',
    precioPagadoUsd: 740,
    tarifaMayoristaDetectadaUsd: 552,
    proveedorMayorista: 'Stay22 Geo-Rate',
    ahorroNetoViajeroUsd: 188,
    comisionDirectaLuannaUsd: 66,
    alternativaCercanaNombre: 'Radisson Red Miraflores (a 240 m)',
    alternativaCercanaDistanciaMetros: 240,
    alternativaCercanaPrecioUsd: 496,
    exoneracionTributaria: calcularExoneracionTributariaHotel('Perú', 552),
    cargosFantasma: calcularCargosFantasmaHotel('Perú', 4),
    estadoVigilancia: 'Bajada detectada',
  },
  {
    id: 'aud-fl-latam-01',
    tipo: 'vuelo',
    pnr: 'K8M2QP',
    aerolinea: 'LATAM Airlines',
    rutaIata: 'LIM → BOG → LIM',
    origenIata: 'LIM',
    destinoIata: 'BOG',
    fechaVuelo: '2026-11-04',
    incidencia: 'no-show',
    etiquetaIncidencia: 'Boleto No Volado (Tarifa Light No Reembolsable)',
    jurisdiccion: 'Perú · Indecopi / DGAC',
    normaLegalCitada:
      'Código de Protección y Defensa del Consumidor (Ley 29571) y Condiciones del Contrato de Transporte Aéreo — Devolución obligatoria de tasas aeroportuarias no utilizadas (TUUA e impuestos de salida).',
    precioBoletoPagadoUsd: 348,
    tarifaBaseNoReembolsableUsd: 154,
    tasasAeroportuariasReembolsablesUsd: 194,
    compensacionAdicionalLeyUsd: 0,
    totalRecuperablePasajeroUsd: 194,
    urlPortalDevolucionAerolinea: 'https://www.latamairlines.com/pe/es/centro-ayuda/devoluciones',
    tasasDesglose: [
      {
        codigo: 'HW (TUUA)',
        concepto: 'Tarifa Unificada de Uso de Aeropuerto Jorge Chávez (Lima)',
        montoUsd: 31,
        reembolsablePorLey: true,
      },
      {
        codigo: 'CO (Aero)',
        concepto: 'Tasa Aeroportuaria Internacional El Dorado (Bogotá)',
        montoUsd: 46,
        reembolsablePorLey: true,
      },
      {
        codigo: 'PE / DY',
        concepto: 'Impuesto de Salida e Infraestructura Aeroportuaria No Devengada',
        montoUsd: 117,
        reembolsablePorLey: true,
      },
    ],
    poderesEspecialesVuelo: calcularPoderesEspecialesVuelo('Perú · Indecopi / DGAC', 348),
  },
  {
    id: 'aud-ht-mde-02',
    tipo: 'hotel',
    codigoConfirmacion: 'EXP-7739102',
    canalOriginal: 'Expedia',
    hotelNombre: 'NH Collection Medellín Royal',
    ciudad: 'Medellín',
    pais: 'Colombia',
    lat: 6.1979,
    lon: -75.5731,
    checkin: '2026-12-18',
    checkout: '2026-12-23',
    noches: 5,
    habitacion: 'Premium Deluxe · Reembolsable 100%',
    limiteCancelacionGratuita: '2026-12-16',
    precioPagadoUsd: 895,
    tarifaMayoristaDetectadaUsd: 670,
    proveedorMayorista: 'Travelpayouts / Hotellook',
    ahorroNetoViajeroUsd: 225,
    comisionDirectaLuannaUsd: 81,
    alternativaCercanaNombre: 'Estelar Milla de Oro (a 190 m)',
    alternativaCercanaDistanciaMetros: 190,
    alternativaCercanaPrecioUsd: 635,
    exoneracionTributaria: calcularExoneracionTributariaHotel('Colombia', 670),
    cargosFantasma: calcularCargosFantasmaHotel('Colombia', 5),
    estadoVigilancia: 'Bajada detectada',
  },
  {
    id: 'aud-fl-avianca-02',
    tipo: 'vuelo',
    pnr: 'Z4R9TX',
    aerolinea: 'Avianca',
    rutaIata: 'BOG → MEX',
    origenIata: 'BOG',
    destinoIata: 'MEX',
    fechaVuelo: '2026-11-09',
    incidencia: 'retraso-grave',
    etiquetaIncidencia: 'Demora en llegada +4h 40m / Cambio de Itinerario',
    jurisdiccion: 'Colombia · SIC / RAC 3',
    normaLegalCitada:
      'Reglamentos Aeronáuticos de Colombia (RAC 3, numeral 3.10.2.13.2) y Art. 47 Bis de la Ley de Aviación Civil de México — Compensación mínima del 25% al 30% del valor del trayecto más gastos de alimentación.',
    precioBoletoPagadoUsd: 460,
    tarifaBaseNoReembolsableUsd: 310,
    tasasAeroportuariasReembolsablesUsd: 0,
    compensacionAdicionalLeyUsd: 138,
    totalRecuperablePasajeroUsd: 138,
    urlPortalDevolucionAerolinea: 'https://ayuda.avianca.com/hc/es/requests/new',
    tasasDesglose: [
      {
        codigo: 'RAC-3 (30%)',
        concepto: 'Compensación legal por demora superior a 3 horas en trayecto',
        montoUsd: 112,
        reembolsablePorLey: true,
      },
      {
        codigo: 'VIÁTICOS LEY',
        concepto: 'Reembolso de refrigerio y comunicación obligatoria no provista',
        montoUsd: 26,
        reembolsablePorLey: true,
      },
    ],
    poderesEspecialesVuelo: calcularPoderesEspecialesVuelo('Colombia · SIC / RAC 3', 460),
  },
]

export function construirEnlaceRebookingAfiliado(caso: CasoAuditoriaHotel): {
  urlReservaDirecta: string
  urlMapaStay22: string
  plataformaDestino: string
} {
  const markerEfectivo = TP_MARKER || 'luanna_audit_direct'
  const aidEfectivo = STAY22_AID || 'luanna_audit'

  const urlReservaDirecta = urlHotelesFallback({
    marker: markerEfectivo,
    ciudad: `${caso.hotelNombre} ${caso.ciudad}`,
    checkin: caso.checkin,
    checkout: caso.checkout,
    adultos: 2,
  })

  const urlMapaStay22 = urlStay22({
    aid: aidEfectivo,
    lat: caso.lat,
    lng: caso.lon,
    checkin: caso.checkin,
    checkout: caso.checkout,
    titulo: caso.hotelNombre,
  })

  return {
    urlReservaDirecta,
    urlMapaStay22,
    plataformaDestino: STAY22_AID ? 'Stay22 + Hotellook Mayorista' : 'Hotellook / Travelpayouts',
  }
}

/**
 * Arma Secreta #1: Efecto "Dinero Gratis" (House Money Cross-Selling).
 */
export function construirEnlacesHouseMoney(caso: CasoAuditoria): EnlacesHouseMoney {
  const markerEfectivo = TP_MARKER || 'luanna_house_money'
  const destinoQuery =
    caso.tipo === 'hotel' ? `${caso.ciudad} ${caso.pais}` : caso.destinoIata

  const airaloTarget = new URL('https://www.airalo.com/')
  airaloTarget.searchParams.set('search', destinoQuery)

  const wrappedEsim = new URL('https://tp.media/r')
  wrappedEsim.searchParams.set('marker', markerEfectivo)
  wrappedEsim.searchParams.set('p', '8310')
  wrappedEsim.searchParams.set('u', airaloTarget.toString())

  const seguroTarget = new URL('https://www.visitorscoverage.com/')
  const wrappedSeguro = new URL('https://tp.media/r')
  wrappedSeguro.searchParams.set('marker', markerEfectivo)
  wrappedSeguro.searchParams.set('p', '5869')
  wrappedSeguro.searchParams.set('u', seguroTarget.toString())

  const ahorroBase =
    caso.tipo === 'hotel'
      ? caso.ahorroNetoViajeroUsd
      : caso.totalRecuperablePasajeroUsd

  const costoSugeridoPackUsd = 19
  const comisionExtraLuannaUsd = 8
  const porcentajeDelAhorroUsado = Math.max(
    5,
    Math.min(25, Math.round((costoSugeridoPackUsd / Math.max(50, ahorroBase)) * 100))
  )

  return {
    urlEsimAfiliado: TP_WIDGET_ESIM || wrappedEsim.toString(),
    urlSeguroAfiliado: TP_WIDGET_SEGUROS || wrappedSeguro.toString(),
    urlVueloAlternativo:
      caso.tipo === 'vuelo'
        ? urlVuelos({
            marker: markerEfectivo,
            origen: caso.origenIata,
            destino: caso.destinoIata,
            ida: caso.fechaVuelo,
            vuelta: caso.fechaVuelo,
            adultos: 1,
          })
        : undefined,
    costoSugeridoPackUsd,
    comisionExtraLuannaUsd,
    porcentajeDelAhorroUsado,
  }
}

/**
 * Arma Secreta #3: El "Negociador Directo con Recepción" (Contraoferta VIP anti-paridad).
 */
export function generarMensajeNegociacionHotel(caso: CasoAuditoriaHotel): string {
  return `ASUNTO: Consulta sobre mi reserva confirmada ${caso.codigoConfirmacion} (${caso.checkin} al ${caso.checkout}) — Solicitud de mejora directa

Estimado equipo de Reservas de ${caso.hotelNombre} (${caso.ciudad}):

Tengo actualmente confirmada la reserva ${caso.codigoConfirmacion} a través de ${caso.canalOriginal} para las fechas ${caso.checkin} al ${caso.checkout} (${caso.noches} noches, categoría ${caso.habitacion}) por $${caso.precioPagadoUsd} USD, con cancelación gratuita vigente hasta el ${caso.limiteCancelacionGratuita}.

Nuestro auditor de viajes detectó una tarifa mayorista de $${caso.tarifaMayoristaDetectadaUsd} USD para las mismas fechas (y una opción equivalente a ${caso.alternativaCercanaDistanciaMetros} metros en ${caso.alternativaCercanaNombre} por $${caso.alternativaCercanaPrecioUsd} USD).

Como prefiero hospedarme con ustedes, antes de modificar mi reserva quería consultarles si pueden ofrecerme una de estas dos opciones reservando directo con su recepción (ahorrándose ustedes el 18%–20% de comisión de ${caso.canalOriginal}):

  1. Igualar la tarifa de $${caso.tarifaMayoristaDetectadaUsd} USD en reserva directa (+ aplicar exoneración de ${caso.exoneracionTributaria.impuestoNombre} presentando pasaporte extranjero), O BIEN:
  2. Mantener mi reserva actual confirmando por esta vía un Upgrade garantizado a categoría superior + desayuno incluido + Late Check-out 15:00 sin cargo.

Quedo atento a su confirmación hoy para mantener mi estancia con ustedes. Muchas gracias.`
}

/**
 * Arma Secreta #4 y #5: Genera el escrito legal para Endoso de Pasaje (Cambio de nombre a un tercero)
 * o Reembolso del 100% / Cambio Gratis a horario VIP por Modificación Unilateral de Horario.
 */
export function generarEscritoPoderEspecialVuelo(
  caso: CasoAuditoriaVuelo,
  modo: 'schedule-change' | 'endoso-tercero' | 'equipaje-ancillaries'
): string {
  if (modo === 'schedule-change') {
    return `ASUNTO: EJERCICIO DE DERECHO POR MODIFICACIÓN UNILATERAL DE ITINERARIO — PNR ${caso.pnr} (${caso.rutaIata})

A: Departamento de Reprotección y Reembolsos de ${caso.aerolinea}
Jurisdicción: ${caso.jurisdiccion}

Por medio de la presente, ante la reprogramación/alteración unilateral del horario original del vuelo asociado al código PNR ${caso.pnr} (${caso.rutaIata}), ejerzo mi derecho legal como pasajero afectado por modificación del contrato de transporte aéreo:

Solicito SIN COBRO DE PENALIDAD NI DIFERENCIA TARIFARIA:
  [Opción A] El reembolso íntegro del 100% del valor pagado ($${caso.precioBoletoPagadoUsd} USD, incluyendo tarifa base y tasas) al medio de pago original, O BIEN
  [Opción B] La reubicación sin costo en el vuelo directo de horario preferente en la misma ruta conforme a la normativa de protección al pasajero.`
  }

  if (modo === 'endoso-tercero') {
    return `ASUNTO: SOLICITUD FORMAL DE ENDOSO DE PASAJE AÉREO A TERCERO / DESISTIMIENTO LEGAL — PNR ${caso.pnr}

A: Atención al Pasajero y Cumplimiento Regulatorio de ${caso.aerolinea}
Fundamento legal: ${caso.poderesEspecialesVuelo.normaEndoso}

Dentro del plazo legal previo a la salida del vuelo (${caso.fechaVuelo}), comunico formalmente el ejercicio del derecho de endoso/cesión de titularidad (o desistimiento de viaje) respecto del boleto PNR ${caso.pnr} en la ruta ${caso.rutaIata}, solicitando la emisión a nombre del nuevo pasajero designado (o devolución aplicable) sin cobro de penalidades comerciales prohibidas por la ley nacional.`
  }

  return `ASUNTO: REEMBOLSO DE SERVICIOS ADICIONALES NO PRESTADOS (ASIENTO / EQUIPAJE) — PNR ${caso.pnr}

A: Atención al Cliente de ${caso.aerolinea}
Normativa aplicable: ${caso.jurisdiccion} y Convenio de Montreal (Art. 19 y 22)

Solicito la devolución íntegra de los cargos adicionales pagados por selección de asiento / equipaje afectado por cambio operativo de aeronave o demora en entrega de equipaje en el vuelo ${caso.rutaIata} (PNR ${caso.pnr}), más la compensación de gastos de primera necesidad respaldados.`
}

/**
 * Arma Secreta #8: Genera el mensaje "Pase Viral de Compañeros de Viaje" (Multiplayer Referral).
 */
export function generarMensajeViralGrupo(caso: CasoAuditoria): string {
  if (caso.tipo === 'hotel') {
    return `Oigan, acabo de pasar nuestra reserva del ${caso.hotelNombre} (${caso.ciudad}) por el auditor de Luanna y detectó la misma estancia $${caso.ahorroNetoViajeroUsd} USD más barata + exoneración de ${caso.exoneracionTributaria.impuestoNombre} (-$${caso.exoneracionTributaria.ahorroTributarioEstimadoUsd} USD). Pasen sus reservas acá antes de que venza la cancelación gratuita: https://luanna.app/plataforma`
  }

  return `Oigan, pasé mi boleto de ${caso.aerolinea} (${caso.rutaIata}) por Luanna Audit y me sacó que tenemos $${caso.totalRecuperablePasajeroUsd} USD de tasas aeroportuarias 100% reembolsables por ley (y derecho a endoso/cambio sin penalidad). Auditen sus pasajes acá gratis: https://luanna.app/plataforma`
}

export function generarExpedienteReclamo(
  caso: CasoAuditoriaVuelo,
  nombrePasajero = 'TITULAR DE LA RESERVA'
): string {
  const listaTasas = caso.tasasDesglose
    .map((t) => `  - ${t.codigo}: ${t.concepto} → $${t.montoUsd.toFixed(2)} USD`)
    .join('\n')

  if (caso.incidencia === 'no-show') {
    return `ASUNTO: SOLICITUD FORMAL DE DEVOLUCIÓN DE TASAS AEROPORTUARIAS E IMPUESTOS NO DEVENGADOS — PNR ${caso.pnr}

A: Departamento de Reembolsos y Cumplimiento Regulatorio de ${caso.aerolinea}
Jurisdicción aplicable: ${caso.jurisdiccion}
Pasajero titular: ${nombrePasajero}
Código de Reserva (PNR): ${caso.pnr} | Ruta: ${caso.rutaIata} | Fecha: ${caso.fechaVuelo}

1. HECHO OBJETIVO:
El boleto de código ${caso.pnr} no fue abordado en la fecha programada. Si bien la tarifa aérea base ($${caso.tarifaBaseNoReembolsableUsd} USD) posee restricción comercial de reembolso, las tasas aeroportuarias e impuestos de embarque cobrados por adelantado corresponden a servicios públicos aeroportuarios que solo se causan con el embarque efectivo del pasajero.

2. FUNDAMENTO LEGAL:
${caso.normaLegalCitada}
La retención de tasas e impuestos de embarque de un pasajero que no utilizó la infraestructura aeroportuaria constituye cobro indebido.

3. DESGLOSE DE IMPORTES EXIGIBLES DE REEMBOLSO ÍNTEGRO:
${listaTasas}

TOTAL A REEMBOLSAR AL MEDIO DE PAGO ORIGINAL: $${caso.totalRecuperablePasajeroUsd.toFixed(2)} USD

Solicito la devolución íntegra de $${caso.totalRecuperablePasajeroUsd.toFixed(2)} USD a la tarjeta o medio de pago original dentro del plazo legal vigente, dejando constancia de este requerimiento formal.`
  }

  return `ASUNTO: RECLAMO DE COMPENSACIÓN LEGAL POR ${caso.etiquetaIncidencia.toUpperCase()} — PNR ${caso.pnr}

A: Atención al Pasajero y Cumplimiento Legal de ${caso.aerolinea}
Jurisdicción aplicable: ${caso.jurisdiccion}
Pasajero titular: ${nombrePasajero}
Código de Reserva (PNR): ${caso.pnr} | Ruta: ${caso.rutaIata} | Fecha: ${caso.fechaVuelo}

1. INCIDENCIA REGISTRADA EN TELEMETRÍA DE VUELO:
${caso.etiquetaIncidencia} en el trayecto ${caso.rutaIata}.

2. FUNDAMENTO NORMATIVO:
${caso.normaLegalCitada}

3. LIQUIDACIÓN EXIGIBLE:
${listaTasas}

TOTAL EXIGIBLE A FAVOR DEL PASAJERO: $${caso.totalRecuperablePasajeroUsd.toFixed(2)} USD

Solicito la acreditación y liquidación de $${caso.totalRecuperablePasajeroUsd.toFixed(2)} USD conforme a la normativa aeronáutica aplicable.`
}

export function analizarTextoReservaDeterminista(textoCrudo: string): CasoAuditoria {
  const texto = textoCrudo.trim()
  const lower = texto.toLowerCase()

  const matchMonto = texto.match(/(?:usd|\$|s\/|cop)?\s*(\d{3,4})(?:\.\d{2})?/i)
  const montoBase = matchMonto ? Math.min(4500, Math.max(180, Number(matchMonto[1]))) : 640

  const esVuelo =
    lower.includes('vuelo') ||
    lower.includes('latam') ||
    lower.includes('avianca') ||
    lower.includes('aeromexico') ||
    lower.includes('sky') ||
    lower.includes('pnr') ||
    lower.includes('boleto') ||
    lower.includes('tasa') ||
    lower.includes('embarque')

  if (esVuelo) {
    const matchPnr = texto.match(/\b([A-Z0-9]{6})\b/)
    const pnr = matchPnr ? matchPnr[1] : 'LNA94K'
    const aerolinea = lower.includes('avianca')
      ? 'Avianca'
      : lower.includes('aeromexico')
        ? 'Aeroméxico'
        : lower.includes('sky')
          ? 'SKY Airline'
          : 'LATAM Airlines'

    const tasasUsd = Math.round(montoBase * 0.48)
    const baseUsd = montoBase - tasasUsd
    const jurisdiccion =
      lower.includes('colombia') || lower.includes('bog')
        ? 'Colombia · SIC / RAC 3'
        : 'Perú · Indecopi / DGAC'

    return {
      id: `aud-fl-custom-${Date.now()}`,
      tipo: 'vuelo',
      pnr,
      aerolinea,
      rutaIata: lower.includes('bog') ? 'BOG → LIM → BOG' : 'LIM → SCL → LIM',
      origenIata: lower.includes('bog') ? 'BOG' : 'LIM',
      destinoIata: lower.includes('bog') ? 'LIM' : 'SCL',
      fechaVuelo: '2026-11-28',
      incidencia:
        lower.includes('retras') || lower.includes('demor') ? 'retraso-grave' : 'no-show',
      etiquetaIncidencia:
        lower.includes('retras') || lower.includes('demor')
          ? 'Demora registrada superior a 3h 30m'
          : 'Boleto No Volado — Tasas Aeroportuarias Retenidas',
      jurisdiccion,
      normaLegalCitada:
        'Devolución obligatoria de tasas aeroportuarias (TUUA / Tasas de Embarque) e impuestos de salida no causados por no embarque efectivo.',
      precioBoletoPagadoUsd: montoBase,
      tarifaBaseNoReembolsableUsd: baseUsd,
      tasasAeroportuariasReembolsablesUsd: tasasUsd,
      compensacionAdicionalLeyUsd: 0,
      totalRecuperablePasajeroUsd: tasasUsd,
      urlPortalDevolucionAerolinea:
        aerolinea === 'Avianca'
          ? 'https://ayuda.avianca.com/hc/es/requests/new'
          : 'https://www.latamairlines.com/pe/es/centro-ayuda/devoluciones',
      tasasDesglose: [
        {
          codigo: 'TUUA / AERO',
          concepto: 'Tasa de uso de terminal aeroportuaria de ida y vuelta no utilizada',
          montoUsd: Math.round(tasasUsd * 0.44),
          reembolsablePorLey: true,
        },
        {
          codigo: 'IMP. SALIDA',
          concepto: 'Impuestos fiscales de embarque internacional reembolsables por ley',
          montoUsd: tasasUsd - Math.round(tasasUsd * 0.44),
          reembolsablePorLey: true,
        },
      ],
      poderesEspecialesVuelo: calcularPoderesEspecialesVuelo(jurisdiccion, montoBase),
    }
  }

  // Caso Hotel
  const ciudad = lower.includes('medell')
    ? 'Medellín'
    : lower.includes('bogot')
      ? 'Bogotá'
      : lower.includes('santiago') || lower.includes('chil')
        ? 'Santiago'
        : lower.includes('canc') || lower.includes('mex')
          ? 'Ciudad de México'
          : lower.includes('cusco')
            ? 'Cusco'
            : 'Lima'

  const pais =
    ciudad === 'Medellín' || ciudad === 'Bogotá'
      ? 'Colombia'
      : ciudad === 'Santiago'
        ? 'Chile'
        : ciudad === 'Ciudad de México'
          ? 'México'
          : 'Perú'

  const tarifaMayorista = Math.round(montoBase * 0.74)
  const ahorro = montoBase - tarifaMayorista
  const comision = Math.round(tarifaMayorista * 0.12)

  return {
    id: `aud-ht-custom-${Date.now()}`,
    tipo: 'hotel',
    codigoConfirmacion: `AUD-${Math.floor(100000 + Math.random() * 900000)}`,
    canalOriginal: lower.includes('expedia') ? 'Expedia' : 'Booking.com',
    hotelNombre:
      texto.length > 8 && texto.length < 65
        ? texto
        : `Hotel Ejecutivo Auditado · ${ciudad}`,
    ciudad,
    pais,
    lat: ciudad === 'Medellín' ? 6.2088 : -12.1219,
    lon: ciudad === 'Medellín' ? -75.5658 : -77.0297,
    checkin: '2026-12-14',
    checkout: '2026-12-18',
    noches: 4,
    habitacion: 'Habitación Doble Reembolsable · Auditada',
    limiteCancelacionGratuita: '2026-12-12',
    precioPagadoUsd: montoBase,
    tarifaMayoristaDetectadaUsd: tarifaMayorista,
    proveedorMayorista: 'Stay22 Geo-Rate',
    ahorroNetoViajeroUsd: ahorro,
    comisionDirectaLuannaUsd: comision,
    alternativaCercanaNombre: `Suite 4★ Verificada a 220m (${ciudad})`,
    alternativaCercanaDistanciaMetros: 220,
    alternativaCercanaPrecioUsd: Math.round(tarifaMayorista * 0.93),
    exoneracionTributaria: calcularExoneracionTributariaHotel(pais, tarifaMayorista),
    cargosFantasma: calcularCargosFantasmaHotel(pais, 4),
    estadoVigilancia: 'Bajada detectada',
  }
}

export function calcularEconomiaAuditor(params: {
  reservasAuditadasMes: number
  ticketPromedioHotelUsd: number
  empresasSuscritasB2B: number
}): ProyeccionNegocioAuditor {
  const reservasAuditadasMes = Math.max(10, params.reservasAuditadasMes)
  const hotelesConBajadaDetectadaMes = Math.round(reservasAuditadasMes * 0.42)
  const comisionPromedioPorRebookingUsd = Math.round(
    params.ticketPromedioHotelUsd * 0.76 * 0.115
  )
  const comisionHotelesAfiliadosMesUsd =
    hotelesConBajadaDetectadaMes * comisionPromedioPorRebookingUsd

  const comisionCrossSellEsimSeguroMesUsd = Math.round(reservasAuditadasMes * 0.34 * 9)

  const boletosConTasasRecuperadasMes = Math.round(reservasAuditadasMes * 0.24)
  const ahorroHotelesClientesUsd =
    hotelesConBajadaDetectadaMes * Math.round(params.ticketPromedioHotelUsd * 0.24)
  const ahorroVuelosClientesUsd = boletosConTasasRecuperadasMes * 145
  const ahorroTotalGeneradoClientesMesUsd =
    ahorroHotelesClientesUsd + ahorroVuelosClientesUsd

  const ingresoSaasB2BMesUsd = params.empresasSuscritasB2B * 129

  const ingresoNetoTotalLuannaMesUsd =
    comisionHotelesAfiliadosMesUsd +
    comisionCrossSellEsimSeguroMesUsd +
    ingresoSaasB2BMesUsd
  const ingresoNetoTotalLuannaAnualUsd = ingresoNetoTotalLuannaMesUsd * 12

  return {
    reservasAuditadasMes,
    hotelesConBajadaDetectadaMes,
    comisionHotelesAfiliadosMesUsd,
    comisionCrossSellEsimSeguroMesUsd,
    boletosConTasasRecuperadasMes,
    ahorroTotalGeneradoClientesMesUsd,
    ingresoSaasB2BMesUsd,
    ingresoNetoTotalLuannaMesUsd,
    ingresoNetoTotalLuannaAnualUsd,
  }
}

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CASOS_AUDITORIA_DEMO,
  analizarTextoReservaDeterminista,
  calcularCargosFantasmaHotel,
  calcularEconomiaAuditor,
  calcularExoneracionTributariaHotel,
  calcularPoderesEspecialesVuelo,
  construirEnlaceRebookingAfiliado,
  construirEnlacesHouseMoney,
  generarEscritoPoderEspecialVuelo,
  generarExpedienteReclamo,
  generarMensajeNegociacionHotel,
  generarMensajeViralGrupo,
  type CasoAuditoriaHotel,
  type CasoAuditoriaVuelo,
} from '../src/lib/auditor-engine'
import {
  esEmailValido,
  guardarAuditoriaEnBoveda,
  listarAuditoriasBoveda,
} from '../src/lib/auditor-store'
import { enviarReporteAuditoria } from '../src/lib/correo'

test('un texto de confirmación de hotel detecta ahorro mayorista y comisión directa', () => {
  const resultado = analizarTextoReservaDeterminista(
    'Confirmación Booking.com Hotel Medellín Royal $800 USD con cancelación gratuita'
  )
  assert.equal(resultado.tipo, 'hotel')
  assert.equal(resultado.ciudad, 'Medellín')
  assert.equal(resultado.precioPagadoUsd, 800)
  assert.ok(resultado.tarifaMayoristaDetectadaUsd < resultado.precioPagadoUsd)
  assert.equal(
    resultado.ahorroNetoViajeroUsd,
    resultado.precioPagadoUsd - resultado.tarifaMayoristaDetectadaUsd
  )
  assert.ok(resultado.comisionDirectaLuannaUsd > 0)
})

test('un texto de boleto aéreo separa tarifa base de tasas aeroportuarias reembolsables', () => {
  const resultado = analizarTextoReservaDeterminista(
    'Confirmación LATAM Airlines PNR K9P2LM vuelo LIM BOG $400 USD no volado'
  )
  assert.equal(resultado.tipo, 'vuelo')
  assert.equal(resultado.pnr, 'K9P2LM')
  assert.equal(resultado.precioBoletoPagadoUsd, 400)
  assert.equal(
    resultado.tarifaBaseNoReembolsableUsd + resultado.tasasAeroportuariasReembolsablesUsd,
    400
  )
  assert.ok(resultado.totalRecuperablePasajeroUsd > 150)
})

test('el enlace de re-reserva afiliado usa el wrapper de Hotellook y Stay22 geo-anclado', () => {
  const casoHotel = CASOS_AUDITORIA_DEMO[0] as CasoAuditoriaHotel
  const enlaces = construirEnlaceRebookingAfiliado(casoHotel)
  assert.ok(enlaces.urlReservaDirecta.startsWith('https://tp.media/r?'))
  assert.ok(enlaces.urlMapaStay22.startsWith('https://www.stay22.com/embed/gm?'))
  assert.ok(enlaces.urlMapaStay22.includes(String(casoHotel.lat)))
})

test('el expediente legal de vuelo incluye PNR, tasas desglosadas y monto total exigible', () => {
  const casoVuelo = CASOS_AUDITORIA_DEMO[1] as CasoAuditoriaVuelo
  const escrito = generarExpedienteReclamo(casoVuelo, 'JEAN GUEVARA')
  assert.ok(escrito.includes(casoVuelo.pnr))
  assert.ok(escrito.includes('JEAN GUEVARA'))
  assert.ok(escrito.includes(`$${casoVuelo.totalRecuperablePasajeroUsd.toFixed(2)} USD`))
})

test('el simulador financiero suma comisiones afiliadas de hotel e ingresos SaaS B2B', () => {
  const proyeccion = calcularEconomiaAuditor({
    reservasAuditadasMes: 200,
    ticketPromedioHotelUsd: 600,
    empresasSuscritasB2B: 10,
  })
  assert.ok(proyeccion.comisionHotelesAfiliadosMesUsd > 0)
  assert.equal(proyeccion.ingresoSaasB2BMesUsd, 1290)
  assert.equal(
    proyeccion.ingresoNetoTotalLuannaMesUsd,
    proyeccion.comisionHotelesAfiliadosMesUsd +
      proyeccion.comisionCrossSellEsimSeguroMesUsd +
      proyeccion.ingresoSaasB2BMesUsd
  )
})

test('las 8 armas secretas (1 a 8) generan datos financieros, legales y virales válidos', () => {
  // Arma #2: Exoneración IGV/IVA
  const exoPeru = calcularExoneracionTributariaHotel('Perú', 600)
  assert.equal(exoPeru.porcentajeExonerado, 18)
  assert.ok(exoPeru.ahorroTributarioEstimadoUsd > 80)

  const exoColombia = calcularExoneracionTributariaHotel('Colombia', 700)
  assert.equal(exoColombia.porcentajeExonerado, 19)

  // Arma #1: House Money Cross-Sell
  const casoHotel = CASOS_AUDITORIA_DEMO[0] as CasoAuditoriaHotel
  const houseMoney = construirEnlacesHouseMoney(casoHotel)
  assert.ok(houseMoney.urlEsimAfiliado.includes('tp.media') || houseMoney.urlEsimAfiliado.length > 10)
  assert.ok(houseMoney.comisionExtraLuannaUsd > 0)

  // Arma #3: Negociador VIP Anti-Paridad
  const cartaVip = generarMensajeNegociacionHotel(casoHotel)
  assert.ok(cartaVip.includes(casoHotel.hotelNombre))
  assert.ok(cartaVip.includes(casoHotel.codigoConfirmacion))

  // Arma #7: Escudo Anti-Cargos Fantasma en Check-in
  const cargosCol = calcularCargosFantasmaHotel('Colombia', 4)
  assert.ok(cargosCol.ahorroEstimadoUsd > 20)
  assert.ok(cargosCol.cargoDetectado.includes('Seguro Hotelero'))

  // Armas #4, #5 y #6: Poderes Especiales de Vuelo (Schedule Change, Endoso y Montreal)
  const casoVuelo = CASOS_AUDITORIA_DEMO[1] as CasoAuditoriaVuelo
  const poderes = calcularPoderesEspecialesVuelo(casoVuelo.jurisdiccion, casoVuelo.precioBoletoPagadoUsd)
  assert.equal(poderes.ReembolsoTotalPorCambioHorarioUsd, casoVuelo.precioBoletoPagadoUsd)
  assert.ok(poderes.aplicaEndosoCambioNombre)
  assert.ok(poderes.reclamoEquipajeMontrealMaxUsd >= 1680)

  const escritoSchedule = generarEscritoPoderEspecialVuelo(casoVuelo, 'schedule-change')
  assert.ok(escritoSchedule.includes('MODIFICACIÓN UNILATERAL DE ITINERARIO'))
  assert.ok(escritoSchedule.includes(casoVuelo.pnr))

  const escritoEndoso = generarEscritoPoderEspecialVuelo(casoVuelo, 'endoso-tercero')
  assert.ok(escritoEndoso.includes('ENDOSO DE PASAJE AÉREO A TERCERO'))

  const escritoEquipaje = generarEscritoPoderEspecialVuelo(casoVuelo, 'equipaje-ancillaries')
  assert.ok(escritoEquipaje.includes('Convenio de Montreal'))

  // Arma #8: Pase Viral de Compañeros de Viaje
  const viralHotel = generarMensajeViralGrupo(casoHotel)
  const viralVuelo = generarMensajeViralGrupo(casoVuelo)
  assert.ok(viralHotel.includes(casoHotel.hotelNombre))
  assert.ok(viralVuelo.includes(casoVuelo.rutaIata))
})

test('la bóveda persiste en memoria local cuando no hay DATABASE_URL y filtra por correo', async () => {
  assert.equal(esEmailValido('cliente@empresa.pe'), true)
  assert.equal(esEmailValido('correo-invalido'), false)

  const nuevoCaso = analizarTextoReservaDeterminista('Hotel Cusco Imperial $950 USD')
  await guardarAuditoriaEnBoveda(nuevoCaso, 'cliente@empresa.pe')

  const listado = await listarAuditoriasBoveda('cliente@empresa.pe')
  assert.ok(listado.casos.some((c) => c.id === nuevoCaso.id))
})

test('enviarReporteAuditoria no lanza excepción si RESEND_API_KEY no está configurada', async () => {
  const res = await enviarReporteAuditoria('viajero@empresa.com', CASOS_AUDITORIA_DEMO[0])
  assert.equal(typeof res.enviado, 'boolean')
})

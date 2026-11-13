import {
  construirEnlaceRebookingAfiliado,
  construirEnlacesHouseMoney,
  generarExpedienteReclamo,
  type CasoAuditoria,
} from './auditor-engine'

/** Envío de correo con Resend (https://resend.com). Requiere RESEND_API_KEY. */
export const REMITENTE = 'Luanna <hola@luanna.app>'

export function correoConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

/** Escapa texto que vaya dentro del cuerpo HTML de un correo: nunca se confía en datos de un voucher ajeno. */
export function escapeHtml(valor: unknown): string {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}

/** Solo deja pasar enlaces https a los que de verdad vamos a enlazar; cualquier otra cosa (javascript:, data:, http) se descarta. */
export function urlSegura(valor: unknown): string | null {
  try {
    const url = new URL(String(valor))
    return url.protocol === 'https:' ? url.toString() : null
  } catch { return null }
}

export async function enviarEnlace(email: string, enlace: string): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY no configurada')
  const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:16px;color:#1a1a1a;max-width:480px">
<p style="font-size:22px;margin:0 0 16px">Entra a Luanna</p>
<p>Toca el botón para entrar a tu plataforma. El enlace sirve una sola vez y vence en 20 minutos.</p>
<p style="margin:28px 0"><a href="${enlace}" style="background:#0a0a0a;color:#fafafa;padding:14px 22px;border-radius:999px;text-decoration:none;display:inline-block">Entrar a mi plataforma</a></p>
<p style="color:#5c5c5c;font-size:14px">Si no pediste este correo, ignóralo. Nadie puede entrar sin este enlace.</p>
</div>`
  const text = `Entra a Luanna: ${enlace}\n\nEl enlace sirve una sola vez y vence en 20 minutos. Si no lo pediste, ignora este correo.`
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: REMITENTE, to: [email], subject: 'Tu enlace para entrar a Luanna', html, text }),
  })
  if (!r.ok) throw new Error(`Resend respondió ${r.status}: ${(await r.text()).slice(0, 300)}`)
}

/**
 * Envía al viajero o empresa el reporte de auditoría post-reserva:
 * - Si es hotel: botón directo con enlace afiliado (Stay22 / Hotellook Travelpayouts) para capturar el ahorro.
 * - Si es vuelo: expediente legal listo para exigir el reembolso de tasas aeroportuarias a su tarjeta original.
 */
export async function enviarReporteAuditoria(
  email: string,
  caso: CasoAuditoria
): Promise<{ enviado: boolean; motivo?: string }> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    return { enviado: false, motivo: 'RESEND_API_KEY no configurada' }
  }

  let subject = ''
  let html = ''
  let text = ''

  // Todo lo que viene del voucher (y pudo pasar por el LLM) se escapa antes de ir al HTML del correo:
  // nunca es nuestro, puede traer una reserva ajena o un intento de inyectar contenido.
  const e = escapeHtml

  if (caso.tipo === 'hotel') {
    const afiliados = construirEnlaceRebookingAfiliado(caso)
    const houseMoney = construirEnlacesHouseMoney(caso)
    const urlReserva = urlSegura(afiliados.urlReservaDirecta)
    const urlEsim = urlSegura(houseMoney.urlEsimAfiliado)
    const urlSeguro = urlSegura(houseMoney.urlSeguroAfiliado)
    subject = `Bajada detectada: ahorra $${caso.ahorroNetoViajeroUsd} USD en ${caso.hotelNombre}`.slice(0, 200)
    html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;color:#161614;max-width:560px;background:#f7f5f0;padding:28px;border-radius:16px;border:1px solid #e2ddd4">
  <p style="font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:#b84421;margin:0 0 8px">LUANNA AUDIT · RE-PRICER + 8 ARMAS POST-RESERVA</p>
  <h1 style="font-size:22px;margin:0 0 12px;color:#11110f">Encontramos tu habitación $${caso.ahorroNetoViajeroUsd} USD más barata</h1>
  <p style="margin:0 0 16px;color:#54524c">Tu reserva en <strong>${e(caso.hotelNombre)}</strong> (${e(caso.ciudad)}, ${e(caso.checkin)} → ${e(caso.checkout)}) tiene cancelación gratuita vigente hasta el <strong>${e(caso.limiteCancelacionGratuita)}</strong>.</p>
  <div style="background:#11110f;color:#fdfcfa;padding:18px;border-radius:12px;margin:0 0 16px">
    <p style="margin:0 0 6px;font-family:monospace;font-size:12px;color:#b8b3a8">Precio original (${e(caso.canalOriginal)}): <span style="text-decoration:line-through">$${caso.precioPagadoUsd} USD</span></p>
    <p style="margin:0 0 6px;font-family:monospace;font-size:16px;color:#8ef0cc"><strong>1. Nueva tarifa mayorista: $${caso.tarifaMayoristaDetectadaUsd} USD (-$${caso.ahorroNetoViajeroUsd} USD)</strong></p>
    <p style="margin:0 0 6px;font-family:monospace;font-size:12px;color:#fdfcfa">2. Exoneración ${e(caso.exoneracionTributaria.impuestoNombre)}: <strong>+$${caso.exoneracionTributaria.ahorroTributarioEstimadoUsd} USD extra</strong></p>
    <p style="margin:0;font-family:monospace;font-size:12px;color:#d5d1c8">3. Escudo Check-in (${e(caso.cargosFantasma.cargoDetectado)}): <strong>+$${caso.cargosFantasma.ahorroEstimadoUsd} USD evitados</strong></p>
  </div>
  ${urlReserva ? `<p style="margin:0 0 16px">
    <a href="${urlReserva}" style="background:#b84421;color:#ffffff;padding:14px 22px;border-radius:999px;text-decoration:none;display:inline-block;font-weight:600">1. Reservar tarifa de $${caso.tarifaMayoristaDetectadaUsd} USD ahora →</a>
  </p>` : ''}
  <div style="background:#ebe6dc;padding:14px;border-radius:10px;margin:0 0 16px;font-size:13px">
    <strong>Usa el ${houseMoney.porcentajeDelAhorroUsado}% de tu ahorro para viajar blindado:</strong><br/>
    ${urlEsim ? `<a href="${urlEsim}" style="color:#b84421;font-weight:600">Activar eSIM 5GB (${e(caso.pais)})</a>` : ''} ${urlEsim && urlSeguro ? '·' : ''} ${urlSeguro ? `<a href="${urlSeguro}" style="color:#19674e;font-weight:600">Seguro de Viaje VIP</a>` : ''}
  </div>
  <p style="font-size:13px;color:#54524c;margin:0">Paso 2: Una vez que recibas el nuevo voucher de confirmación, cancela sin costo tu reserva anterior (${e(caso.codigoConfirmacion)}) en ${e(caso.canalOriginal)}.</p>
</div>`
    text = `LUANNA AUDIT — Ahorra $${caso.ahorroNetoViajeroUsd} USD en ${caso.hotelNombre} (${caso.ciudad})\n\n1. Reserva la tarifa más baja aquí: ${urlReserva ?? '—'}\n2. Exoneración ${caso.exoneracionTributaria.impuestoNombre}: +$${caso.exoneracionTributaria.ahorroTributarioEstimadoUsd} USD\n3. Escudo Check-in (${caso.cargosFantasma.cargoDetectado}): +$${caso.cargosFantasma.ahorroEstimadoUsd} USD\n4. eSIM 5GB: ${urlEsim ?? '—'}`
  } else {
    const expediente = generarExpedienteReclamo(caso)
    const houseMoney = construirEnlacesHouseMoney(caso)
    const urlDevolucion = urlSegura(caso.urlPortalDevolucionAerolinea)
    const urlVueloAlt = urlSegura(houseMoney.urlVueloAlternativo)
    const urlEsim = urlSegura(houseMoney.urlEsimAfiliado)
    const urlSeguro = urlSegura(houseMoney.urlSeguroAfiliado)
    subject = `Reembolso exigible: recupera $${caso.totalRecuperablePasajeroUsd} USD de tu boleto ${caso.aerolinea} (${caso.pnr})`.slice(0, 200)
    html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;color:#161614;max-width:560px;background:#f7f5f0;padding:28px;border-radius:16px;border:1px solid #e2ddd4">
  <p style="font-family:monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:#19674e;margin:0 0 8px">LUANNA AUDIT · RESCATE DE TASAS + PODERES LEGALES (${e(caso.jurisdiccion)})</p>
  <h1 style="font-size:22px;margin:0 0 12px;color:#11110f">Tienes $${caso.totalRecuperablePasajeroUsd} USD exigibles por ley en tu boleto ${e(caso.pnr)}</h1>
  <p style="margin:0 0 12px;color:#54524c">Ruta: <strong>${e(caso.rutaIata)}</strong> (${e(caso.aerolinea)}). Además, cuentas con derecho a <strong>Reembolso 100% ($${caso.precioBoletoPagadoUsd} USD) si hubo cambio de horario</strong> o <strong>Endoso a tercero</strong> (${e(caso.poderesEspecialesVuelo.normaEndoso)}).</p>
  ${urlDevolucion ? `<p style="margin:0 0 16px">
    <a href="${urlDevolucion}" style="background:#11110f;color:#ffffff;padding:14px 22px;border-radius:999px;text-decoration:none;display:inline-block;font-weight:600">Abrir ventanilla oficial de ${e(caso.aerolinea)} →</a>
  </p>` : ''}
  <div style="background:#ebe6dc;padding:14px;border-radius:10px;margin:0 0 16px;font-size:13px">
    <strong>Reprograma con tu reembolso:</strong>
    ${urlVueloAlt ? `<a href="${urlVueloAlt}" style="color:#b84421;font-weight:600">Buscar Nuevo Vuelo</a> · ` : ''}
    ${urlEsim ? `<a href="${urlEsim}" style="color:#19674e;font-weight:600">eSIM 5GB</a>` : ''} ${urlEsim && urlSeguro ? '·' : ''} ${urlSeguro ? `<a href="${urlSeguro}" style="color:#11110f;font-weight:600">Seguro Anti-NoShow</a>` : ''}
  </div>
  <p style="font-family:monospace;font-size:11px;text-transform:uppercase;color:#54524c;margin:0 0 6px">COPIA Y PEGA ESTE ESCRITO LEGAL EN LA SOLICITUD:</p>
  <pre style="white-space:pre-wrap;background:#11110f;color:#e8e4dc;padding:16px;border-radius:12px;font-size:12px;line-height:1.5">${e(expediente)}</pre>
</div>`
    text = `${expediente}\n\nVentanilla oficial de reembolso: ${urlDevolucion ?? '—'}`
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: REMITENTE,
        to: [email],
        subject,
        html,
        text,
      }),
    })
    if (!r.ok) {
      return { enviado: false, motivo: `Resend HTTP ${r.status}` }
    }
    return { enviado: true }
  } catch (err) {
    return {
      enviado: false,
      motivo: err instanceof Error ? err.message : 'Error de red enviando correo',
    }
  }
}

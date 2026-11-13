import { NextResponse } from 'next/server'
import {
  listarHotelesActivosParaCron,
  marcarRevisionAuditoria,
} from '@/lib/auditor-store'
import { enviarReporteAuditoria } from '@/lib/correo'

/**
 * Endpoint invocado por el Cron de Cloudflare cada 6 horas (`POST /api/auditar/cron`)
 * para revisar todas las reservas de hotel activas antes de que venza su cancelación gratuita
 * y disparar la alerta por correo con el enlace afiliado de Stay22 / Travelpayouts.
 */
export async function POST(req: Request) {
  const secretEsperado =
    process.env.REVALIDATE_SECRET || process.env.ADMIN_API_KEY || ''

  if (secretEsperado) {
    const authHeader = req.headers.get('authorization') ?? ''
    const tokenRecibido = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (tokenRecibido !== secretEsperado) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
  }

  const activos = await listarHotelesActivosParaCron()
  let revisados = 0
  let alertasEnviadas = 0

  for (const item of activos) {
    revisados += 1
    if (item.email && item.caso.ahorroNetoViajeroUsd > 0) {
      const res = await enviarReporteAuditoria(item.email, item.caso)
      if (res.enviado) {
        alertasEnviadas += 1
        await marcarRevisionAuditoria(item.id, 'alerta_enviada')
        continue
      }
    }
    await marcarRevisionAuditoria(item.id)
  }

  return NextResponse.json({
    ok: true,
    revisados,
    alertasEnviadas,
    timestamp: new Date().toISOString(),
  })
}

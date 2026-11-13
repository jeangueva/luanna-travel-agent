import { neon } from '@neondatabase/serverless'
import { CASOS_AUDITORIA_DEMO, type CasoAuditoria } from './auditor-engine'

// Memoria de respaldo cuando DATABASE_URL no está configurada en entorno local
const MEMORIA_LOCAL: Array<{
  caso: CasoAuditoria
  email?: string
  creadoEn: string
}> = []

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) return null
  return neon(url)
}

export function esEmailValido(email?: string): boolean {
  if (!email) return false
  const limpio = email.trim()
  return limpio.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)
}

export async function guardarAuditoriaEnBoveda(
  caso: CasoAuditoria,
  emailRaw?: string
): Promise<{ persistidoEnNeon: boolean }> {
  const email = esEmailValido(emailRaw) ? emailRaw!.trim().toLowerCase() : undefined

  MEMORIA_LOCAL.unshift({
    caso,
    email,
    creadoEn: new Date().toISOString(),
  })
  if (MEMORIA_LOCAL.length > 50) MEMORIA_LOCAL.pop()

  const sql = getSql()
  if (!sql) {
    return { persistidoEnNeon: false }
  }

  try {
    const esHotel = caso.tipo === 'hotel'
    const codigoReferencia = esHotel ? caso.codigoConfirmacion : caso.pnr
    const proveedor = esHotel ? caso.canalOriginal : caso.aerolinea
    const tituloResumen = esHotel ? caso.hotelNombre : caso.etiquetaIncidencia
    const ciudadORuta = esHotel ? caso.ciudad : caso.rutaIata
    const precioPagado = esHotel ? caso.precioPagadoUsd : caso.precioBoletoPagadoUsd
    const montoRecuperable = esHotel
      ? caso.ahorroNetoViajeroUsd
      : caso.totalRecuperablePasajeroUsd
    const comisionEstimada = esHotel ? caso.comisionDirectaLuannaUsd : 0
    const limiteCancelacion =
      esHotel && /^\d{4}-\d{2}-\d{2}$/.test(caso.limiteCancelacionGratuita)
        ? caso.limiteCancelacionGratuita
        : null
    const jsonPayload = JSON.stringify(caso)

    await sql`
      INSERT INTO boveda_auditorias (
        id,
        tipo,
        email,
        codigo_referencia,
        proveedor,
        titulo_resumen,
        ciudad_o_ruta,
        precio_pagado_usd,
        monto_recuperable_usd,
        comision_estimada_usd,
        limite_cancelacion,
        caso_json
      ) VALUES (
        ${caso.id},
        ${caso.tipo},
        ${email ?? null},
        ${codigoReferencia},
        ${proveedor},
        ${tituloResumen},
        ${ciudadORuta},
        ${Math.round(precioPagado)},
        ${Math.round(montoRecuperable)},
        ${Math.round(comisionEstimada)},
        ${limiteCancelacion},
        ${jsonPayload}::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET
        caso_json = EXCLUDED.caso_json,
        monto_recuperable_usd = EXCLUDED.monto_recuperable_usd,
        actualizado_en = NOW()
    `
    return { persistidoEnNeon: true }
  } catch {
    // Si la tabla aún no fue migrada en Neon, mantenemos respaldo en memoria sin romper la petición
    return { persistidoEnNeon: false }
  }
}

export async function listarAuditoriasBoveda(emailRaw?: string): Promise<{
  casos: CasoAuditoria[]
  fuente: 'neon' | 'memoria-demo'
}> {
  const email = esEmailValido(emailRaw) ? emailRaw!.trim().toLowerCase() : undefined
  const sql = getSql()

  if (sql) {
    try {
      const rows = email
        ? await sql`
            SELECT caso_json
            FROM boveda_auditorias
            WHERE LOWER(email) = ${email}
            ORDER BY creado_en DESC
            LIMIT 40
          `
        : await sql`
            SELECT caso_json
            FROM boveda_auditorias
            ORDER BY creado_en DESC
            LIMIT 40
          `

      const desdeDb = rows
        .map((r) => r.caso_json as CasoAuditoria)
        .filter((c) => c && (c.tipo === 'hotel' || c.tipo === 'vuelo'))

      if (desdeDb.length > 0) {
        return {
          casos: [...desdeDb, ...CASOS_AUDITORIA_DEMO],
          fuente: 'neon',
        }
      }
    } catch {
      // Fallback a memoria + demo
    }
  }

  const locales = MEMORIA_LOCAL.filter((item) =>
    email ? item.email === email : true
  ).map((item) => item.caso)

  return {
    casos: [...locales, ...CASOS_AUDITORIA_DEMO],
    fuente: 'memoria-demo',
  }
}

export async function listarHotelesActivosParaCron(): Promise<
  Array<{ id: string; email: string | null; caso: Extract<CasoAuditoria, { tipo: 'hotel' }> }>
> {
  const sql = getSql()
  if (!sql) {
    return MEMORIA_LOCAL.filter(
      (item): item is { caso: Extract<CasoAuditoria, { tipo: 'hotel' }>; email?: string; creadoEn: string } =>
        item.caso.tipo === 'hotel'
    ).map((item) => ({
      id: item.caso.id,
      email: item.email ?? null,
      caso: item.caso,
    }))
  }

  try {
    const rows = await sql`
      SELECT id, email, caso_json
      FROM boveda_auditorias
      WHERE tipo = 'hotel'
        AND estado IN ('activo', 'alerta_enviada')
        AND (limite_cancelacion IS NULL OR limite_cancelacion >= CURRENT_DATE)
      ORDER BY ultima_revision_en ASC
      LIMIT 50
    `
    return rows
      .filter((r) => r.caso_json && r.caso_json.tipo === 'hotel')
      .map((r) => ({
        id: String(r.id),
        email: r.email ? String(r.email) : null,
        caso: r.caso_json as Extract<CasoAuditoria, { tipo: 'hotel' }>,
      }))
  } catch {
    return []
  }
}

export async function marcarRevisionAuditoria(id: string, nuevoEstado?: string): Promise<void> {
  const sql = getSql()
  if (!sql) return
  try {
    if (nuevoEstado) {
      await sql`
        UPDATE boveda_auditorias
        SET ultima_revision_en = NOW(), actualizado_en = NOW(), estado = ${nuevoEstado}
        WHERE id = ${id}
      `
    } else {
      await sql`
        UPDATE boveda_auditorias
        SET ultima_revision_en = NOW()
        WHERE id = ${id}
      `
    }
  } catch {
    // No-op si no hay tabla
  }
}

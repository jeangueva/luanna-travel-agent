import { NextResponse } from 'next/server'
import {
  analizarTextoReservaDeterminista,
  type CasoAuditoria,
} from '@/lib/auditor-engine'
import {
  esEmailValido,
  guardarAuditoriaEnBoveda,
  listarAuditoriasBoveda,
} from '@/lib/auditor-store'
import { enviarReporteAuditoria } from '@/lib/correo'

const SYSTEM_PROMPT = `Eres el motor forense de auditoría post-reserva de Luanna.
Recibes el texto, imagen o documento PDF de una confirmación de hotel (Booking, Expedia, etc.) o un boleto aéreo (LATAM, Avianca, etc.).
Extrae un JSON estricto que cumpla con la interfaz CasoAuditoriaHotel (tipo: "hotel") o CasoAuditoriaVuelo (tipo: "vuelo").
Si es hotel, estima tarifaMayoristaDetectadaUsd al 74% del precioPagadoUsd, ahorroNetoViajeroUsd como la diferencia y comisionDirectaLuannaUsd al 12% de la tarifa mayorista.
Si es vuelo no usado o con demora, separa tarifaBaseNoReembolsableUsd (52%) y tasasAeroportuariasReembolsablesUsd (48% correspondiente a TUUA/TUA/tasas de embarque reembolsables por ley en LATAM).
Responde ÚNICAMENTE con un objeto JSON válido, sin bloques markdown.`

type MimeSoportado = 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/webp'

const MIMES_VALIDOS = new Set<string>([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
])

/**
 * Solo copia de `entrada` las claves que ya existen en `plantilla` y con el mismo tipo básico
 * (string, number, boolean u objeto plano, recursivamente). Evita que la respuesta del LLM
 * agregue campos propios o cambie el tipo de uno existente (asignación masiva).
 */
function sanearContraPlantilla<T extends Record<string, unknown>>(entrada: unknown, plantilla: T): Partial<T> {
  if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) return {}
  const out: Record<string, unknown> = {}
  for (const [clave, valorPlantilla] of Object.entries(plantilla)) {
    const valor = (entrada as Record<string, unknown>)[clave]
    if (valor === undefined) continue
    if (Array.isArray(valorPlantilla)) {
      if (Array.isArray(valor)) out[clave] = valor
    } else if (typeof valorPlantilla === 'object' && valorPlantilla !== null) {
      out[clave] = sanearContraPlantilla(valor, valorPlantilla as Record<string, unknown>)
    } else if (typeof valor === typeof valorPlantilla) {
      out[clave] = typeof valor === 'string' ? valor.slice(0, 500) : valor
    }
  }
  return out as Partial<T>
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const email = url.searchParams.get('email') ?? undefined
  // Sin correo no hay a quién mostrarle: antes esto devolvía toda la bóveda a cualquiera.
  if (!esEmailValido(email)) {
    return NextResponse.json({ error: 'Falta el correo de la cuenta.' }, { status: 400 })
  }
  const resultado = await listarAuditoriasBoveda(email)
  return NextResponse.json(resultado)
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      texto?: string
      archivoBase64?: string
      archivoMime?: string
      archivoNombre?: string
      email?: string
    }

    const texto = (body.texto ?? '').trim()
    const archivoBase64 = (body.archivoBase64 ?? '').trim()
    const archivoMime = (body.archivoMime ?? '').trim() as MimeSoportado
    const archivoNombre = (body.archivoNombre ?? '').trim()
    const email = (body.email ?? '').trim()

    if (!texto && !archivoBase64) {
      return NextResponse.json(
        { error: 'Pega el texto del voucher o adjunta tu archivo PDF / captura.' },
        { status: 400 }
      )
    }

    const textoSemilla = [texto, archivoNombre].filter(Boolean).join(' ') || 'Hotel Reserva Auditada $680 USD'
    const fallbackResult = analizarTextoReservaDeterminista(textoSemilla)
    const apiKey = process.env.ANTHROPIC_API_KEY

    let casoFinal: CasoAuditoria = fallbackResult
    let motor = 'determinista-local'

    if (apiKey) {
      try {
        const contentBlocks: Array<Record<string, unknown>> = []

        if (archivoBase64 && MIMES_VALIDOS.has(archivoMime)) {
          const cleanBase64 = archivoBase64.replace(/^data:[^;]+;base64,/, '')
          if (archivoMime === 'application/pdf') {
            contentBlocks.push({
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: cleanBase64,
              },
            })
          } else {
            contentBlocks.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: archivoMime,
                data: cleanBase64,
              },
            })
          }
        }

        contentBlocks.push({
          type: 'text',
          text: `Analiza este comprobante de viaje (${archivoNombre || 'voucher'}) y devuelve únicamente el JSON estructurado de CasoAuditoria:\n\n${texto.slice(0, 4000)}`,
        })

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: process.env.LLM_MODEL || 'claude-haiku-4-5-20251001',
            max_tokens: 950,
            system: SYSTEM_PROMPT,
            messages: [
              {
                role: 'user',
                content: contentBlocks,
              },
            ],
          }),
        })

        if (res.ok) {
          const data = (await res.json()) as {
            content?: Array<{ type: string; text?: string }>
          }
          const rawJson = data.content?.find((c) => c.type === 'text')?.text ?? ''
          const jsonLimpio = rawJson.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
          const parsed = JSON.parse(jsonLimpio) as Partial<CasoAuditoria>

          if (parsed && (parsed.tipo === 'hotel' || parsed.tipo === 'vuelo') && parsed.tipo === fallbackResult.tipo) {
            // El LLM solo puede rellenar campos que ya existen en nuestra plantilla, y con el mismo tipo
            // de dato (string/number/object): así una respuesta manipulada no agrega claves nuevas ni
            // cambia un string por un objeto para colarse en el correo o en la bóveda.
            const limpio = sanearContraPlantilla(parsed, fallbackResult as unknown as Record<string, unknown>)
            casoFinal = {
              ...fallbackResult,
              ...limpio,
              id: `aud-${parsed.tipo}-${Date.now()}`,
              // Los enlaces de devolución siempre salen de nuestras rutas oficiales, nunca del LLM.
              ...(fallbackResult.tipo === 'vuelo'
                ? { urlPortalDevolucionAerolinea: fallbackResult.urlPortalDevolucionAerolinea }
                : {}),
            } as CasoAuditoria
            motor = archivoBase64 ? 'claude-vision-pdf' : 'claude-api'
          }
        }
      } catch {
        motor = 'determinista-fallback'
      }
    }

    const { persistidoEnNeon } = await guardarAuditoriaEnBoveda(casoFinal, email)

    let correoEnviado = false
    if (esEmailValido(email)) {
      const envio = await enviarReporteAuditoria(email, casoFinal)
      correoEnviado = envio.enviado
    }

    return NextResponse.json({
      caso: casoFinal,
      motor,
      persistidoEnNeon,
      correoEnviado,
    })
  } catch {
    return NextResponse.json(
      { error: 'No se pudo procesar la reserva.' },
      { status: 500 }
    )
  }
}

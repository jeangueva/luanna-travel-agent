'use client'

import { useState } from 'react'
import {
  IconCheck,
  IconCopy,
  IconTerminal,
  SegmentedControl,
  SpotlightTray,
} from '@/components/ui/reactbits'

type CanalIntegracion = 'correo' | 'api' | 'widget'

export function GuiaIntegraciones({ origen, sede }: { origen: string; sede?: string }) {
  void sede
  const [canal, setCanal] = useState<CanalIntegracion>('correo')
  const [copiado, setCopiado] = useState(false)

  const snippets: Record<CanalIntegracion, { titulo: string; pasos: string[]; codigo: string }> = {
    correo: {
      titulo: 'Reenvío automático de confirmaciones (Gmail / Google Workspace / Microsoft 365)',
      pasos: [
        'Agrega auditoria@luanna.app como dirección de reenvío en tu correo personal o en la bandeja viajes@tuempresa.com.',
        'Crea un filtro automático para correos entrantes de Booking.com, Expedia, LATAM Airlines, Avianca, SKY o Aeroméxico.',
        'Cada reserva recibida entra automáticamente en la Bóveda de Auditoría: monitoreamos bajadas de precio en hoteles cada 6 horas y detectamos tasas reembolsables de boletos no volados.',
      ],
      codigo: `Filtro sugerido en Gmail / Google Workspace:
from:(booking.com OR expedia.com OR latam.com OR avianca.com)
subject:(confirmación OR reserva OR itinerario OR boleto)
→ Reenviar automáticamente a: auditoria@luanna.app`,
    },
    api: {
      titulo: 'API REST Forense con Claude (Para Agencias de Viajes y ERPs Corporativos)',
      pasos: [
        'Envía el texto crudo del voucher o confirmación mediante POST a nuestro endpoint /api/auditar.',
        'Recibe en menos de 2 segundos el JSON con la tarifa mayorista detectada, el enlace de re-reserva afiliado (Stay22 / Travelpayouts) o el expediente legal de devolución de tasas aéreas.',
        'Integra la alerta directamente en el backoffice de tu agencia o sistema de gastos de viaje.',
      ],
      codigo: `curl -X POST ${origen}/api/auditar \\
  -H "Content-Type: application/json" \\
  -d '{
    "texto": "Confirmación Booking.com #BKG-4920184 Hotel Pullman Miraflores Lima Check-in 2026-12-10 Total pagado: $740 USD Cancelación gratuita"
  }'`,
    },
    widget: {
      titulo: 'Escáner Embebible para Agencias y Comunidades de Viajeros',
      pasos: [
        'Copia el contenedor HTML y el script ligero en cualquier página de tu sitio web, WordPress o portal de clientes.',
        'Tus visitantes podrán auditar sus reservas de hotel o boletos no usados sin salir de tu dominio.',
        'Todas las re-reservas de hotel generadas disparan comisión directa en Stay22 y Travelpayouts.',
      ],
      codigo: `<iframe
  src="${origen}/plataforma"
  title="Auditor Post-Reserva Luanna"
  style="width:100%;min-height:760px;border:1px solid #e2ddd4;border-radius:16px;"
  loading="lazy"
></iframe>`,
    },
  }

  const actual = snippets[canal]

  const copiarCodigo = async () => {
    try {
      await navigator.clipboard.writeText(actual.codigo)
    } catch {
      // Ignorar si el navegador bloquea clipboard
    }
    setCopiado(true)
    window.setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="mt-8 space-y-6">
      <SegmentedControl
        ariaLabel="Seleccionar método de integración"
        options={[
          { id: 'correo', label: '01. Regla de Correo (Sin código)' },
          { id: 'api', label: '02. API REST (/api/auditar)' },
          { id: 'widget', label: '03. Embebido en Web' },
        ]}
        value={canal}
        onChange={setCanal}
      />

      <SpotlightTray variant="light" coreClassName="p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ancla-line pb-4">
          <div className="flex items-center gap-2">
            <IconTerminal className="h-4 w-4 text-ancla-signal" />
            <h2 className="font-display text-lg font-semibold text-ancla-ink">
              {actual.titulo}
            </h2>
          </div>

          <button
            type="button"
            onClick={copiarCodigo}
            className="press-scale inline-flex items-center gap-1.5 rounded-full bg-ancla-obsidian px-4 py-1.5 font-mono text-xs text-white hover:bg-black"
          >
            {copiado ? (
              <>
                <IconCheck className="h-3.5 w-3.5 text-[#8ef0cc]" />
                <span>Copiado</span>
              </>
            ) : (
              <>
                <IconCopy className="h-3.5 w-3.5" />
                <span>Copiar configuración</span>
              </>
            )}
          </button>
        </div>

        <ol className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {actual.pasos.map((paso, idx) => (
            <li
              key={paso}
              className="rounded-xl border border-ancla-line bg-ancla-canvas/70 p-4 text-xs leading-relaxed text-ancla-inkSecondary"
            >
              <span className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-ancla-signal">
                PASO 0{idx + 1}
              </span>
              <p className="mt-1.5 text-ancla-ink">{paso}</p>
            </li>
          ))}
        </ol>

        <div className="mt-5 overflow-x-auto rounded-xl border border-ancla-lineStrong bg-[#121210] p-4 font-mono text-xs leading-relaxed text-[#e8e4dc]">
          <pre>
            <code>{actual.codigo}</code>
          </pre>
        </div>
      </SpotlightTray>
    </div>
  )
}

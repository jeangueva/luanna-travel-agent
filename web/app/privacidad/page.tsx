import type { Metadata } from 'next'
import { Legal } from '@/components/landing/Legal'

export const metadata: Metadata = {
  title: 'Política de Privacidad',
  description: 'Cómo Luanna procesa y protege los datos de confirmaciones de hotel y boletos aéreos.',
}

export default function Privacidad() {
  return (
    <Legal titulo="Política de Privacidad" actualizado="12 de noviembre de 2026">
      <h2>1. En pocas palabras</h2>
      <p>
        Luanna procesa únicamente los datos estrictamente necesarios de tu confirmación de viaje para encontrar tarifas de hotel más bajas o calcular las tasas aeroportuarias reembolsables de tu boleto aéreo. No vendemos tus datos ni almacenamos números de tarjetas de crédito.
      </p>

      <h2>2. Qué datos procesamos</h2>
      <ul>
        <li>
          <strong>En reservas de hotel:</strong> nombre de la propiedad, ciudad, coordenadas, fechas de check-in y check-out, tipo de habitación, fecha límite de cancelación gratuita y monto pagado.
        </li>
        <li>
          <strong>En boletos aéreos:</strong> código de reserva (PNR), aerolínea, ruta IATA, fecha del vuelo y desglose tarifario de tasas e impuestos aeroportuarios.
        </li>
      </ul>

      <h2>3. Infraestructura y proveedores</h2>
      <p>
        Utilizamos Cloudflare Workers y Neon Postgres para la infraestructura operativa, la API de Anthropic (Claude) para la extracción estructurada de comprobantes sin entrenamiento sobre datos del usuario, y enlaces de conversión de Stay22 y Travelpayouts cuando el usuario decide tomar una tarifa de hotel más económica.
      </p>

      <h2>4. Derechos del titular</h2>
      <p>
        Puedes solicitar la eliminación inmediata de cualquier reserva auditada o de tu cuenta corporativa escribiendo a{' '}
        <a href="mailto:auditoria@luanna.app" className="font-mono text-ancla-ink underline">
          auditoria@luanna.app
        </a>
        .
      </p>
    </Legal>
  )
}

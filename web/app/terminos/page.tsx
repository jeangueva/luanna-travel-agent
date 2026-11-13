import type { Metadata } from 'next'
import { Legal } from '@/components/landing/Legal'

export const metadata: Metadata = {
  title: 'Términos de Uso',
  description: 'Condiciones del servicio de auditoría post-reserva de hoteles y rescate de tasas aéreas de Luanna.',
}

export default function Terminos() {
  return (
    <Legal titulo="Términos de uso" actualizado="12 de noviembre de 2026">
      <h2>1. El servicio de auditoría post-reserva</h2>
      <p>
        Luanna Audit analiza confirmaciones de hotel con cancelación gratuita y boletos aéreos proporcionados por el usuario o empresa para detectar tarifas mayoristas inferiores (Re-Pricer) y desglosar tasas aeroportuarias o compensaciones exigibles conforme a la normativa vigente en Latinoamérica.
      </p>

      <h2>2. Modelo de monetización transparente</h2>
      <p>
        El monitoreo y detección de bajadas de precio en hoteles es gratuito para el viajero individual. Cuando el usuario decide reservar la nueva tarifa más económica a través de los enlaces de nuestros proveedores afiliados (Stay22, Hotellook / Travelpayouts), dicho proveedor nos abona una comisión comercial sin encarecer el precio final para el viajero. Para empresas y agencias con volumen recurrente ofrecemos planes de suscripción B2B.
      </p>

      <h2>3. Ejecución de reservas y reclamos aéreos</h2>
      <p>
        Luanna no actúa como agencia emisora ni retiene fondos de reembolsos aéreos. En hoteles, el usuario confirma primero su nueva reserva más económica y posteriormente cancela su reserva original dentro de su ventana de cancelación gratuita. En boletos aéreos, Luanna genera el requerimiento formal fundamentado para que la aerolínea efectúe la devolución de tasas directamente al medio de pago original del titular.
      </p>

      <h2>4. Uso aceptable</h2>
      <ul>
        <li>Subir o reenviar únicamente comprobantes de viaje propios o de la empresa autorizada.</li>
        <li>Verificar la fecha límite de cancelación gratuita de su reserva original antes de cancelarla.</li>
        <li>No utilizar la plataforma para fines fraudulentos o automatizaciones abusivas.</li>
      </ul>

      <h2>5. Contacto</h2>
      <p>
        Para soporte operativo o consultas corporativas B2B escribe a{' '}
        <a href="mailto:auditoria@luanna.app" className="font-mono text-ancla-ink underline">
          auditoria@luanna.app
        </a>
        .
      </p>
    </Legal>
  )
}

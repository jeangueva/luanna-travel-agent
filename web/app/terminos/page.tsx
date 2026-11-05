import type { Metadata } from 'next'
import { Legal } from '@/components/landing/Legal'

export const metadata: Metadata = { title: 'Términos', description: 'Las reglas de uso de Luanna.' }

export default function Terminos() {
  return <Legal titulo="Términos de uso" actualizado="4 de noviembre de 2026">
    <h2>El servicio</h2>
    <p>Luanna permite a los negocios crear portales donde sus clientes buscan vuelos y alojamiento cerca de una sede. Es gratis para los negocios.</p>
    <h2>Cómo ganamos</h2>
    <p>Cuando alguien reserva un vuelo o un hotel desde un portal, el proveedor nos paga una comisión. El precio para quien reserva es el mismo que en el sitio del proveedor.</p>
    <h2>Las reservas</h2>
    <p>Luanna no vende vuelos ni hoteles ni cobra pagos. Precios, disponibilidad, cambios, cancelaciones y reembolsos dependen de cada proveedor. Ante un problema con una reserva, el contacto es ese proveedor.</p>
    <h2>Lo que pedimos a los negocios</h2>
    <ul>
      <li>Usar datos reales de su sede y mantener las fechas al día.</li>
      <li>No publicar datos personales ni de salud de sus clientes.</li>
      <li>No usar Luanna para engañar a nadie ni para actividades ilegales.</li>
    </ul>
    <h2>Cambios y disponibilidad</h2>
    <p>Podemos mejorar o cambiar el servicio. Si un cambio afecta tu portal, te avisaremos antes. Podemos retirar portales que incumplan estos términos.</p>
    <h2>Contacto</h2>
    <p><a href="mailto:hola@luanna.app">hola@luanna.app</a></p>
  </Legal>
}

import type { Metadata } from 'next'
import { Legal } from '@/components/landing/Legal'

export const metadata: Metadata = { title: 'Privacidad', description: 'Qué datos usa Luanna y para qué.' }

export default function Privacidad() {
  return <Legal titulo="Privacidad" actualizado="4 de noviembre de 2026">
    <h2>En pocas palabras</h2>
    <p>Luanna ayuda a los negocios a que sus clientes encuentren vuelos y alojamiento. Pedimos lo mínimo, no vendemos datos y no guardamos datos de pago.</p>
    <h2>Qué datos usamos</h2>
    <ul>
      <li><strong>De los negocios:</strong> el nombre del negocio y de cada sede, su ciudad, su ubicación, el aeropuerto cercano, las fechas sugeridas y el estilo del portal.</li>
      <li><strong>De quien visita un portal:</strong> el código del aeropuerto que escribe para buscar vuelos y el idioma de su navegador. No pedimos nombre, correo ni teléfono.</li>
      <li><strong>Datos técnicos:</strong> registros básicos del servidor (dirección IP, navegador, páginas visitadas) para que el servicio funcione y sea seguro.</li>
    </ul>
    <h2>Datos de salud</h2>
    <p>Las sedes solo contienen información del lugar. Los negocios no deben escribir datos de pacientes o clientes en Luanna.</p>
    <h2>Proveedores</h2>
    <p>Cuando alguien busca un vuelo o un hotel, sale de Luanna hacia el proveedor (por ejemplo, Aviasales mediante Travelpayouts, o Stay22 y los hoteles que muestra). Cada proveedor trata los datos de la reserva según su propia política. Alojamos el servicio en Cloudflare y guardamos las sedes en Neon.</p>
    <h2>Cookies</h2>
    <p>Usamos una cookie necesaria para mantener abierta la sesión de la plataforma. Los proveedores de vuelos y hoteles pueden usar sus propias cookies para atribuir la reserva.</p>
    <h2>Tus derechos</h2>
    <p>Puedes pedir acceso, corrección o borrado de tus datos escribiendo a <a href="mailto:hola@luanna.app">hola@luanna.app</a>. Respondemos en un máximo de 30 días.</p>
  </Legal>
}

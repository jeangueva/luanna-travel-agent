import type { Metadata } from 'next'
import { GuiaIntegraciones } from '@/components/landing/Integraciones'
import { CareFooter, CareHeader } from '@/components/care/Shell'
export const metadata: Metadata = { title: 'Luanna para empresas', description: 'Comparte una demo de Luanna con tus clientes y explora una integración para tu negocio.' }
export default function Page() {
  return <div className="care"><CareHeader simple /><main className="care-container" id="contenido"><div className="care-reading"><span className="care-eyebrow">Para empresas y comunidades</span><h1>Ayuda a tus viajeros<br />a dar el siguiente paso.</h1><p>Una forma sencilla de mostrar cómo organizar una consulta sobre un hotel o un vuelo. Empieza por conocer la demo.</p><GuiaIntegraciones origen="https://luanna.app" /></div></main><CareFooter /></div>
}

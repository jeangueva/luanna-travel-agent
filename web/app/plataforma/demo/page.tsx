import type { Metadata } from 'next'
import { ConsolaAncla } from '@/components/plataforma/ConsolaAncla'
export const metadata: Metadata = { title: 'Prueba una revisión', robots: { index: false, follow: false } }
export default function Page() { return <ConsolaAncla demo /> }

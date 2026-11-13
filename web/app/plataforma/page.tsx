import type { Metadata } from 'next'
import { ConsolaAncla } from '@/components/plataforma/ConsolaAncla'
export const metadata: Metadata = { title: 'Revisar mi reserva', robots: { index: false, follow: false } }
export default function Page() { return <ConsolaAncla /> }

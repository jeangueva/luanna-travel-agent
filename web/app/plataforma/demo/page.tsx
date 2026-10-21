import type { Metadata } from 'next'
import { PortalAdmin } from '@/components/plataforma/PortalAdmin'

export const metadata: Metadata = { title: 'Explorar la plataforma', robots: { index: false, follow: false } }
export default function DemoPage() { return <PortalAdmin demo /> }

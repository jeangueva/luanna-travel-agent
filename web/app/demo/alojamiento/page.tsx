import type { Metadata } from 'next'
import { LodgingDemo } from '@/components/demo/CheckoutDemo'

export const metadata: Metadata = { title: 'Alojamiento · Módulo de demostración', robots: { index: false, follow: false } }
export default function LodgingDemoPage() { return <LodgingDemo /> }

import type { Metadata } from 'next'
import { CheckoutDemo } from '@/components/demo/CheckoutDemo'

export const metadata: Metadata = { title: 'Demo libre · Del pago al alojamiento', robots: { index: false, follow: false } }

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ paso?: string }> }) {
  const { paso } = await searchParams
  return <CheckoutDemo confirmed={paso === 'confirmacion'} />
}

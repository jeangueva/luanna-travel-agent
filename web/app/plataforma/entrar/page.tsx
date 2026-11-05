import type { Metadata } from 'next'
import { EntrarConEnlace } from '@/components/plataforma/EntrarConEnlace'

export const metadata: Metadata = { title: 'Entrar', robots: { index: false, follow: false } }

export default function EntrarPage() {
  return <EntrarConEnlace />
}

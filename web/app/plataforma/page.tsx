import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { claveAdmin, COOKIE_PORTAL, sesionValida } from '@/lib/portal-auth'
import { PortalLogin } from '@/components/plataforma/PortalLogin'
import { PortalAdmin } from '@/components/plataforma/PortalAdmin'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Administrar sedes',
  description: 'Gestiona sedes y portales de alojamiento para eventos y clínicas.',
  robots: { index: false, follow: false },
}

export default async function PlataformaPage() {
  const secret = claveAdmin()
  const cookie = (await cookies()).get(COOKIE_PORTAL)?.value
  if (!sesionValida(cookie, secret)) return <PortalLogin configurado={Boolean(secret)} />
  return <PortalAdmin />
}

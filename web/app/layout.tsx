import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import '@/tokens.css'
import '@/index.css'
import '@/glass.css'
import '@/landing.css'
import '@/portal.css'
import '@/app.css'
import '@/checkout-demo.css'
import '@/care.css'

export const metadata: Metadata = {
  title: {
    default: 'Luanna — Claridad para seguir tu viaje',
    template: '%s | Luanna',
  },
  description:
    '¿Tuviste un problema con tu vuelo o tu hotel? Ordena los detalles de tu reserva y prepara el siguiente paso, a tu ritmo.',
}

export const viewport: Viewport = {
  themeColor: '#f8f8f3',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,500;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}

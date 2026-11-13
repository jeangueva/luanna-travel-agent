import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import '@/tokens.css'
import '@/index.css'
import '@/glass.css'
import '@/landing.css'
import '@/portal.css'
import '@/app.css'
import '@/checkout-demo.css'

export const metadata: Metadata = {
  title: {
    default: 'Luanna — Auditor Post-Reserva: Rebaja de Hoteles y Rescate de Tasas Aéreas',
    template: '%s | Luanna Audit',
  },
  description:
    'Plataforma de arbitraje post-reserva en LATAM: detecta bajadas de precio en hoteles ya reservados (Booking/Expedia) gratis y recupera tasas aeroportuarias de vuelos no usados.',
}

export const viewport: Viewport = {
  themeColor: '#f7f5f0',
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
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=Chivo+Mono:wght@400;500;600&family=Geist:wght@400;500;600;700&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,500;1,7..72,400&family=Special+Elite&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-ancla-canvas text-ancla-ink antialiased selection:bg-ancla-signal selection:text-white">
        {children}
      </body>
    </html>
  )
}

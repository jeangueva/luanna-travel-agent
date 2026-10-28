import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import '@/index.css'
import '@/glass.css'

export const metadata: Metadata = {
  title: {
    default: 'Luanna Ancla — Vuelos y alojamiento para quien viaja a verte',
    template: '%s | Luanna Ancla',
  },
  description:
    'Un enlace para que tus visitantes, desde cualquier país, encuentren cómo llegar y dónde quedarse cerca de tu negocio, evento o clínica.',
}

export const viewport: Viewport = {
  themeColor: '#171717',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&family=Source+Serif+4:ital,wght@1,400;1,500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-ancla-canvas text-ancla-ink antialiased selection:bg-ancla-signal selection:text-white">
        {children}
      </body>
    </html>
  )
}

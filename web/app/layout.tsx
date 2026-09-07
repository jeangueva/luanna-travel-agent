import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import '@/index.css'

/**
 * El título y la descripción viven acá, no en un <title> escrito a mano dentro
 * del <head>: ese literal no lo puede sobreescribir `generateMetadata`, así que
 * cada página de evento salía con DOS <title> — el suyo y el de la landing.
 * Un buscador se queda con uno solo, y no necesariamente con el correcto.
 */
export const metadata: Metadata = {
  title: {
    default: 'Luanna — Tu próximo viaje empieza con un mensaje',
    // Las páginas de evento traen su propio título completo; esta plantilla
    // solo aplica a las que definan un título corto.
    template: '%s | Luanna',
  },
  description:
    'Planea tu viaje por WhatsApp con Luanna. Recibe un itinerario personalizado con vuelos y hoteles reales en menos de 60 segundos.',
}

export const viewport: Viewport = {
  themeColor: '#f4f1ed',
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
          href="https://fonts.googleapis.com/css2?family=Special+Elite&family=Geist:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}

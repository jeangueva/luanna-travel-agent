/**
 * Textos del portal público. El visitante puede venir de cualquier país, así
 * que el portal habla español o inglés según su navegador; `?lang=` lo fija.
 * El contenido que escribe el organizador (nombre, ciudad) no se traduce.
 */
export type Idioma = 'es' | 'en'

export function elegirIdioma(param: string | undefined, acceptLanguage: string | null): Idioma {
  if (param === 'es' || param === 'en') return param
  const primero = acceptLanguage?.split(',')[0]?.trim().toLowerCase() ?? ''
  return primero.startsWith('es') || !primero ? 'es' : 'en'
}

export const textosPortal = {
  es: {
    titulo: 'Cómo llegar y dónde quedarte',
    subtituloVuelos: 'Tu vuelo y tu estancia, en un solo lugar.',
    subtitulo: 'Tu estancia, cerca del encuentro.',
    entrada: 'Entrada', salida: 'Salida',
    notaClinica: 'Confirma con la clínica las fechas de tu estancia y con el alojamiento los requisitos de accesibilidad. Este portal no verifica la idoneidad para recuperación médica.',
    dondeQuedarte: 'Dónde quedarte',
    buscarAlojamiento: (sede: string) => `Buscar alojamiento cerca de ${sede}`,
    otraPestana: 'Buscar en otra pestaña',
    notaProveedor: 'Las tarifas, disponibilidad, condiciones y reservas las gestiona el proveedor externo. Luanna puede recibir una comisión por las reservas de vuelos y alojamiento realizadas desde esta página.',
    preparando: 'Estamos preparando tu estancia.',
    preparandoTexto: 'La búsqueda de alojamiento aún no está habilitada. Consulta a la organización para coordinar tu visita.',
    pie: 'Cómo llegar y dónde quedarte · Luanna Ancla',
    otroIdioma: 'English',
    vuelos: {
      titulo: 'Cómo llegar',
      intro: (ciudad: string, iata: string) => `Vuelos de ida y vuelta a ${ciudad} (${iata}) en las fechas de tu estancia.`,
      campo: 'Tu aeropuerto de salida',
      boton: 'Buscar vuelos',
      errorCodigo: 'Escribe el código de 3 letras de tu aeropuerto, como MEX, MAD o MIA.',
      errorMismo: 'Ese es el aeropuerto de llegada. Escribe el de tu ciudad.',
    },
  },
  en: {
    titulo: 'How to get there and where to stay',
    subtituloVuelos: 'Your flight and your stay, in one place.',
    subtitulo: 'Your stay, close to where it happens.',
    entrada: 'Check-in', salida: 'Check-out',
    notaClinica: 'Confirm your dates with the clinic and any accessibility needs with your accommodation. This page does not assess suitability for medical recovery.',
    dondeQuedarte: 'Where to stay',
    buscarAlojamiento: (sede: string) => `Find a place to stay near ${sede}`,
    otraPestana: 'Open in a new tab',
    notaProveedor: 'Rates, availability, terms and bookings are handled by the external provider. Luanna may earn a commission on flight and accommodation bookings made from this page.',
    preparando: 'We are getting your stay ready.',
    preparandoTexto: 'Accommodation search is not available yet. Contact the organizer to plan your visit.',
    pie: 'How to get there and where to stay · Luanna Ancla',
    otroIdioma: 'Español',
    vuelos: {
      titulo: 'How to get there',
      intro: (ciudad: string, iata: string) => `Round-trip flights to ${ciudad} (${iata}) for the dates of your stay.`,
      campo: 'Your departure airport',
      boton: 'Search flights',
      errorCodigo: 'Enter your airport’s 3-letter code, like MEX, MAD or JFK.',
      errorMismo: 'That is the arrival airport. Enter the one in your city.',
    },
  },
} as const

export type TextosVuelos = (typeof textosPortal)[Idioma]['vuelos']

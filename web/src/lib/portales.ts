export interface Portal {
  id: string
  organizacion: string
  titulo: string
  vertical: 'servicio' | 'evento' | 'clinica'
  ciudad: string
  lat: number
  lon: number
  /** Código IATA del aeropuerto de llegada; vacío si la sede no ofrece vuelos. */
  aeropuerto: string
  checkin: string
  checkout: string
  publicado: boolean
}

export function validarPortal(input: unknown): Omit<Portal, 'id'> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Completa los datos de la sede.')
  }
  const data = input as Record<string, unknown>
  const texto = (key: string, max: number) => {
    const value = data[key]
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
      throw new Error(`Revisa ${key}: es obligatorio y admite hasta ${max} caracteres.`)
    }
    return value.trim()
  }
  const coordenada = (key: string, max: number) => {
    const value = data[key]
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > max) {
      throw new Error(`Revisa la coordenada ${key}.`)
    }
    return value
  }
  const fecha = (key: string) => {
    const value = texto(key, 10)
    const time = Date.parse(`${value}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(time) ||
      new Date(time).toISOString().slice(0, 10) !== value) {
      throw new Error('Usa fechas válidas de entrada y salida.')
    }
    return value
  }
  if (data.vertical !== 'servicio' && data.vertical !== 'clinica' && data.vertical !== 'evento') {
    throw new Error('Selecciona el tipo de sede.')
  }
  const aeropuerto = typeof data.aeropuerto === 'string' ? data.aeropuerto.trim().toUpperCase() : ''
  if (aeropuerto && !/^[A-Z]{3}$/.test(aeropuerto)) throw new Error('El aeropuerto debe ser un código de 3 letras, como LIM.')
  if (typeof data.publicado !== 'boolean') throw new Error('Revisa el estado de publicación.')
  const checkin = fecha('checkin')
  const checkout = fecha('checkout')
  const noches = (Date.parse(checkout) - Date.parse(checkin)) / 86400000
  if (noches < 1 || noches > 90) throw new Error('La estancia debe durar entre 1 y 90 noches.')
  return {
    organizacion: texto('organizacion', 120),
    titulo: texto('titulo', 160),
    ciudad: texto('ciudad', 100),
    vertical: data.vertical,
    lat: coordenada('lat', 90),
    lon: coordenada('lon', 180),
    aeropuerto,
    checkin, checkout,
    publicado: data.publicado,
  }
}

export const esIdPortal = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)

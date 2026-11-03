/** Demo only: no inventory, payments or reservation requests. */
export function nochesDemo(entrada: string, salida: string): number | null {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN
    const time = Date.parse(`${value}T00:00:00Z`)
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN
  }
  const nights = (parse(salida) - parse(entrada)) / 86400000
  return Number.isInteger(nights) && nights >= 1 && nights <= 90 ? nights : null
}

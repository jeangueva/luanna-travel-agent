/**
 * Contraste WCAG 2.x. Lo usan el contrato de tokens y el editor de marca:
 * un color que el organizador elige nunca debe dejar texto ilegible.
 */
export function hexValido(hex: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(hex)
}

function luminancia(hex: string): number {
  const canal = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5)
}

export function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro + 0.05) / (oscuro + 0.05)
}

/** Texto que se lee mejor encima de un color: casi negro o casi blanco. */
export function textoSobre(fondo: string): '#0a0a0a' | '#fafafa' {
  return contraste('#0a0a0a', fondo) >= contraste('#fafafa', fondo) ? '#0a0a0a' : '#fafafa'
}

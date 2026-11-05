/** Envío de correo con Resend (https://resend.com). Requiere RESEND_API_KEY. */
export const REMITENTE = 'Luanna <hola@luanna.app>'

export function correoConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

export async function enviarEnlace(email: string, enlace: string): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY no configurada')
  const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:16px;color:#1a1a1a;max-width:480px">
<p style="font-size:22px;margin:0 0 16px">Entra a Luanna</p>
<p>Toca el botón para entrar a tu plataforma. El enlace sirve una sola vez y vence en 20 minutos.</p>
<p style="margin:28px 0"><a href="${enlace}" style="background:#0a0a0a;color:#fafafa;padding:14px 22px;border-radius:999px;text-decoration:none;display:inline-block">Entrar a mi plataforma</a></p>
<p style="color:#5c5c5c;font-size:14px">Si no pediste este correo, ignóralo. Nadie puede entrar sin este enlace.</p>
</div>`
  const text = `Entra a Luanna: ${enlace}\n\nEl enlace sirve una sola vez y vence en 20 minutos. Si no lo pediste, ignora este correo.`
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: REMITENTE, to: [email], subject: 'Tu enlace para entrar a Luanna', html, text }),
  })
  if (!r.ok) throw new Error(`Resend respondió ${r.status}`)
}

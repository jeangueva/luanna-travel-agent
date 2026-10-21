/**
 * Todo lo que la plataforma puede no tener configurado todavía vive acá, con
 * un booleano por integración. Un token ausente apaga su módulo; nunca produce
 * un mapa gris, un iframe roto ni un enlace de afiliado sin marker.
 */
export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
export const STAY22_AID = process.env.NEXT_PUBLIC_STAY22_AID ?? "";
export const TP_MARKER = process.env.NEXT_PUBLIC_TP_MARKER ?? "";

/** URLs completas de los widgets de Travelpayouts, copiadas del panel de TP. */
export const TP_WIDGET_VUELOS = process.env.NEXT_PUBLIC_TP_WIDGET_VUELOS ?? "";
export const TP_WIDGET_SEGUROS = process.env.NEXT_PUBLIC_TP_WIDGET_SEGUROS ?? "";
export const TP_WIDGET_ESIM = process.env.NEXT_PUBLIC_TP_WIDGET_ESIM ?? "";

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://luanna.app"
).replace(/\/$/, "");

export const hayMapa = () => MAPBOX_TOKEN.length > 0;
export const hayStay22 = () => STAY22_AID.length > 0;
export const hayMarker = () => TP_MARKER.length > 0;

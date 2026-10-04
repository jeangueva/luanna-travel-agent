/**
 * Los NEXT_PUBLIC_* se inlinean durante el build: hay que leerlos con el
 * nombre literal (`process.env.NEXT_PUBLIC_X`), nunca con una clave dinámica,
 * o el bundler no los reemplaza y llegan vacíos al navegador.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://luanna.app"
).replace(/\/+$/, "");

export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
export const STAY22_AID = process.env.NEXT_PUBLIC_STAY22_AID ?? "";
export const TP_MARKER = process.env.NEXT_PUBLIC_TP_MARKER ?? "";

export const TP_WIDGET_VUELOS = process.env.NEXT_PUBLIC_TP_WIDGET_VUELOS ?? "";
export const TP_WIDGET_SEGUROS = process.env.NEXT_PUBLIC_TP_WIDGET_SEGUROS ?? "";
export const TP_WIDGET_ESIM = process.env.NEXT_PUBLIC_TP_WIDGET_ESIM ?? "";

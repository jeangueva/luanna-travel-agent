import { sumarDias } from "./fechas";

/**
 * Ventana de estadía por defecto: entrar la víspera y salir el día después.
 * Nadie llega la mañana de una carrera que arranca 06:00, y casi nadie viaja
 * dos horas después de cruzar la meta.
 */
export const NOCHES_ANTES = 1;
export const NOCHES_DESPUES = 1;

export function ventanaEstadia(fechaEvento: string): {
  checkin: string;
  checkout: string;
} {
  return {
    checkin: sumarDias(fechaEvento, -NOCHES_ANTES),
    checkout: sumarDias(fechaEvento, NOCHES_DESPUES),
  };
}

/**
 * Stay22 dibuja su propio mapa de hoteles centrado en un punto. Lo montamos
 * sobre las coordenadas de la partida — no sobre el centro de la ciudad — que
 * es exactamente la pregunta que trae el atleta: qué hay caminando desde acá.
 */
export function urlStay22(args: {
  aid: string;
  lat: number;
  lng: number;
  checkin: string;
  checkout: string;
  titulo?: string;
}): string {
  const url = new URL("https://www.stay22.com/embed/gm");
  url.searchParams.set("aid", args.aid);
  url.searchParams.set("lat", String(args.lat));
  url.searchParams.set("lng", String(args.lng));
  url.searchParams.set("checkin", args.checkin);
  url.searchParams.set("checkout", args.checkout);
  url.searchParams.set("maincolor", "FF4500");
  url.searchParams.set("hidebranding", "true");
  url.searchParams.set("zoom", "14");
  if (args.titulo) url.searchParams.set("venue", args.titulo);
  return url.toString();
}

/**
 * Enlace de hoteles de respaldo, con la misma forma que ya usa el worker de
 * WhatsApp (`buildHotelSearchUrl` en workers/src/tools.ts): tp.media/r con
 * p=4115 envolviendo una búsqueda de Hotellook. Se muestra cuando Stay22 no
 * está configurado, para que la página nunca quede sin ruta de conversión.
 */
export function urlHotelesFallback(args: {
  marker: string;
  ciudad: string;
  checkin: string;
  checkout: string;
  adultos?: number;
}): string {
  const inner = new URL("https://search.hotellook.com/");
  inner.searchParams.set("destination", args.ciudad);
  inner.searchParams.set("checkIn", args.checkin);
  inner.searchParams.set("checkOut", args.checkout);
  inner.searchParams.set("adults", String(args.adultos ?? 2));
  inner.searchParams.set("currency", "usd");

  const wrapped = new URL("https://tp.media/r");
  wrapped.searchParams.set("marker", args.marker);
  wrapped.searchParams.set("trs", "");
  wrapped.searchParams.set("p", "4115");
  wrapped.searchParams.set("u", inner.toString());
  wrapped.searchParams.set("campaign_id", "101");
  return wrapped.toString();
}

/**
 * Búsqueda de vuelos ida y vuelta hacia la sede, con la misma forma de ruta
 * que el worker de WhatsApp: ORIGEN DDMM DESTINO DDMM PASAJEROS. El visitante
 * pone su origen; la sede pone el destino y las fechas.
 */
export function urlVuelos(args: {
  marker: string;
  origen: string;
  destino: string;
  ida: string;
  vuelta: string;
  adultos?: number;
}): string {
  const ddmm = (fecha: string) => fecha.slice(8, 10) + fecha.slice(5, 7);
  const ruta = `${args.origen}${ddmm(args.ida)}${args.destino}${ddmm(args.vuelta)}${args.adultos ?? 1}`;
  const url = new URL(`https://www.aviasales.com/search/${ruta}`);
  if (args.marker) url.searchParams.set("marker", args.marker);
  return url.toString();
}

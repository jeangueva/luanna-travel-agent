import { sumarDias } from "./fechas";

/**
 * Noches del evento: la víspera (recojo de kit y charla técnica) y la noche
 * de la carrera para recuperarse. Quien viaja de lejos suele sumar más, pero
 * esta es la ventana que casi todos necesitan.
 */
export function ventanaEstadia(fechaEvento: string): {
  checkin: string;
  checkout: string;
} {
  return { checkin: sumarDias(fechaEvento, -1), checkout: sumarDias(fechaEvento, 1) };
}

/**
 * Embed de mapa de Stay22. Se ancla en la coordenada exacta de la partida, no
 * en la ciudad: el atleta quiere dormir a distancia caminable de la línea de
 * salida, y "Lima" abarca 40 km.
 */
export function urlStay22(args: {
  aid: string;
  lat: number;
  lng: number;
  checkin: string;
  checkout: string;
  titulo: string;
}): string {
  const url = new URL("https://www.stay22.com/embed/gm");
  url.searchParams.set("aid", args.aid);
  url.searchParams.set("lat", String(args.lat));
  url.searchParams.set("lng", String(args.lng));
  url.searchParams.set("checkin", args.checkin);
  url.searchParams.set("checkout", args.checkout);
  url.searchParams.set("venue", args.titulo);
  url.searchParams.set("maincolor", "ff4500");
  return url.toString();
}

/** Marker de Travelpayouts con sub-id: `12345.slug-del-evento`. */
export function markerConSubId(marker: string, subId?: string): string {
  const limpio = (subId ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60);
  return limpio ? `${marker}.${limpio}` : marker;
}

/**
 * Búsqueda de hoteles por ciudad. Es el respaldo cuando no hay AID de Stay22:
 * envuelve Hotellook con el marker de afiliado, igual que el bot de WhatsApp.
 */
export function urlHotelesFallback(args: {
  marker: string;
  ciudad: string;
  checkin: string;
  checkout: string;
  subId?: string;
}): string {
  const inner = new URL("https://search.hotellook.com/");
  inner.searchParams.set("destination", args.ciudad);
  inner.searchParams.set("checkIn", args.checkin);
  inner.searchParams.set("checkOut", args.checkout);
  inner.searchParams.set("adults", "1");
  inner.searchParams.set("currency", "usd");

  const wrapped = new URL("https://tp.media/r");
  wrapped.searchParams.set("marker", args.marker);
  wrapped.searchParams.set("trs", "");
  wrapped.searchParams.set("p", "4115");
  wrapped.searchParams.set("u", inner.toString());
  wrapped.searchParams.set("campaign_id", "101");
  if (args.subId) wrapped.searchParams.set("sub_id", args.subId);
  return wrapped.toString();
}

function ddmm(iso: string | null | undefined): string {
  const m = iso?.match(/^\d{4}-(\d{2})-(\d{2})$/);
  return m ? `${m[2]}${m[1]}` : "";
}

/**
 * Búsqueda en vivo de Aviasales, con las fechas ya cargadas. Formato de ruta:
 * `ORIGEN` + `DDMM` + `DESTINO` + `DDMM` + pasajeros (las fechas son opcionales).
 */
export function urlBusquedaVuelos(args: {
  origen: string;
  destino: string;
  salida?: string | null;
  regreso?: string | null;
  pasajeros?: number;
  marker: string;
  subId?: string;
}): string {
  const ruta = `${args.origen}${ddmm(args.salida)}${args.destino}${ddmm(args.regreso)}${args.pasajeros ?? 1}`;
  const url = new URL(`https://www.aviasales.com/search/${ruta}`);
  url.searchParams.set("marker", markerConSubId(args.marker, args.subId));
  return url.toString();
}

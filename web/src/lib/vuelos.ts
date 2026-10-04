import { urlBusquedaVuelos } from "./afiliados";
import { esFechaISOValida, sumarDias } from "./fechas";

/**
 * Ciudades de salida que ofrece el selector: los hubs de Latinoamérica más
 * Madrid y Miami, que concentran a quien viaja desde fuera de la región. Los
 * códigos son de ciudad/metro (BUE, SAO, RIO), no de aeropuerto: Aviasales
 * busca en todos los aeropuertos del metro a la vez.
 */
export const ORIGENES = [
  { iata: "LIM", nombre: "Lima", pais: "PE" },
  { iata: "BOG", nombre: "Bogotá", pais: "CO" },
  { iata: "MDE", nombre: "Medellín", pais: "CO" },
  { iata: "MEX", nombre: "Ciudad de México", pais: "MX" },
  { iata: "BUE", nombre: "Buenos Aires", pais: "AR" },
  { iata: "SCL", nombre: "Santiago", pais: "CL" },
  { iata: "SAO", nombre: "São Paulo", pais: "BR" },
  { iata: "RIO", nombre: "Río de Janeiro", pais: "BR" },
  { iata: "UIO", nombre: "Quito", pais: "EC" },
  { iata: "GYE", nombre: "Guayaquil", pais: "EC" },
  { iata: "MVD", nombre: "Montevideo", pais: "UY" },
  { iata: "LPB", nombre: "La Paz", pais: "BO" },
  { iata: "VVI", nombre: "Santa Cruz de la Sierra", pais: "BO" },
  { iata: "ASU", nombre: "Asunción", pais: "PY" },
  { iata: "PTY", nombre: "Ciudad de Panamá", pais: "PA" },
  { iata: "SJO", nombre: "San José", pais: "CR" },
  { iata: "GUA", nombre: "Ciudad de Guatemala", pais: "GT" },
  { iata: "SDQ", nombre: "Santo Domingo", pais: "DO" },
  { iata: "MAD", nombre: "Madrid", pais: "ES" },
  { iata: "MIA", nombre: "Miami", pais: "US" },
] as const;

export type CodigoOrigen = (typeof ORIGENES)[number]["iata"];

export function esOrigenValido(iata: string): iata is CodigoOrigen {
  return ORIGENES.some((o) => o.iata === iata);
}

export function nombreOrigen(iata: string): string {
  return ORIGENES.find((o) => o.iata === iata)?.nombre ?? iata;
}

/**
 * Primer origen de cada país: el hub al que va la mayoría. Se usa solo como
 * valor inicial del selector, que el usuario puede cambiar; para un país fuera
 * de la lista no se adivina nada y el selector arranca sin elegir.
 */
export function origenSugerido(pais: string | null | undefined): CodigoOrigen | null {
  if (!pais) return null;
  const codigo = pais.trim().toUpperCase();
  return ORIGENES.find((o) => o.pais === codigo)?.iata ?? null;
}

export interface OfertaTP {
  origin?: string;
  destination?: string;
  price: number;
  airline?: string;
  departure_at: string;
  return_at?: string | null;
  transfers?: number;
}

export interface PrecioDesde {
  usd: number;
  aerolinea: string | null;
  salida: string;
  regreso: string;
  escalas: number | null;
  /** true si las fechas no caen en la ventana habitual (víspera ± una semana). */
  aproximado: boolean;
}

const dia = (iso: string) => iso.slice(0, 10);

/**
 * La oferta más barata que sirve para correr la carrera: sale antes del día del
 * evento y regresa después. Dos niveles de tolerancia, y el segundo se marca
 * `aproximado` para que la página no lo presente como la fecha que el atleta
 * va a volar:
 *   · ventana: sale entre 6 y 1 días antes, regresa entre 1 y 7 después;
 *   · amplia:  hasta 14 días de margen a cada lado.
 * Una oferta sin fecha de regreso (solo ida) no cuenta: el atleta vuelve.
 */
export function elegirOferta(ofertas: OfertaTP[], fechaEvento: string): PrecioDesde | null {
  const nivel = (antes: number, despues: number): PrecioDesde | null => {
    const desde = sumarDias(fechaEvento, -antes);
    const hasta = sumarDias(fechaEvento, -1);
    const regresoDesde = sumarDias(fechaEvento, 1);
    const regresoHasta = sumarDias(fechaEvento, despues);

    let mejor: OfertaTP | null = null;
    for (const o of ofertas) {
      if (!Number.isFinite(o.price) || o.price <= 0) continue;
      if (typeof o.departure_at !== "string" || !o.return_at) continue;
      const salida = dia(o.departure_at);
      const regreso = dia(o.return_at);
      if (salida < desde || salida > hasta) continue;
      if (regreso < regresoDesde || regreso > regresoHasta) continue;
      if (!mejor || o.price < mejor.price) mejor = o;
    }
    if (!mejor) return null;
    return {
      usd: Math.round(mejor.price),
      aerolinea: mejor.airline ?? null,
      salida: dia(mejor.departure_at),
      regreso: dia(mejor.return_at as string),
      escalas: typeof mejor.transfers === "number" ? mejor.transfers : null,
      aproximado: false,
    };
  };

  return nivel(6, 7) ?? (() => {
    const amplio = nivel(14, 14);
    return amplio ? { ...amplio, aproximado: true } : null;
  })();
}

export interface ParametrosVuelos {
  origen: string;
  destino: string;
  fecha: string;
  evento: string;
}

/**
 * Lo único que el cliente decide: de dónde sale y para qué evento. El destino y
 * la fecha NO se aceptan por query string; salen del catálogo. Si el endpoint
 * tomara destino y fecha libres, bastaría variarlos para saltarse la caché y
 * gastar la cuota de la API de precios. Así, las combinaciones posibles son
 * (eventos publicados × 20 orígenes), un conjunto finito y cacheable.
 */
export function validarConsulta(
  q: URLSearchParams,
): { ok: true; origen: CodigoOrigen; evento: string } | { ok: false; error: string } {
  const origen = (q.get("origen") ?? "").toUpperCase();
  const evento = q.get("evento") ?? "";
  if (!esOrigenValido(origen)) return { ok: false, error: "origen no admitido" };
  if (!/^[a-z0-9-]{1,80}$/.test(evento)) return { ok: false, error: "evento inválido" };
  return { ok: true, origen, evento };
}

/** Une la consulta con lo que dice el catálogo del evento y descarta lo que no se puede vender. */
export function parametrosDelEvento(
  consulta: { origen: CodigoOrigen; evento: string },
  evento: { aeropuerto_iata: string | null; fecha_inicio: string },
  hoy: string,
): { ok: true; valor: ParametrosVuelos } | { ok: false; error: string } {
  if (!evento.aeropuerto_iata) return { ok: false, error: "el evento no tiene destino de vuelo" };
  if (!esFechaISOValida(evento.fecha_inicio)) return { ok: false, error: "fecha inválida" };
  if (evento.fecha_inicio <= hoy) return { ok: false, error: "el evento ya pasó" };
  if (consulta.origen === evento.aeropuerto_iata) {
    return { ok: false, error: "el origen es el destino" };
  }
  return {
    ok: true,
    valor: {
      origen: consulta.origen,
      destino: evento.aeropuerto_iata,
      fecha: evento.fecha_inicio,
      evento: consulta.evento,
    },
  };
}

const ENDPOINT_PRECIOS = "https://api.travelpayouts.com/aviasales/v3/prices_for_dates";

/**
 * Precios en caché de la Data API de Aviasales (los que encontraron usuarios
 * reales hace poco), no una cotización en vivo: en rutas poco buscadas pueden
 * faltar o estar viejos, y por eso nada de esto se presenta como precio final.
 *
 * Se consulta por mes de salida, no por día exacto: la caché de un día
 * concreto casi siempre está vacía en rutas de nicho. La elección de la fecha
 * buena la hace `elegirOferta` sobre las ofertas de todo el mes.
 */
export async function buscarPrecioDesde(
  args: ParametrosVuelos,
  token: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ precio: PrecioDesde | null; fallo: boolean }> {
  // La ventana de salida puede cruzar de mes (carrera el día 3): dos consultas.
  const meses = [
    ...new Set([sumarDias(args.fecha, -14), sumarDias(args.fecha, -1)].map((f) => f.slice(0, 7))),
  ];

  const respuestas = await Promise.all(
    meses.map(async (mes) => {
      const url = new URL(ENDPOINT_PRECIOS);
      url.searchParams.set("origin", args.origen);
      url.searchParams.set("destination", args.destino);
      url.searchParams.set("departure_at", mes);
      url.searchParams.set("one_way", "false");
      url.searchParams.set("direct", "false");
      url.searchParams.set("currency", "usd");
      url.searchParams.set("sorting", "price");
      url.searchParams.set("limit", "100");
      url.searchParams.set("unique", "false");
      try {
        const res = await fetchFn(url, {
          headers: { "X-Access-Token": token },
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return null;
        const cuerpo = (await res.json()) as { data?: unknown };
        return Array.isArray(cuerpo.data) ? (cuerpo.data as OfertaTP[]) : null;
      } catch {
        return null;
      }
    }),
  );

  // Que una consulta falle no es lo mismo que "no hay precios": lo primero no
  // debe quedar cacheado una hora como si fuera un dato.
  const fallo = respuestas.some((r) => r === null);
  const ofertas = respuestas.flatMap((r) => r ?? []);
  return { precio: elegirOferta(ofertas, args.fecha), fallo };
}

export interface RespuestaVuelos {
  origen: string;
  destino: string;
  precio: PrecioDesde | null;
  /** Búsqueda en vivo de Aviasales con el marker de afiliado y el sub-id. */
  url: string;
}

export function enlaceBusqueda(
  p: ParametrosVuelos,
  marker: string,
  precio: PrecioDesde | null,
): string {
  return urlBusquedaVuelos({
    origen: p.origen,
    destino: p.destino,
    // Con precio, la búsqueda abre en las fechas de esa oferta. Sin precio se
    // pide el día de la víspera y la vuelta del día siguiente.
    salida: precio?.salida ?? sumarDias(p.fecha, -2),
    regreso: precio?.regreso ?? sumarDias(p.fecha, 1),
    marker,
    subId: `ev-${p.evento}`,
  });
}

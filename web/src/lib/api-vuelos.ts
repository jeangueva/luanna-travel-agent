import type { Evento } from "./eventos-types";
import {
  enlaceBusqueda,
  parametrosDelEvento,
  validarConsulta,
  type ParametrosVuelos,
  type PrecioDesde,
  type RespuestaVuelos,
} from "./vuelos";

/**
 * Precio "desde" de un vuelo a la sede de un evento, más el enlace de
 * búsqueda con el marker de afiliado.
 *
 *   GET /api/vuelos?evento=<slug>&origen=LIM
 *
 * Destino y fecha salen del catálogo, no de la query string (ver
 * `validarConsulta`). La respuesta es la misma para todos los visitantes, así
 * que se cachea una hora en el borde: la cuota de la API de precios la gasta
 * una persona por combinación evento × origen, no cada visita.
 *
 * Las dependencias se inyectan para poder probar cada rama sin base de datos
 * ni red; app/api/vuelos/route.ts las cablea con las reales.
 */
export interface DepsVuelos {
  marker: string;
  token: string;
  hoy: () => string;
  obtenerEvento: (
    slug: string,
  ) => Promise<Pick<Evento, "aeropuerto_iata" | "fecha_inicio"> | null>;
  buscarPrecio: (
    args: ParametrosVuelos,
    token: string,
  ) => Promise<{ precio: PrecioDesde | null; fallo: boolean }>;
}

export const CACHE_OK = "public, s-maxage=3600, stale-while-revalidate=21600";
// Un fallo del upstream no puede quedar cacheado una hora como si fuera "sin precios".
export const CACHE_FALLO = "public, s-maxage=60";
const CACHE_ERROR = "public, max-age=60";

const error = (mensaje: string, status: number) =>
  Response.json({ error: mensaje }, { status, headers: { "cache-control": CACHE_ERROR } });

export async function manejarVuelos(request: Request, d: DepsVuelos): Promise<Response> {
  if (!d.marker) return error("vuelos no configurados", 503);

  const consulta = validarConsulta(new URL(request.url).searchParams);
  if (!consulta.ok) return error(consulta.error, 400);

  const evento = await d.obtenerEvento(consulta.evento);
  if (!evento) return error("evento no encontrado", 404);

  const parametros = parametrosDelEvento(consulta, evento, d.hoy());
  if (!parametros.ok) return error(parametros.error, 422);

  // Sin token de Travelpayouts igual se ofrece la búsqueda: es lo que cobra.
  const { precio, fallo } = d.token
    ? await d.buscarPrecio(parametros.valor, d.token)
    : { precio: null, fallo: false };

  const cuerpo: RespuestaVuelos = {
    origen: parametros.valor.origen,
    destino: parametros.valor.destino,
    precio,
    url: enlaceBusqueda(parametros.valor, d.marker, precio),
  };
  return Response.json(cuerpo, {
    headers: { "cache-control": fallo ? CACHE_FALLO : CACHE_OK },
  });
}

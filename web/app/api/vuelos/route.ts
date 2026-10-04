import { manejarVuelos } from "@/lib/api-vuelos";
import { TP_MARKER } from "@/lib/config";
import { obtenerEventoPorSlug } from "@/lib/eventos";
import { buscarPrecioDesde } from "@/lib/vuelos";

export async function GET(request: Request): Promise<Response> {
  return manejarVuelos(request, {
    marker: TP_MARKER,
    token: process.env.TRAVELPAYOUTS_TOKEN ?? "",
    hoy: () => new Date().toISOString().slice(0, 10),
    obtenerEvento: obtenerEventoPorSlug,
    buscarPrecio: buscarPrecioDesde,
  });
}

import { origenSugerido } from "@/lib/vuelos";

/**
 * País del visitante según Cloudflare, traducido a una ciudad de salida
 * sugerida. Es lo único de la página que depende de quién mira, y por eso vive
 * aparte de /api/vuelos: aquella respuesta es idéntica para todos y se cachea
 * en el borde; esta es por visitante y no se cachea.
 */
export async function GET(request: Request): Promise<Response> {
  const cf = (request as Request & { cf?: { country?: string } }).cf;
  const pais = cf?.country ?? request.headers.get("cf-ipcountry");

  return Response.json(
    { pais: pais ?? null, origen: origenSugerido(pais) },
    { headers: { "cache-control": "private, max-age=3600" } },
  );
}

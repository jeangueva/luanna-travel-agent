import { revalidatePath } from "next/cache";

/**
 * El worker de ingesta llama acá cuando un revisor publica, rechaza o corrige
 * un evento. Sin esto la aprobación no se ve hasta que vence la ventana de
 * ISR — hasta una hora de diferencia entre apretar el botón y que la página
 * exista.
 */
function tokenValido(recibido: string | null, esperado: string): boolean {
  if (!recibido || !esperado || recibido.length !== esperado.length) return false;
  let diff = 0;
  for (let i = 0; i < recibido.length; i++) {
    diff |= recibido.charCodeAt(i) ^ esperado.charCodeAt(i);
  }
  return diff === 0;
}

export async function POST(request: Request): Promise<Response> {
  const esperado = process.env.REVALIDATE_SECRET ?? "";
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!esperado || !tokenValido(token, esperado)) {
    return Response.json({ error: "no autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    slug?: string;
    categoria?: string;
  } | null;
  if (!body?.slug || !body?.categoria) {
    return Response.json({ error: "faltan slug y categoria" }, { status: 400 });
  }

  const rutas = [
    `/eventos/${body.categoria}/${body.slug}`,
    `/eventos/${body.categoria}`,
    "/eventos",
    "/sitemap.xml",
  ];
  for (const ruta of rutas) revalidatePath(ruta);

  return Response.json({ revalidado: rutas });
}

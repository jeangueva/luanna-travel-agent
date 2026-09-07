import {
  adjuntarGpx,
  cambiarEstado,
  corregirCoordenadas,
  getDb,
  listarPorEstado,
} from "./db.js";
import type { Env } from "./env.js";
import { coordenadaPlausible } from "./geocode.js";
import { ejecutarIngesta } from "./pipeline.js";
import { TIPOS_TRAMO, type TipoTramo } from "./types.js";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

/**
 * Comparación en tiempo constante: un `===` sobre el token filtra su prefijo
 * por diferencia de tiempo de respuesta.
 */
function tokenValido(recibido: string | null, esperado: string): boolean {
  if (!recibido || !esperado || recibido.length !== esperado.length) return false;
  let diff = 0;
  for (let i = 0; i < recibido.length; i++) {
    diff |= recibido.charCodeAt(i) ^ esperado.charCodeAt(i);
  }
  return diff === 0;
}

function autorizado(request: Request, env: Env): boolean {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  return tokenValido(token, env.ADMIN_API_KEY);
}

/**
 * Publicar cambia el HTML que sirve el CDN, pero la página ya está cacheada.
 * Sin este ping, un evento aprobado el lunes aparece cuando expire el ISR, no
 * cuando el revisor apretó el botón.
 */
async function revalidar(env: Env, slug: string, categoria: string): Promise<void> {
  if (!env.REVALIDATE_URL || !env.REVALIDATE_SECRET) return;
  try {
    await fetch(env.REVALIDATE_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.REVALIDATE_SECRET}`,
      },
      body: JSON.stringify({ slug, categoria }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    // El revalidate es best-effort: el ISR igual refresca la página al vencer
    // su ventana. Fallar aquí no puede tumbar la aprobación.
  }
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      ejecutarIngesta(env).then(
        (r) => console.log("[ingesta]", JSON.stringify(r)),
        (e) => console.error("[ingesta] falló", e),
      ),
    );
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const sql = () => getDb(env.DATABASE_URL);

    // Los .gpx son públicos: el mapa del navegador los descarga directo.
    if (request.method === "GET" && path.startsWith("/gpx/")) {
      const key = decodeURIComponent(path.slice("/gpx/".length));
      const obj = await env.GPX.get(key);
      if (!obj) return new Response("No encontrado", { status: 404 });
      return new Response(obj.body, {
        headers: {
          "content-type": "application/gpx+xml",
          "cache-control": "public, max-age=31536000, immutable",
          "access-control-allow-origin": "*",
          etag: obj.httpEtag,
        },
      });
    }

    if (!path.startsWith("/admin/")) {
      return new Response("No encontrado", { status: 404 });
    }
    if (!autorizado(request, env)) {
      return json({ error: "no autorizado" }, 401);
    }

    if (path === "/admin/ingesta" && request.method === "POST") {
      // Corrida manual: se responde 202 y el trabajo sigue en background, igual
      // que en el cron. Para verla completa, `wrangler tail`.
      ctx.waitUntil(
        ejecutarIngesta(env).then(
          (r) => console.log("[ingesta manual]", JSON.stringify(r)),
          (e) => console.error("[ingesta manual] falló", e),
        ),
      );
      return json({ estado: "corriendo", ver: "npx wrangler tail" }, 202);
    }

    if (path === "/admin/drafts" && request.method === "GET") {
      const estado = (url.searchParams.get("estado") ?? "draft") as
        | "draft"
        | "published"
        | "rechazado";
      return json(await listarPorEstado(sql(), estado));
    }

    const mEvento = path.match(/^\/admin\/eventos\/([^/]+)(?:\/(\w+))?$/);
    if (mEvento) {
      const slug = decodeURIComponent(mEvento[1]);
      const accion = mEvento[2];

      if (accion === "publicar" && request.method === "POST") {
        const ev = await cambiarEstado(sql(), slug, "published");
        if (!ev) return json({ error: "evento no existe" }, 404);
        ctx.waitUntil(revalidar(env, ev.slug, ev.categoria));
        return json(ev);
      }

      if (accion === "rechazar" && request.method === "POST") {
        const ev = await cambiarEstado(sql(), slug, "rechazado");
        return ev ? json(ev) : json({ error: "evento no existe" }, 404);
      }

      if (accion === "coordenadas" && request.method === "PATCH") {
        const body = (await request.json().catch(() => null)) as {
          lat?: number;
          lon?: number;
        } | null;
        if (!body || !coordenadaPlausible(body.lat, body.lon)) {
          return json({ error: "lat/lon inválidas" }, 400);
        }
        const ev = await corregirCoordenadas(sql(), slug, body.lat!, body.lon!);
        if (!ev) return json({ error: "evento no existe" }, 404);
        ctx.waitUntil(revalidar(env, ev.slug, ev.categoria));
        return json(ev);
      }

      if (accion === "gpx" && request.method === "PUT") {
        const tipo = (url.searchParams.get("tipo") ?? "carrera") as TipoTramo;
        if (!TIPOS_TRAMO.includes(tipo)) {
          return json({ error: `tipo inválido: ${tipo}` }, 400);
        }
        const cuerpo = await request.arrayBuffer();
        if (cuerpo.byteLength === 0) return json({ error: "cuerpo vacío" }, 400);

        const key = `${slug}/${tipo}.gpx`;
        await env.GPX.put(key, cuerpo, {
          httpMetadata: { contentType: "application/gpx+xml" },
        });

        const gpxUrl = `${url.origin}/gpx/${encodeURIComponent(key)}`;
        const ev = await adjuntarGpx(
          sql(),
          slug,
          {
            tipo,
            nombre: url.searchParams.get("nombre") ?? tipo,
            gpx_url: gpxUrl,
          },
          url.searchParams.get("principal") === "1",
        );
        if (!ev) return json({ error: "evento no existe" }, 404);
        ctx.waitUntil(revalidar(env, ev.slug, ev.categoria));
        return json(ev);
      }
    }

    return json({ error: "ruta desconocida" }, 404);
  },
};

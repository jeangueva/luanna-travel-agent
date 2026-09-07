import { buscarBrave, componerContexto } from "./brave.js";
import { abrirCorrida, cerrarCorrida, getDb, upsertEvento } from "./db.js";
import { extraerEventos } from "./extract.js";
import { resolverCoordenadas } from "./geocode.js";
import { configDesdeEnv, generarQueries } from "./queries.js";
import { slugEvento } from "./slug.js";
import type { ResumenCorrida } from "./types.js";
import { validarExtraido } from "./validar.js";
import type { Env } from "./env.js";

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * El plan gratuito de Brave es 1 req/s. Sin esta pausa la primera corrida
 * completa se convierte en una ráfaga de 429 y una bitácora de puros errores.
 */
const PAUSA_ENTRE_QUERIES_MS = 1200;

export async function ejecutarIngesta(env: Env): Promise<ResumenCorrida> {
  const sql = getDb(env.DATABASE_URL);
  const config = configDesdeEnv(env as unknown as Record<string, string>);
  const queries = generarQueries(config);
  const hoy = new Date().toISOString().slice(0, 10);

  const resumen: ResumenCorrida = {
    queries: queries.length,
    candidatos: 0,
    insertados: 0,
    actualizados: 0,
    rechazados: 0,
    errores: [],
  };

  const runId = await abrirCorrida(sql);
  // Un mismo evento aparece en la búsqueda de varios países o años; el UPSERT
  // lo absorbe, pero contarlo dos veces haría ilegible la bitácora.
  const vistos = new Set<string>();

  for (const [i, query] of queries.entries()) {
    if (i > 0) await dormir(PAUSA_ENTRE_QUERIES_MS);

    try {
      const resultados = await buscarBrave(query.q, env.BRAVE_API_KEY);
      if (resultados.length === 0) continue;

      const extraidos = await extraerEventos(
        componerContexto(resultados),
        query.categoria,
        {
          apiKey: env.ANTHROPIC_API_KEY,
          modelo: env.LLM_MODEL ?? "claude-opus-5",
          hoy,
        },
      );

      for (const crudo of extraidos) {
        resumen.candidatos++;

        const validado = validarExtraido(crudo, hoy);
        if (!validado.ok) {
          resumen.rechazados++;
          resumen.errores.push(
            `${validado.rechazo.evento}: ${validado.rechazo.motivo}`,
          );
          continue;
        }
        const ev = validado.evento;

        const slug = slugEvento(ev.nombre_oficial, ev.fecha_inicio);
        if (vistos.has(slug)) continue;
        vistos.add(slug);

        const coord = await resolverCoordenadas(
          {
            lat: ev.latitud_partida,
            lon: ev.longitud_partida,
            lugar_partida: ev.lugar_partida,
            ciudad_sede: ev.ciudad_sede,
            pais: ev.pais,
          },
          env.MAPBOX_TOKEN,
        );

        // Sin coordenadas no hay mapa, y sin mapa la página no resuelve nada:
        // es preferible no tenerla a publicarla vacía.
        if (!coord) {
          resumen.rechazados++;
          resumen.errores.push(`${ev.nombre_oficial}: sin coordenadas`);
          continue;
        }

        const accion = await upsertEvento(sql, {
          slug,
          nombre_oficial: ev.nombre_oficial,
          categoria: ev.categoria,
          fecha_inicio: ev.fecha_inicio,
          ciudad_sede: ev.ciudad_sede,
          pais: ev.pais,
          latitud_partida: coord.lat,
          longitud_partida: coord.lon,
          fuente_url: ev.fuente_url,
          geo_fuente: coord.fuente,
          confianza: ev.confianza,
          descripcion: ev.descripcion,
          badges: ev.badges,
        });

        if (accion === "insertado") resumen.insertados++;
        else resumen.actualizados++;
      }
    } catch (err) {
      // Una query que falla no cancela la corrida: las otras 39 siguen.
      resumen.errores.push(
        `query "${query.q}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  await cerrarCorrida(sql, runId, resumen);
  return resumen;
}

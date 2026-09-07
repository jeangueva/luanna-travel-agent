import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type {
  Categoria,
  EventoDeportivo,
  ResumenCorrida,
  Tramo,
} from "./types.js";

export type Sql = NeonQueryFunction<false, false>;

export function getDb(databaseUrl: string): Sql {
  return neon(databaseUrl);
}

export interface EventoParaGuardar {
  slug: string;
  nombre_oficial: string;
  categoria: Categoria;
  fecha_inicio: string;
  ciudad_sede: string | null;
  pais: string | null;
  latitud_partida: number;
  longitud_partida: number;
  fuente_url: string | null;
  geo_fuente: "llm" | "mapbox";
  confianza: number;
  descripcion: string | null;
  badges: string[];
}

/**
 * UPSERT por slug con dos invariantes que el PRD implica pero no escribe:
 *
 *  · `estado_publicacion` nunca lo toca el cron. Una página publicada no puede
 *    volver a draft porque el domingo siguiente Brave devolvió otro snippet;
 *    eso la sacaría del índice de Google sin que nadie decidiera nada.
 *  · una coordenada corregida a mano (`geo_fuente = 'manual'`) gana siempre.
 *    Sin esto, la revisión humana dura exactamente una semana.
 */
export async function upsertEvento(
  sql: Sql,
  ev: EventoParaGuardar,
): Promise<"insertado" | "actualizado"> {
  const rows = (await sql`
    INSERT INTO eventos_deportivos (
      slug, nombre_oficial, categoria, fecha_inicio, ciudad_sede, pais,
      latitud_partida, longitud_partida, fuente_url, geo_fuente, confianza,
      descripcion, badges
    ) VALUES (
      ${ev.slug}, ${ev.nombre_oficial}, ${ev.categoria}, ${ev.fecha_inicio},
      ${ev.ciudad_sede}, ${ev.pais}, ${ev.latitud_partida},
      ${ev.longitud_partida}, ${ev.fuente_url}, ${ev.geo_fuente},
      ${ev.confianza}, ${ev.descripcion}, ${JSON.stringify(ev.badges)}::jsonb
    )
    ON CONFLICT (slug) DO UPDATE SET
      nombre_oficial = EXCLUDED.nombre_oficial,
      categoria = EXCLUDED.categoria,
      fecha_inicio = EXCLUDED.fecha_inicio,
      ciudad_sede = COALESCE(EXCLUDED.ciudad_sede, eventos_deportivos.ciudad_sede),
      pais = COALESCE(EXCLUDED.pais, eventos_deportivos.pais),
      latitud_partida = CASE WHEN eventos_deportivos.geo_fuente = 'manual'
        THEN eventos_deportivos.latitud_partida ELSE EXCLUDED.latitud_partida END,
      longitud_partida = CASE WHEN eventos_deportivos.geo_fuente = 'manual'
        THEN eventos_deportivos.longitud_partida ELSE EXCLUDED.longitud_partida END,
      geo_fuente = CASE WHEN eventos_deportivos.geo_fuente = 'manual'
        THEN 'manual' ELSE EXCLUDED.geo_fuente END,
      fuente_url = COALESCE(EXCLUDED.fuente_url, eventos_deportivos.fuente_url),
      confianza = GREATEST(EXCLUDED.confianza, eventos_deportivos.confianza),
      descripcion = COALESCE(eventos_deportivos.descripcion, EXCLUDED.descripcion),
      badges = CASE WHEN jsonb_array_length(eventos_deportivos.badges) > 0
        THEN eventos_deportivos.badges ELSE EXCLUDED.badges END,
      updated_at = NOW()
    RETURNING (xmax = 0) AS insertado
  `) as Array<{ insertado: boolean }>;

  return rows[0]?.insertado ? "insertado" : "actualizado";
}

export async function abrirCorrida(sql: Sql): Promise<number> {
  const rows = (await sql`
    INSERT INTO ingesta_runs DEFAULT VALUES RETURNING id
  `) as Array<{ id: number }>;
  return rows[0].id;
}

export async function cerrarCorrida(
  sql: Sql,
  id: number,
  resumen: ResumenCorrida,
): Promise<void> {
  await sql`
    UPDATE ingesta_runs SET
      finished_at = NOW(),
      queries = ${resumen.queries},
      candidatos = ${resumen.candidatos},
      insertados = ${resumen.insertados},
      actualizados = ${resumen.actualizados},
      rechazados = ${resumen.rechazados},
      errores = ${JSON.stringify(resumen.errores)}::jsonb
    WHERE id = ${id}
  `;
}

export async function listarPorEstado(
  sql: Sql,
  estado: "draft" | "published" | "rechazado",
  limite = 100,
): Promise<EventoDeportivo[]> {
  return (await sql`
    SELECT * FROM eventos_deportivos
    WHERE estado_publicacion = ${estado}
    ORDER BY fecha_inicio ASC
    LIMIT ${limite}
  `) as unknown as EventoDeportivo[];
}

export async function cambiarEstado(
  sql: Sql,
  slug: string,
  estado: "draft" | "published" | "rechazado",
): Promise<EventoDeportivo | null> {
  const rows = (await sql`
    UPDATE eventos_deportivos
    SET estado_publicacion = ${estado}, updated_at = NOW()
    WHERE slug = ${slug}
    RETURNING *
  `) as unknown as EventoDeportivo[];
  return rows[0] ?? null;
}

export async function corregirCoordenadas(
  sql: Sql,
  slug: string,
  lat: number,
  lon: number,
): Promise<EventoDeportivo | null> {
  const rows = (await sql`
    UPDATE eventos_deportivos
    SET latitud_partida = ${lat},
        longitud_partida = ${lon},
        geo_fuente = 'manual',
        updated_at = NOW()
    WHERE slug = ${slug}
    RETURNING *
  `) as unknown as EventoDeportivo[];
  return rows[0] ?? null;
}

/**
 * `ruta_gpx_url` es el trazado principal (el que dibuja el mapa por defecto);
 * `tramos` acumula los parciales del triatlón. Guardar el primero en ambos
 * lados evita que una página con un solo trazado tenga que consultar dos
 * campos distintos según la categoría.
 */
export async function adjuntarGpx(
  sql: Sql,
  slug: string,
  tramo: Tramo,
  esPrincipal: boolean,
): Promise<EventoDeportivo | null> {
  const rows = (await sql`
    UPDATE eventos_deportivos
    SET tramos = (
          SELECT COALESCE(jsonb_agg(t), '[]'::jsonb)
          FROM (
            SELECT t FROM jsonb_array_elements(eventos_deportivos.tramos) AS t
            WHERE t->>'tipo' <> ${tramo.tipo}
            UNION ALL
            SELECT ${JSON.stringify(tramo)}::jsonb
          ) AS merged(t)
        ),
        ruta_gpx_url = CASE WHEN ${esPrincipal}
          THEN ${tramo.gpx_url} ELSE eventos_deportivos.ruta_gpx_url END,
        updated_at = NOW()
    WHERE slug = ${slug}
    RETURNING *
  `) as unknown as EventoDeportivo[];
  return rows[0] ?? null;
}

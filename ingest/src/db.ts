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
  etiquetas: string[];
  fecha_inicio: string;
  ciudad_sede: string | null;
  pais: string | null;
  aeropuerto_iata: string | null;
  latitud_partida: number;
  longitud_partida: number;
  fuente_url: string | null;
  geo_fuente: "llm" | "mapbox";
  confianza: number;
  descripcion: string | null;
  badges: string[];
  costo_min: number | null;
  costo_max: number | null;
  moneda: string | null;
  inscripcion_url: string | null;
}

/**
 * UPSERT por slug con dos invariantes que el PRD implica pero no escribe:
 *
 *  · `estado_publicacion` nunca lo toca el cron. Una página publicada no puede
 *    volver a draft porque el domingo siguiente Brave devolvió otro snippet;
 *    eso la sacaría del índice de Google sin que nadie decidiera nada.
 *  · una coordenada corregida a mano (`geo_fuente = 'manual'`) gana siempre.
 *    Sin esto, la revisión humana dura exactamente una semana.
 *
 * Los campos que un revisor puede fijar a mano (IATA, etiquetas, costo)
 * siguen la misma regla que `descripcion`: el cron llena lo que está vacío y
 * nunca pisa lo que ya tiene valor.
 */
export async function upsertEvento(
  sql: Sql,
  ev: EventoParaGuardar,
): Promise<"insertado" | "actualizado"> {
  const rows = (await sql`
    INSERT INTO eventos_deportivos (
      slug, nombre_oficial, categoria, etiquetas, fecha_inicio, ciudad_sede,
      pais, aeropuerto_iata, latitud_partida, longitud_partida, fuente_url,
      geo_fuente, confianza, descripcion, badges, costo_min, costo_max, moneda,
      costo_fuente_url, costo_actualizado_at, inscripcion_url
    ) VALUES (
      ${ev.slug}, ${ev.nombre_oficial}, ${ev.categoria}, ${ev.etiquetas},
      ${ev.fecha_inicio}, ${ev.ciudad_sede}, ${ev.pais}, ${ev.aeropuerto_iata},
      ${ev.latitud_partida}, ${ev.longitud_partida}, ${ev.fuente_url},
      ${ev.geo_fuente}, ${ev.confianza}, ${ev.descripcion},
      ${JSON.stringify(ev.badges)}::jsonb, ${ev.costo_min}, ${ev.costo_max},
      ${ev.moneda},
      ${ev.costo_min === null ? null : ev.fuente_url},
      ${ev.costo_min === null ? null : new Date().toISOString()},
      ${ev.inscripcion_url}
    )
    ON CONFLICT (slug) DO UPDATE SET
      nombre_oficial = EXCLUDED.nombre_oficial,
      categoria = EXCLUDED.categoria,
      fecha_inicio = EXCLUDED.fecha_inicio,
      ciudad_sede = COALESCE(EXCLUDED.ciudad_sede, eventos_deportivos.ciudad_sede),
      pais = COALESCE(EXCLUDED.pais, eventos_deportivos.pais),
      aeropuerto_iata = COALESCE(eventos_deportivos.aeropuerto_iata, EXCLUDED.aeropuerto_iata),
      etiquetas = CASE WHEN cardinality(eventos_deportivos.etiquetas) > 0
        THEN eventos_deportivos.etiquetas ELSE EXCLUDED.etiquetas END,
      costo_min = COALESCE(eventos_deportivos.costo_min, EXCLUDED.costo_min),
      costo_max = COALESCE(eventos_deportivos.costo_max, EXCLUDED.costo_max),
      moneda = CASE WHEN eventos_deportivos.costo_min IS NOT NULL
        THEN eventos_deportivos.moneda ELSE EXCLUDED.moneda END,
      costo_fuente_url = CASE WHEN eventos_deportivos.costo_min IS NOT NULL
        THEN eventos_deportivos.costo_fuente_url ELSE EXCLUDED.costo_fuente_url END,
      costo_actualizado_at = CASE WHEN eventos_deportivos.costo_min IS NOT NULL
        THEN eventos_deportivos.costo_actualizado_at ELSE EXCLUDED.costo_actualizado_at END,
      inscripcion_url = COALESCE(eventos_deportivos.inscripcion_url, EXCLUDED.inscripcion_url),
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

/** El revisor fija el código cuando el autocomplete no lo pudo verificar. */
export async function fijarIata(
  sql: Sql,
  slug: string,
  iata: string,
): Promise<EventoDeportivo | null> {
  const rows = (await sql`
    UPDATE eventos_deportivos
    SET aeropuerto_iata = ${iata}, updated_at = NOW()
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

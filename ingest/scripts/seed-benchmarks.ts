/**
 * Carga los dos eventos de UAT del §6 del PRD como `draft`, para probar el
 * render de mapa y alojamiento antes de que el cron tenga datos propios.
 *
 * Las coordenadas NO están hardcodeadas: se geocodifican a partir del lugar
 * que pases por CLI. Un benchmark que valida el render con una coordenada
 * inventada no valida nada — el mapa se vería igual de correcto apuntando al
 * lugar equivocado.
 *
 *   npx tsx scripts/seed-benchmarks.ts \
 *     --olaya "Playa Agua Dulce, Chorrillos, Lima, Perú" \
 *     --triatlon "<sede oficial del Campeonato Nacional>"
 *
 * Variables: DATABASE_URL y MAPBOX_TOKEN (de .dev.vars o del entorno).
 */
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { geocodificar } from "../src/geocode.js";
import { geocodificarNominatim } from "./geocode-libre.js";
import { slugEvento } from "../src/slug.js";

const aquí = dirname(fileURLToPath(import.meta.url));

function cargarDevVars(): Record<string, string> {
  try {
    const contenido = readFileSync(join(aquí, "..", ".dev.vars"), "utf8");
    const out: Record<string, string> = {};
    for (const linea of contenido.split("\n")) {
      const m = linea.match(/^([A-Z_]+)=(.*)$/);
      if (m) out[m[1]] = m[2];
    }
    return out;
  } catch {
    return {};
  }
}

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const BENCHMARKS = [
  {
    flag: "olaya",
    nombre_oficial: "Reto Olaya Inverso",
    categoria: "aguas_abiertas" as const,
    etiquetas: ["travesia"],
    fecha_inicio: "2026-11-07",
    ciudad_sede: "Callao",
    pais: "Perú",
    // El Callao es parte del metro de Lima: el aeropuerto Jorge Chávez opera
    // bajo el código de ciudad LIM, que es el que entiende Aviasales.
    aeropuerto_iata: "LIM" as string | null,
    // Verificado en el calendario de natación 2026: sábado 7 de noviembre,
    // 6:00 am, La Punta, Callao — el recorrido inverso de la Ruta de Olaya,
    // que en su forma clásica va de Chorrillos a La Punta.
    lugarSugerido: "La Punta, Callao, Perú",
    fuente_url:
      "https://www.running4peru.com/calendarios/calendario-natacion-peru",
    descripcion:
      "Travesía de aguas abiertas en la bahía de Lima, en el sentido inverso de la clásica Ruta de Olaya: parte de La Punta, Callao, a las 6:00 am. Benchmark 1 del PRD: valida la extracción de una partida costera y el alojamiento cercano al litoral.",
    badges: ["Aguas abiertas", "Partida en playa", "6:00 am"],
  },
  {
    flag: "triatlon",
    nombre_oficial: "Triatlón Campeonato Nacional",
    categoria: "triatlon" as const,
    etiquetas: [] as string[],
    fecha_inicio: "2026-12-13",
    ciudad_sede: null,
    pais: "Perú",
    aeropuerto_iata: null as string | null,
    // Sin sugerencia a propósito: al 2026-09-06 este evento no figura en el
    // calendario público de triatlón de Perú ni en el sitio de la federación.
    // Pasa --triatlon "<sede>" cuando la tengas confirmada.
    lugarSugerido: null as string | null,
    fuente_url: null as string | null,
    descripcion:
      "Benchmark 2 del PRD: valida el trazado múltiple (natación, T1, ciclismo, T2, carrera) y que los pines de hoteles no tapen el circuito.",
    badges: ["Natación + ciclismo + carrera", "5 tramos"],
  },
];

async function main() {
  const env = { ...cargarDevVars(), ...process.env } as Record<string, string>;
  if (!env.DATABASE_URL) throw new Error("Falta DATABASE_URL");

  const sql = neon(env.DATABASE_URL);

  for (const b of BENCHMARKS) {
    const lugar = arg(b.flag) ?? b.lugarSugerido;
    if (!lugar) {
      console.log(
        `· ${b.nombre_oficial}: omitido — pasa --${b.flag} "<lugar de partida>"`,
      );
      continue;
    }

    // Mapbox si hay token; si no, Nominatim. Lo que nunca ocurre es inventar
    // la coordenada, y `geo_fuente` deja constancia de cuál de los dos fue.
    const geoFuente = env.MAPBOX_TOKEN ? "mapbox" : "nominatim";
    const coord = env.MAPBOX_TOKEN
      ? await geocodificar(lugar, env.MAPBOX_TOKEN)
      : await geocodificarNominatim(lugar);
    if (!coord) {
      console.error(`✗ ${b.nombre_oficial}: ${geoFuente} no resolvió "${lugar}"`);
      continue;
    }

    const slug = slugEvento(b.nombre_oficial, b.fecha_inicio);
    await sql`
      INSERT INTO eventos_deportivos (
        slug, nombre_oficial, categoria, etiquetas, fecha_inicio, ciudad_sede,
        pais, aeropuerto_iata, latitud_partida, longitud_partida, geo_fuente,
        confianza, descripcion, badges, fuente_url, estado_publicacion
      ) VALUES (
        ${slug}, ${b.nombre_oficial}, ${b.categoria}, ${b.etiquetas},
        ${b.fecha_inicio}, ${b.ciudad_sede}, ${b.pais}, ${b.aeropuerto_iata},
        ${coord.lat}, ${coord.lon}, ${geoFuente}, 1.0,
        ${b.descripcion}, ${JSON.stringify(b.badges)}::jsonb, ${b.fuente_url},
        'draft'
      )
      ON CONFLICT (slug) DO UPDATE SET
        aeropuerto_iata = COALESCE(eventos_deportivos.aeropuerto_iata, EXCLUDED.aeropuerto_iata),
        latitud_partida = EXCLUDED.latitud_partida,
        longitud_partida = EXCLUDED.longitud_partida,
        geo_fuente = ${geoFuente},
        updated_at = NOW()
    `;
    console.log(
      `✓ ${b.nombre_oficial} → /eventos/${b.categoria}/${slug}\n  ${coord.lat}, ${coord.lon} vía ${geoFuente} ("${lugar}") — draft`,
    );
  }

  console.log(
    "\nQuedan en draft. Publicar con:\n" +
      '  curl -X POST -H "Authorization: Bearer $ADMIN_API_KEY" \\\n' +
      "    https://<ingest-worker>/admin/eventos/<slug>/publicar",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

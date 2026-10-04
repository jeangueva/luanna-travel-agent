/**
 * Completa `aeropuerto_iata` en las filas que no lo tienen, con la misma
 * verificación por distancia que usa el cron (src/iata.ts). Sin IATA la página
 * del evento no ofrece vuelos, así que esto sirve para los eventos que entraron
 * antes de la migración 0019.
 *
 * Por defecto NO escribe: imprime qué haría. Con --apply actualiza la base.
 *
 *   npx tsx scripts/backfill-iata.ts            # simulación
 *   npx tsx scripts/backfill-iata.ts --apply    # escribe
 *
 * Lo que no se puede verificar queda en null; ese evento se resuelve a mano con
 * PATCH /admin/eventos/<slug>/iata.
 */
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolverIata } from "../src/iata.js";

const aquí = dirname(fileURLToPath(import.meta.url));

function cargarDevVars(): Record<string, string> {
  try {
    const out: Record<string, string> = {};
    for (const linea of readFileSync(join(aquí, "..", ".dev.vars"), "utf8").split("\n")) {
      const m = linea.match(/^([A-Z_]+)=(.*)$/);
      if (m) out[m[1]] = m[2];
    }
    return out;
  } catch {
    return {};
  }
}

async function main() {
  const env = { ...cargarDevVars(), ...process.env } as Record<string, string>;
  if (!env.DATABASE_URL) throw new Error("Falta DATABASE_URL");
  const aplicar = process.argv.includes("--apply");
  const sql = neon(env.DATABASE_URL);

  const filas = (await sql`
    SELECT slug, ciudad_sede, latitud_partida AS lat, longitud_partida AS lon
    FROM eventos_deportivos
    WHERE aeropuerto_iata IS NULL
    ORDER BY fecha_inicio
  `) as Array<{ slug: string; ciudad_sede: string | null; lat: number; lon: number }>;

  console.log(`${filas.length} evento(s) sin IATA${aplicar ? "" : " (simulación, no se escribe)"}`);
  let resueltos = 0;
  for (const f of filas) {
    const iata = await resolverIata({ ciudad_sede: f.ciudad_sede, lat: f.lat, lon: f.lon });
    if (!iata) {
      console.log(`  ✗ ${f.slug}: sin candidato verificable (${f.ciudad_sede ?? "sin ciudad"}) — fijar a mano`);
      continue;
    }
    resueltos++;
    console.log(`  ✓ ${f.slug} → ${iata}`);
    if (aplicar) {
      await sql`UPDATE eventos_deportivos SET aeropuerto_iata = ${iata}, updated_at = NOW() WHERE slug = ${f.slug} AND aeropuerto_iata IS NULL`;
    }
  }
  console.log(`\n${resueltos}/${filas.length} resueltos${aplicar ? " y guardados" : ""}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

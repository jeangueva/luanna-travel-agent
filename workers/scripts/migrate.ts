import { neon } from "@neondatabase/serverless";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

function loadDevVars(): Record<string, string> {
  const path = join(__dirname, "..", ".dev.vars");
  const content = readFileSync(path, "utf8");
  const out: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function main() {
  const env = loadDevVars();
  const url = env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing in .dev.vars");

  const sql = neon(url);
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    const fullPath = join(MIGRATIONS_DIR, file);
    const content = readFileSync(fullPath, "utf8");
    console.log(`Applying ${file}...`);
    const stripComments = (s: string) =>
      s
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim();
    const statements = content
      .split(";")
      .map(stripComments)
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      await sql.query(stmt);
    }
    console.log(`  ✓ ${file}`);
  }
  console.log("All migrations applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

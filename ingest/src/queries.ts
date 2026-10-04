import { CATEGORIAS, type Categoria } from "./types.js";

const TERMINO_BUSQUEDA: Record<Categoria, string> = {
  running: "maraton media maraton 10k carreras",
  trail_running: "trail running ultra carreras de montaña",
  cycling: "gran fondo ciclismo ruta mtb",
  acuatlon: "acuatlon",
  duatlon: "duatlon",
  acuabike: "acuabike",
  triatlon: "triatlon ironman 70.3",
  aguas_abiertas: "natacion aguas abiertas travesia",
};

/**
 * Toda Latinoamérica hispano y lusohablante. Se escribe sin tildes ni eñes
 * porque va directo a la query de Brave.
 */
export const PAISES_LATAM = [
  "peru",
  "chile",
  "colombia",
  "mexico",
  "argentina",
  "brasil",
  "ecuador",
  "uruguay",
  "bolivia",
  "paraguay",
  "costa rica",
  "panama",
  "republica dominicana",
  "guatemala",
];

export interface ConfigQueries {
  categorias: Categoria[];
  paises: string[];
  anos: string[];
  max: number;
}

export interface QueryPlanificada {
  categoria: Categoria;
  pais: string;
  ano: string;
  q: string;
}

function parseLista(valor: string | undefined, porDefecto: string[]): string[] {
  const items = (valor ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return items.length > 0 ? items : porDefecto;
}

export function configDesdeEnv(env: Record<string, string | undefined>): ConfigQueries {
  const categorias = parseLista(env.INGEST_CATEGORIAS, [...CATEGORIAS]).filter(
    (c): c is Categoria => (CATEGORIAS as readonly string[]).includes(c),
  );
  const max = Number.parseInt(env.MAX_QUERIES_POR_CORRIDA ?? "40", 10);
  return {
    categorias: categorias.length > 0 ? categorias : [...CATEGORIAS],
    paises: parseLista(env.INGEST_PAISES, PAISES_LATAM),
    anos: parseLista(env.INGEST_ANOS, [String(new Date().getUTCFullYear())]),
    max: Number.isFinite(max) && max > 0 ? max : 40,
  };
}

/** Semanas desde la época: avanza de a uno cada 7 días, sin depender del año. */
export function semanaDesdeEpoca(ahora: Date = new Date()): number {
  return Math.floor(ahora.getTime() / (7 * 86400000));
}

/**
 * Una query por (año × país × categoría). Con 14 países, 8 categorías y 2 años
 * la matriz son 224 combinaciones, y una corrida cabe en `max` (40): recortar
 * siempre las primeras dejaría los últimos países sin cubrir para siempre.
 * Por eso la ventana de `max` queries rota con `semana`, y en unas 6 corridas
 * se recorre la matriz completa.
 */
export function generarQueries(config: ConfigQueries, semana = 0): QueryPlanificada[] {
  const out: QueryPlanificada[] = [];
  for (const ano of config.anos) {
    for (const pais of config.paises) {
      for (const categoria of config.categorias) {
        out.push({
          categoria,
          pais,
          ano,
          q: `calendario ${TERMINO_BUSQUEDA[categoria]} ${pais} ${ano} fechas rutas oficiales`,
        });
      }
    }
  }
  if (out.length <= config.max) return out;
  const inicio = (((semana * config.max) % out.length) + out.length) % out.length;
  return [...out, ...out].slice(inicio, inicio + config.max);
}

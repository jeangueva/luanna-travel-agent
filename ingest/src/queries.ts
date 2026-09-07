import { CATEGORIAS, type Categoria } from "./types.js";

const TERMINO_BUSQUEDA: Record<Categoria, string> = {
  triatlon: "triatlon",
  aguas_abiertas: "natacion aguas abiertas",
  maraton: "maraton",
  ciclismo: "gran fondo ciclismo ruta",
};

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
    paises: parseLista(env.INGEST_PAISES, ["peru"]),
    anos: parseLista(env.INGEST_ANOS, [String(new Date().getUTCFullYear())]),
    max: Number.isFinite(max) && max > 0 ? max : 40,
  };
}

/**
 * Una query por (categoría × país × año). El orden es categoría-mayor para que
 * el recorte por `max` deje una muestra pareja de países en vez de agotar el
 * presupuesto en el primero de la lista.
 */
export function generarQueries(config: ConfigQueries): QueryPlanificada[] {
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
  return out.slice(0, config.max);
}

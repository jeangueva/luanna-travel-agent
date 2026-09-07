/**
 * Brave Search es la única fuente de texto del pipeline: scrapear las webs de
 * las federaciones directamente se cae por bloqueo de IP, y `extra_snippets`
 * devuelve varios fragmentos largos por resultado — suficiente contexto para
 * que el LLM extraiga fecha y lugar sin visitar la página.
 */
const ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

export interface ResultadoBrave {
  title: string;
  url: string;
  description: string;
  extra_snippets: string[];
}

export class BraveError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "BraveError";
  }
}

interface BravePayload {
  web?: {
    results?: Array<{
      title?: string;
      url?: string;
      description?: string;
      extra_snippets?: string[];
    }>;
  };
}

export async function buscarBrave(
  q: string,
  apiKey: string,
  opts: { count?: number; timeoutMs?: number } = {},
): Promise<ResultadoBrave[]> {
  const url = new URL(ENDPOINT);
  url.searchParams.set("q", q);
  url.searchParams.set("count", String(opts.count ?? 5));
  url.searchParams.set("extra_snippets", "true");
  url.searchParams.set("search_lang", "es");
  url.searchParams.set("country", "PE");

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 15000),
  });

  if (!res.ok) {
    throw new BraveError(
      `Brave respondió ${res.status} para "${q}"`,
      res.status,
    );
  }

  const payload = (await res.json()) as BravePayload;
  return (payload.web?.results ?? []).map((r) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    description: r.description ?? "",
    extra_snippets: r.extra_snippets ?? [],
  }));
}

/**
 * Concatena los resultados en un solo bloque de texto para el LLM. La URL va
 * en cada bloque, no solo en el encabezado: es lo que le permite al modelo
 * devolver `fuente_url` por evento en vez de una sola fuente por corrida.
 */
export function componerContexto(resultados: ResultadoBrave[]): string {
  return resultados
    .map((r, i) => {
      const cuerpo = [r.description, ...r.extra_snippets]
        .filter(Boolean)
        .join("\n");
      return `[${i + 1}] ${r.title}\nFUENTE: ${r.url}\n${cuerpo}`;
    })
    .join("\n\n---\n\n");
}

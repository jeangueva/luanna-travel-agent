import { test } from "node:test";
import assert from "node:assert/strict";
import { slugEvento, slugify } from "../src/slug.js";
import { configDesdeEnv, generarQueries } from "../src/queries.js";
import { validarExtraido } from "../src/validar.js";
import {
  coordenadaPlausible,
  distanciaKm,
  resolverCoordenadas,
  TOLERANCIA_KM,
} from "../src/geocode.js";
import { componerContexto } from "../src/brave.js";
import type { EventoExtraido } from "../src/types.js";

const HOY = "2026-09-06";

const base: EventoExtraido = {
  nombre_oficial: "Reto Olaya Inverso",
  categoria: "aguas_abiertas",
  fecha_inicio: "2026-11-07",
  ciudad_sede: "Lima",
  pais: "Perú",
  lugar_partida: "Playa Agua Dulce, Chorrillos",
  latitud_partida: -12.1745,
  longitud_partida: -77.0221,
  fuente_url: "https://example.org/olaya",
  descripcion: "Travesía de aguas abiertas en la bahía de Lima.",
  badges: ["3.2 km", "wetsuit permitido"],
  confianza: 0.92,
};

test("slugify normaliza acentos, mayúsculas y puntuación", () => {
  assert.equal(slugify("Triatlón Campeonato Nacional"), "triatlon-campeonato-nacional");
  assert.equal(slugify("  ¡Maratón de Lima!  "), "maraton-de-lima");
});

test("el slug es estable entre corridas y no repite el año", () => {
  assert.equal(
    slugEvento("Triatlón Campeonato Nacional", "2026-12-13"),
    "triatlon-campeonato-nacional-2026",
  );
  // Mismo evento escrito distinto por el LLM → mismo slug → UPSERT, no duplicado.
  assert.equal(
    slugEvento("triatlon  campeonato nacional", "2026-12-13"),
    slugEvento("Triatlón Campeonato Nacional", "2026-12-13"),
  );
  assert.equal(
    slugEvento("Reto Olaya Inverso 2026", "2026-11-07"),
    "reto-olaya-inverso-2026",
  );
});

test("generarQueries cubre la matriz y respeta el tope", () => {
  const config = configDesdeEnv({
    INGEST_CATEGORIAS: "triatlon,maraton",
    INGEST_PAISES: "peru,chile",
    INGEST_ANOS: "2026",
    MAX_QUERIES_POR_CORRIDA: "40",
  });
  const queries = generarQueries(config);
  assert.equal(queries.length, 4);
  assert.ok(queries[0].q.includes("calendario triatlon peru 2026"));

  const recortado = generarQueries({ ...config, max: 3 });
  assert.equal(recortado.length, 3);
  // El recorte deja los dos países representados, no dos veces el primero.
  assert.deepEqual(new Set(recortado.map((q) => q.pais)), new Set(["peru", "chile"]));
});

test("configDesdeEnv descarta categorías inventadas", () => {
  const config = configDesdeEnv({ INGEST_CATEGORIAS: "triatlon,parapente" });
  assert.deepEqual(config.categorias, ["triatlon"]);
});

test("validarExtraido acepta un evento completo", () => {
  const r = validarExtraido(base, HOY);
  assert.equal(r.ok, true);
});

test("validarExtraido rechaza fecha no ISO, pasada, y confianza baja", () => {
  for (const [parche, fragmento] of [
    [{ fecha_inicio: "noviembre 2026" }, "no ISO"],
    [{ fecha_inicio: "2026-02-30" }, "inexistente"],
    [{ fecha_inicio: "2026-01-01" }, "pasada"],
    [{ confianza: 0.2 }, "confianza"],
    [{ nombre_oficial: "X" }, "nombre"],
    [{ categoria: "parapente" as never }, "categoría"],
  ] as const) {
    const r = validarExtraido({ ...base, ...parche }, HOY);
    assert.equal(r.ok, false, `debió rechazar ${JSON.stringify(parche)}`);
    if (!r.ok) assert.match(r.rechazo.motivo, new RegExp(fragmento));
  }
});

test("coordenadaPlausible descarta null island y fuera de rango", () => {
  assert.equal(coordenadaPlausible(-12.17, -77.02), true);
  assert.equal(coordenadaPlausible(0, 0), false);
  assert.equal(coordenadaPlausible(91, 10), false);
  assert.equal(coordenadaPlausible(null, -77), false);
});

test("distanciaKm mide en el orden correcto", () => {
  // Lima → Santiago de Chile son ~2450 km.
  const d = distanciaKm({ lat: -12.05, lon: -77.04 }, { lat: -33.45, lon: -70.67 });
  assert.ok(d > 2300 && d < 2600, `distancia inesperada: ${d}`);
});

test("sin token de Mapbox se conserva la coordenada del LLM", async () => {
  const c = await resolverCoordenadas(
    {
      lat: base.latitud_partida,
      lon: base.longitud_partida,
      lugar_partida: base.lugar_partida,
      ciudad_sede: base.ciudad_sede,
      pais: base.pais,
    },
    undefined,
  );
  assert.deepEqual(c, { lat: -12.1745, lon: -77.0221, fuente: "llm" });
});

test("sin coordenadas del LLM y sin Mapbox, no hay evento", async () => {
  const c = await resolverCoordenadas(
    {
      lat: null,
      lon: null,
      lugar_partida: "Playa Agua Dulce",
      ciudad_sede: "Lima",
      pais: "Perú",
    },
    undefined,
  );
  assert.equal(c, null);
});

test("Mapbox gana cuando el LLM se fue de ciudad", async () => {
  const fetchReal = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        features: [{ geometry: { coordinates: [-77.0221, -12.1745] } }],
      }),
    )) as typeof fetch;
  try {
    // El LLM devolvió Santiago de Chile para un evento en Lima.
    const lejos = await resolverCoordenadas(
      {
        lat: -33.45,
        lon: -70.67,
        lugar_partida: "Playa Agua Dulce",
        ciudad_sede: "Lima",
        pais: "Perú",
      },
      "pk.test",
    );
    assert.equal(lejos?.fuente, "mapbox");
    assert.equal(lejos?.lat, -12.1745);

    // Dentro de la tolerancia, el punto fino del LLM se conserva.
    const cerca = await resolverCoordenadas(
      {
        lat: -12.18,
        lon: -77.03,
        lugar_partida: "Playa Agua Dulce",
        ciudad_sede: "Lima",
        pais: "Perú",
      },
      "pk.test",
    );
    assert.equal(cerca?.fuente, "llm");
    assert.ok(
      distanciaKm({ lat: -12.18, lon: -77.03 }, { lat: -12.1745, lon: -77.0221 }) <
        TOLERANCIA_KM,
    );
  } finally {
    globalThis.fetch = fetchReal;
  }
});

test("componerContexto conserva la URL de cada resultado", () => {
  const texto = componerContexto([
    {
      title: "Calendario 2026",
      url: "https://fed.pe/calendario",
      description: "Fechas oficiales",
      extra_snippets: ["Reto Olaya Inverso: 7 de noviembre de 2026"],
    },
  ]);
  assert.match(texto, /FUENTE: https:\/\/fed\.pe\/calendario/);
  assert.match(texto, /7 de noviembre de 2026/);
});

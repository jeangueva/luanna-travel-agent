import { test } from "node:test";
import assert from "node:assert/strict";
import { slugEvento, slugify } from "../src/slug.js";
import {
  configDesdeEnv,
  generarQueries,
  PAISES_LATAM,
  semanaDesdeEpoca,
} from "../src/queries.js";
import { normalizarCosto, normalizarEtiquetas, validarExtraido } from "../src/validar.js";
import { RADIO_KM, resolverIata } from "../src/iata.js";
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
  etiquetas: ["travesia"],
  fecha_inicio: "2026-11-07",
  ciudad_sede: "Lima",
  pais: "Perú",
  lugar_partida: "Playa Agua Dulce, Chorrillos",
  latitud_partida: -12.1745,
  longitud_partida: -77.0221,
  fuente_url: "https://example.org/olaya",
  descripcion: "Travesía de aguas abiertas en la bahía de Lima.",
  badges: ["3.2 km", "wetsuit permitido"],
  costo_min: null,
  costo_max: null,
  moneda: null,
  inscripcion_url: null,
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
    INGEST_CATEGORIAS: "triatlon,running",
    INGEST_PAISES: "peru,chile",
    INGEST_ANOS: "2026",
    MAX_QUERIES_POR_CORRIDA: "40",
  });
  const queries = generarQueries(config);
  assert.equal(queries.length, 4);
  assert.ok(queries[0].q.includes("calendario triatlon ironman 70.3 peru 2026"));

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

test("sin INGEST_PAISES la matriz cubre toda Latinoamérica", () => {
  const config = configDesdeEnv({});
  assert.deepEqual(config.paises, PAISES_LATAM);
  assert.ok(PAISES_LATAM.includes("peru") && PAISES_LATAM.includes("brasil"));
  // Las 8 disciplinas del catálogo, no las 4 del primer PRD.
  assert.equal(config.categorias.length, 8);
});

test("la ventana de queries rota y en pocas corridas cubre toda la matriz", () => {
  const config = configDesdeEnv({ INGEST_ANOS: "2026,2027", MAX_QUERIES_POR_CORRIDA: "40" });
  const total = generarQueries({ ...config, max: 10_000 }).length;
  assert.equal(total, PAISES_LATAM.length * 8 * 2);

  const corridas = Math.ceil(total / config.max);
  const vistas = new Set<string>();
  for (let semana = 0; semana < corridas; semana++) {
    const q = generarQueries(config, semana);
    assert.equal(q.length, config.max, "cada corrida respeta el tope");
    assert.equal(new Set(q.map((x) => x.q)).size, q.length, "sin repetir dentro de la corrida");
    for (const x of q) vistas.add(x.q);
  }
  assert.equal(vistas.size, total, `${corridas} corridas deben cubrir las ${total} combinaciones`);

  // Dos semanas seguidas no son la misma ventana.
  assert.notDeepEqual(generarQueries(config, 1), generarQueries(config, 2));
});

test("semanaDesdeEpoca avanza de a uno cada siete días", () => {
  const a = semanaDesdeEpoca(new Date("2026-10-04T00:00:00Z"));
  assert.equal(semanaDesdeEpoca(new Date("2026-10-11T00:00:00Z")), a + 1);
});

test("las etiquetas se limitan al catálogo y no se repiten", () => {
  assert.deepEqual(normalizarEtiquetas(["maraton", "maraton", "epica", "ultra"]), [
    "maraton",
    "ultra",
  ]);
  assert.deepEqual(normalizarEtiquetas("maraton"), []);
  assert.deepEqual(normalizarEtiquetas(undefined), []);
});

test("el costo sin moneda, negativo o invertido se descarta; el evento no", () => {
  const vacio = { costo_min: null, costo_max: null, moneda: null };
  assert.deepEqual(normalizarCosto(80, 120, null), vacio);
  assert.deepEqual(normalizarCosto(80, 120, "soles"), vacio);
  assert.deepEqual(normalizarCosto(-5, 20, "USD"), vacio);
  assert.deepEqual(normalizarCosto(200, 100, "USD"), vacio);
  assert.deepEqual(normalizarCosto(null, null, "USD"), vacio);
  assert.deepEqual(normalizarCosto(Number.NaN, 50, "USD"), vacio);

  assert.deepEqual(normalizarCosto(80, 120, " pen "), {
    costo_min: 80,
    costo_max: 120,
    moneda: "PEN",
  });
  // Una sola cifra es un precio puntual.
  assert.deepEqual(normalizarCosto(95, null, "USD"), {
    costo_min: 95,
    costo_max: 95,
    moneda: "USD",
  });

  const r = validarExtraido({ ...base, costo_min: 200, costo_max: 100, moneda: "USD" }, HOY);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.evento.costo_min, null);
});

test("validarExtraido acepta las 8 categorías y rechaza las del PRD viejo", () => {
  for (const c of [
    "running",
    "trail_running",
    "cycling",
    "acuatlon",
    "duatlon",
    "acuabike",
    "triatlon",
    "aguas_abiertas",
  ] as const) {
    assert.equal(validarExtraido({ ...base, categoria: c }, HOY).ok, true, c);
  }
  for (const viejo of ["maraton", "ciclismo"]) {
    assert.equal(validarExtraido({ ...base, categoria: viejo as never }, HOY).ok, false, viejo);
  }
});

function autocompleteCon(cuerpo: unknown, ok = true): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(cuerpo), { status: ok ? 200 : 503 })) as unknown as typeof fetch;
}

const LIMA = { ciudad_sede: "Lima", lat: -12.0708, lon: -77.163 };

test("resolverIata acepta la ciudad que queda dentro del radio de la sede", async () => {
  const f = autocompleteCon([
    { type: "city", code: "LIM", coordinates: { lat: -12.0464, lon: -77.0428 } },
  ]);
  assert.equal(await resolverIata(LIMA, f), "LIM");
});

test("resolverIata descarta la homónima de otro país aunque venga primera", async () => {
  // "Lima, Ohio" llega antes que Lima, Perú: sin la distancia, el catálogo
  // vendería vuelos a Ohio en la página de una travesía en el Callao.
  const f = autocompleteCon([
    { type: "city", code: "AOH", coordinates: { lat: 40.7, lon: -84.1 } },
    { type: "city", code: "LIM", coordinates: { lat: -12.0464, lon: -77.0428 } },
  ]);
  assert.equal(await resolverIata(LIMA, f), "LIM");

  const soloOhio = autocompleteCon([
    { type: "city", code: "AOH", coordinates: { lat: 40.7, lon: -84.1 } },
  ]);
  assert.equal(await resolverIata(LIMA, soloOhio), null);
});

test("resolverIata elige la ciudad más cercana entre varias dentro del radio", async () => {
  const f = autocompleteCon([
    { type: "city", code: "XXA", coordinates: { lat: -12.5, lon: -77.4 } },
    { type: "city", code: "LIM", coordinates: { lat: -12.0464, lon: -77.0428 } },
  ]);
  assert.equal(await resolverIata(LIMA, f), "LIM");
  assert.ok(RADIO_KM >= 50);
});

test("resolverIata devuelve null, no una suposición, si no puede verificar", async () => {
  // Sin coordenadas en la respuesta no hay con qué contrastar el candidato.
  assert.equal(
    await resolverIata(LIMA, autocompleteCon([{ type: "city", code: "LIM" }])),
    null,
  );
  assert.equal(await resolverIata(LIMA, autocompleteCon([])), null);
  assert.equal(await resolverIata(LIMA, autocompleteCon({ error: "x" })), null);
  assert.equal(await resolverIata(LIMA, autocompleteCon([], false)), null);
  assert.equal(
    await resolverIata(LIMA, (async () => {
      throw new Error("red caída");
    }) as unknown as typeof fetch),
    null,
  );
  assert.equal(await resolverIata({ ...LIMA, ciudad_sede: null }), null);
  assert.equal(await resolverIata({ ...LIMA, lat: 0, lon: 0 }), null);
  // Un código que no tiene forma de IATA no pasa aunque esté cerca.
  assert.equal(
    await resolverIata(
      LIMA,
      autocompleteCon([{ type: "city", code: "lim1", coordinates: { lat: -12.05, lon: -77.04 } }]),
    ),
    null,
  );
});

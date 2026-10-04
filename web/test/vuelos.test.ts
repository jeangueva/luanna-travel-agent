import { test } from "node:test";
import assert from "node:assert/strict";
import { enlaceBusqueda, buscarPrecioDesde, elegirOferta, ORIGENES, origenSugerido, parametrosDelEvento, validarConsulta, type OfertaTP } from "../src/lib/vuelos.js";
import { manejarVuelos, CACHE_FALLO, CACHE_OK, type DepsVuelos } from "../src/lib/api-vuelos.js";
import { markerConSubId, urlBusquedaVuelos } from "../src/lib/afiliados.js";
import { ETIQUETA_PRECISION, formatoCosto } from "../src/lib/costo.js";
import { esFechaISOValida } from "../src/lib/fechas.js";
import { CATEGORIAS, nombreEtiqueta } from "../src/lib/eventos-types.js";

const FECHA = "2027-03-14"; // domingo de carrera
const oferta = (o: Partial<OfertaTP> & { price: number; departure_at: string }): OfertaTP => ({
  return_at: "2027-03-15T10:00:00-05:00",
  airline: "LA",
  transfers: 1,
  ...o,
});

test("elegirOferta toma la más barata de la ventana, no la más barata del mes", () => {
  const r = elegirOferta(
    [
      oferta({ price: 150, departure_at: "2027-03-02T08:00:00-05:00", return_at: "2027-03-20T08:00:00-05:00" }),
      oferta({ price: 410, departure_at: "2027-03-12T08:00:00-05:00" }),
      oferta({ price: 380, departure_at: "2027-03-11T08:00:00-05:00", return_at: "2027-03-16T08:00:00-05:00" }),
      oferta({ price: 395, departure_at: "2027-03-13T08:00:00-05:00" }),
    ],
    FECHA,
  );
  assert.deepEqual(r, {
    usd: 380,
    aerolinea: "LA",
    salida: "2027-03-11",
    regreso: "2027-03-16",
    escalas: 1,
    aproximado: false,
  });
});

test("elegirOferta no acepta vuelos que llegan el día de la carrera ni que regresan antes", () => {
  assert.equal(
    elegirOferta([oferta({ price: 100, departure_at: "2027-03-14T05:00:00-05:00" })], FECHA),
    null,
    "salir el mismo día no sirve",
  );
  assert.equal(
    elegirOferta(
      [oferta({ price: 100, departure_at: "2027-03-12T05:00:00-05:00", return_at: "2027-03-14T22:00:00-05:00" })],
      FECHA,
    ),
    null,
    "volver el día de la carrera tampoco",
  );
});

test("elegirOferta ignora solo ida, precios inválidos y datos corruptos", () => {
  const r = elegirOferta(
    [
      oferta({ price: 90, departure_at: "2027-03-12T05:00:00-05:00", return_at: null }),
      oferta({ price: 0, departure_at: "2027-03-12T05:00:00-05:00" }),
      oferta({ price: Number.NaN, departure_at: "2027-03-12T05:00:00-05:00" }),
      oferta({ price: -5, departure_at: "2027-03-12T05:00:00-05:00" }),
      { price: 70, departure_at: undefined as unknown as string, return_at: "2027-03-15" },
      oferta({ price: 500, departure_at: "2027-03-12T05:00:00-05:00" }),
    ],
    FECHA,
  );
  assert.equal(r?.usd, 500);
});

test("elegirOferta cae a fechas cercanas y lo marca aproximado", () => {
  const r = elegirOferta(
    [oferta({ price: 300, departure_at: "2027-03-02T05:00:00-05:00", return_at: "2027-03-22T05:00:00-05:00" })],
    FECHA,
  );
  assert.equal(r?.usd, 300);
  assert.equal(r?.aproximado, true);
  assert.equal(
    elegirOferta(
      [oferta({ price: 300, departure_at: "2027-02-01T05:00:00-05:00", return_at: "2027-04-01T05:00:00-05:00" })],
      FECHA,
    ),
    null,
    "un mes antes ya no tiene que ver con la carrera",
  );
  assert.equal(elegirOferta([], FECHA), null);
});

test("la ventana cruza el fin de mes y de año", () => {
  const r = elegirOferta(
    [oferta({ price: 220, departure_at: "2026-12-30T05:00:00-05:00", return_at: "2027-01-03T05:00:00-05:00" })],
    "2027-01-01",
  );
  assert.equal(r?.usd, 220);
  assert.equal(r?.aproximado, false);
});

test("validarConsulta solo admite orígenes del selector y slugs bien formados", () => {
  const q = (s: string) => new URLSearchParams(s);
  assert.deepEqual(validarConsulta(q("origen=lim&evento=maraton-lima-2027")), {
    ok: true,
    origen: "LIM",
    evento: "maraton-lima-2027",
  });
  for (const malo of [
    "origen=XXX&evento=a",
    "origen=LIM",
    "evento=a",
    "origen=LIM&evento=A%20B",
    "origen=LIM&evento=../etc",
    `origen=LIM&evento=${"a".repeat(81)}`,
  ]) {
    assert.equal(validarConsulta(q(malo)).ok, false, malo);
  }
});

test("parametrosDelEvento toma destino y fecha del catálogo y rechaza lo invendible", () => {
  const c = { origen: "BOG", evento: "x" } as const;
  const ev = { aeropuerto_iata: "LIM", fecha_inicio: "2027-03-14" };
  const ok = parametrosDelEvento(c, ev, "2027-01-01");
  assert.deepEqual(ok, { ok: true, valor: { origen: "BOG", destino: "LIM", fecha: "2027-03-14", evento: "x" } });

  assert.equal(parametrosDelEvento(c, { ...ev, aeropuerto_iata: null }, "2027-01-01").ok, false);
  assert.equal(parametrosDelEvento(c, ev, "2027-03-14").ok, false, "el día del evento ya no se vende");
  assert.equal(parametrosDelEvento(c, ev, "2027-04-01").ok, false);
  assert.equal(parametrosDelEvento({ ...c, origen: "LIM" }, ev, "2027-01-01").ok, false, "origen = destino");
  assert.equal(parametrosDelEvento(c, { ...ev, fecha_inicio: "2027-02-30" }, "2027-01-01").ok, false);
});

test("origenSugerido traduce el país de Cloudflare y no adivina fuera de la lista", () => {
  assert.equal(origenSugerido("PE"), "LIM");
  assert.equal(origenSugerido("pe"), "LIM");
  assert.equal(origenSugerido("AR"), "BUE");
  assert.equal(origenSugerido("JP"), null);
  assert.equal(origenSugerido(null), null);
  assert.equal(origenSugerido(""), null);
  // Cada código del selector es de ciudad/metro y único.
  assert.equal(new Set(ORIGENES.map((o) => o.iata)).size, ORIGENES.length);
  for (const o of ORIGENES) assert.match(o.iata, /^[A-Z]{3}$/);
});

test("el enlace de búsqueda lleva ruta DDMM, marker y sub-id del evento", () => {
  const url = new URL(
    urlBusquedaVuelos({
      origen: "BOG",
      destino: "LIM",
      salida: "2027-03-12",
      regreso: "2027-03-15",
      pasajeros: 1,
      marker: "12345",
      subId: "ev-maraton-lima-2027",
    }),
  );
  assert.equal(url.origin, "https://www.aviasales.com");
  assert.equal(url.pathname, "/search/BOG1203LIM15031");
  assert.equal(url.searchParams.get("marker"), "12345.ev-maraton-lima-2027");

  // Fechas opcionales: la ruta "BOGLIM1" también resuelve en Aviasales.
  assert.equal(
    new URL(urlBusquedaVuelos({ origen: "BOG", destino: "LIM", marker: "1" })).pathname,
    "/search/BOGLIM1",
  );
  // Un sub-id con caracteres raros no rompe el marker.
  assert.equal(markerConSubId("1", "a b&c=d"), "1.abcd");
  assert.equal(markerConSubId("1", ""), "1");

  const sinPrecio = new URL(
    enlaceBusqueda({ origen: "BOG", destino: "LIM", fecha: "2027-03-14", evento: "e" }, "9", null),
  );
  assert.equal(sinPrecio.pathname, "/search/BOG1203LIM15031", "víspera de dos días y regreso al día siguiente");
});

type Llamada = { url: URL; token: string | null };
function fetchSimulado(respuestas: Array<unknown | Error | number>, llamadas: Llamada[] = []): typeof fetch {
  let i = 0;
  return (async (input: URL | string, init?: RequestInit) => {
    llamadas.push({
      url: new URL(String(input)),
      token: new Headers(init?.headers).get("x-access-token"),
    });
    const r = respuestas[Math.min(i++, respuestas.length - 1)];
    if (r instanceof Error) throw r;
    if (typeof r === "number") return new Response("x", { status: r });
    return new Response(JSON.stringify(r), { status: 200 });
  }) as unknown as typeof fetch;
}
const ARGS = { origen: "BOG", destino: "LIM", fecha: FECHA, evento: "e" } as const;

test("buscarPrecioDesde hace una sola consulta si la ventana cae en un mes", async () => {
  const llamadas: Llamada[] = [];
  const f = fetchSimulado(
    [{ data: [oferta({ price: 333, departure_at: "2027-03-17T05:00:00-05:00", return_at: "2027-03-22T05:00:00-05:00" })] }],
    llamadas,
  );
  // Carrera el 20: salir entre el 6 y el 19 de marzo, todo el mismo mes.
  const r = await buscarPrecioDesde({ ...ARGS, fecha: "2027-03-20" }, "TOKEN", f);
  assert.equal(r.precio?.usd, 333);
  assert.equal(r.fallo, false);
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].url.searchParams.get("departure_at"), "2027-03");
});

test("buscarPrecioDesde hace dos consultas cuando la ventana cruza de mes", async () => {
  const llamadas: Llamada[] = [];
  const f = fetchSimulado([{ data: [] }], llamadas);
  // Carrera el 3 de marzo: se puede salir a fines de febrero.
  await buscarPrecioDesde({ ...ARGS, fecha: "2027-03-03" }, "TOKEN", f);
  assert.deepEqual(
    llamadas.map((l) => l.url.searchParams.get("departure_at")).sort(),
    ["2027-02", "2027-03"],
  );
  for (const l of llamadas) {
    assert.equal(l.token, "TOKEN");
    assert.equal(l.url.hostname, "api.travelpayouts.com");
    assert.equal(l.url.searchParams.get("origin"), "BOG");
    assert.equal(l.url.searchParams.get("destination"), "LIM");
    assert.equal(l.url.searchParams.get("one_way"), "false");
    assert.equal(l.url.searchParams.get("currency"), "usd");
  }
});

test("un fallo del upstream se distingue de 'no hay precios'", async () => {
  const vacio = await buscarPrecioDesde(ARGS, "T", fetchSimulado([{ data: [] }]));
  assert.deepEqual(vacio, { precio: null, fallo: false });

  for (const malo of [503, 429, new Error("timeout"), { sin: "data" }]) {
    const r = await buscarPrecioDesde(ARGS, "T", fetchSimulado([malo]));
    assert.deepEqual(r, { precio: null, fallo: true }, String(malo));
  }

  // Si una mitad responde y la otra falla, se usa lo que llegó pero se marca.
  const mitad = await buscarPrecioDesde(
    { ...ARGS, fecha: "2027-03-03" },
    "T",
    fetchSimulado([
      { data: [oferta({ price: 250, departure_at: "2027-02-28T05:00:00-05:00", return_at: "2027-03-05T05:00:00-05:00" })] },
      503,
    ]),
  );
  assert.equal(mitad.precio?.usd, 250);
  assert.equal(mitad.fallo, true);
});

function deps(parche: Partial<DepsVuelos> = {}): DepsVuelos {
  return {
    marker: "9999",
    token: "T",
    hoy: () => "2027-01-01",
    obtenerEvento: async () => ({ aeropuerto_iata: "LIM", fecha_inicio: FECHA }),
    buscarPrecio: async () => ({
      precio: { usd: 310, aerolinea: "LA", salida: "2027-03-12", regreso: "2027-03-15", escalas: 0, aproximado: false },
      fallo: false,
    }),
    ...parche,
  };
}
const pedir = (qs: string) => new Request(`https://luanna.app/api/vuelos?${qs}`);

test("/api/vuelos responde precio y enlace, cacheable una hora", async () => {
  const res = await manejarVuelos(pedir("evento=maraton-lima-2027&origen=BOG"), deps());
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), CACHE_OK);
  const j = (await res.json()) as { origen: string; destino: string; precio: { usd: number }; url: string };
  assert.equal(j.destino, "LIM");
  assert.equal(j.precio.usd, 310);
  const u = new URL(j.url);
  assert.equal(u.pathname, "/search/BOG1203LIM15031");
  assert.equal(u.searchParams.get("marker"), "9999.ev-maraton-lima-2027");
});

test("/api/vuelos nunca consulta el upstream con parámetros que no vienen del catálogo", async () => {
  let consultas = 0;
  const d = deps({
    buscarPrecio: async () => {
      consultas++;
      return { precio: null, fallo: false };
    },
  });
  // destino y fecha por query string se ignoran: no hay forma de variarlos.
  const res = await manejarVuelos(pedir("evento=e&origen=BOG&destino=JFK&fecha=2027-06-01"), d);
  const j = (await res.json()) as { destino: string };
  assert.equal(j.destino, "LIM");
  assert.equal(consultas, 1);

  for (const [qs, status] of [
    ["origen=BOG", 400],
    ["evento=e&origen=ZZZ", 400],
    ["evento=E%20X&origen=BOG", 400],
  ] as const) {
    const r = await manejarVuelos(pedir(qs), d);
    assert.equal(r.status, status, qs);
  }
  assert.equal(consultas, 1, "las consultas inválidas no llegaron al upstream");
});

test("/api/vuelos: evento inexistente, sin IATA, pasado u origen = destino", async () => {
  assert.equal((await manejarVuelos(pedir("evento=e&origen=BOG"), deps({ obtenerEvento: async () => null }))).status, 404);
  assert.equal(
    (await manejarVuelos(pedir("evento=e&origen=BOG"), deps({ obtenerEvento: async () => ({ aeropuerto_iata: null, fecha_inicio: FECHA }) }))).status,
    422,
  );
  assert.equal((await manejarVuelos(pedir("evento=e&origen=BOG"), deps({ hoy: () => "2027-03-14" }))).status, 422);
  assert.equal((await manejarVuelos(pedir("evento=e&origen=LIM"), deps())).status, 422);
});

test("/api/vuelos sin marker responde 503; sin token sigue ofreciendo la búsqueda", async () => {
  assert.equal((await manejarVuelos(pedir("evento=e&origen=BOG"), deps({ marker: "" }))).status, 503);

  let llamado = false;
  const res = await manejarVuelos(
    pedir("evento=e&origen=BOG"),
    deps({
      token: "",
      buscarPrecio: async () => {
        llamado = true;
        return { precio: null, fallo: false };
      },
    }),
  );
  assert.equal(llamado, false);
  const j = (await res.json()) as { precio: unknown; url: string };
  assert.equal(j.precio, null);
  assert.match(j.url, /aviasales\.com\/search\/BOG\d{4}LIM\d{4}1\?marker=9999\.ev-e$/);
});

test("un fallo del upstream se cachea un minuto, no una hora", async () => {
  const res = await manejarVuelos(
    pedir("evento=e&origen=BOG"),
    deps({ buscarPrecio: async () => ({ precio: null, fallo: true }) }),
  );
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), CACHE_FALLO);
});

test("formatoCosto usa código ISO y no inventa lo que no hay", () => {
  assert.equal(formatoCosto(60, 120, "PEN"), "PEN 60–120");
  assert.equal(formatoCosto(95, 95, "USD"), "USD 95");
  assert.equal(formatoCosto(45.5, 45.5, "USD"), "USD 45,5");
  assert.equal(formatoCosto(null, null, "USD"), null);
  assert.equal(formatoCosto(60, 120, null), null);
  assert.equal(
    formatoCosto(1200, 1500, "MXN"),
    `MXN ${(1200).toLocaleString("es")}–${(1500).toLocaleString("es")}`,
  );
  assert.deepEqual(Object.keys(ETIQUETA_PRECISION).sort(), ["aproximada", "por_confirmar"]);
});

test("catálogo: 8 categorías y etiquetas legibles", () => {
  assert.equal(CATEGORIAS.length, 8);
  assert.equal(nombreEtiqueta("ironman_70_3"), "Ironman 70.3");
  assert.equal(nombreEtiqueta("super_sprint"), "Super sprint");
  assert.equal(nombreEtiqueta("etiqueta_nueva"), "Etiqueta nueva");
  assert.equal(esFechaISOValida("2027-02-29"), false);
  assert.equal(esFechaISOValida("2028-02-29"), true);
});

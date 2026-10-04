import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aFechaLocal,
  diasFaltantes,
  fechaCorta,
  fechaLarga,
  sumarDias,
} from "../src/lib/fechas.js";
import {
  urlHotelesFallback,
  urlStay22,
  ventanaEstadia,
} from "../src/lib/afiliados.js";
import { tramosDelEvento } from "../src/lib/tramos.js";
import { aFechaISO } from "../src/lib/eventos.js";
import type { Evento } from "../src/lib/eventos-types.js";

const evento: Evento = {
  id: "1",
  slug: "reto-olaya-inverso-2026",
  nombre_oficial: "Reto Olaya Inverso",
  categoria: "aguas_abiertas",
  etiquetas: [],
  fecha_inicio: "2026-11-07",
  fecha_fin: null,
  fecha_precision: "exacta",
  ciudad_sede: "Lima",
  pais: "Perú",
  aeropuerto_iata: "LIM",
  latitud_partida: -12.1745,
  longitud_partida: -77.0221,
  ruta_gpx_url: null,
  clima_proyectado: null,
  fuente_url: null,
  descripcion: null,
  badges: [],
  tramos: [],
  costo_min: null,
  costo_max: null,
  moneda: null,
  inscripcion_url: null,
};

test("la fecha se interpreta en calendario local, no en UTC", () => {
  // Con `new Date("2026-11-07")` esto daría 6 en cualquier zona al oeste de
  // Greenwich: la carrera aparecería un día antes de lo que es.
  const d = aFechaLocal("2026-11-07");
  assert.equal(d.getDate(), 7);
  assert.equal(d.getMonth(), 10);
  assert.equal(fechaLarga("2026-11-07"), "7 de noviembre de 2026");
  assert.equal(fechaCorta("2026-12-13"), "13 dic 2026");
});

test("sumarDias cruza fin de mes y de año sin pasar por UTC", () => {
  assert.equal(sumarDias("2026-11-07", -1), "2026-11-06");
  assert.equal(sumarDias("2026-03-01", -1), "2026-02-28");
  assert.equal(sumarDias("2026-12-31", 1), "2027-01-01");
  assert.equal(sumarDias("2028-03-01", -1), "2028-02-29");
});

test("diasFaltantes cuenta días de calendario", () => {
  assert.equal(diasFaltantes("2026-11-07", new Date(2026, 10, 5, 23, 59)), 2);
  assert.equal(diasFaltantes("2026-11-07", new Date(2026, 10, 7, 6, 0)), 0);
  assert.equal(diasFaltantes("2026-11-07", new Date(2026, 10, 8)), -1);
});

test("la ventana de estadía cubre víspera y recuperación", () => {
  assert.deepEqual(ventanaEstadia("2026-11-07"), {
    checkin: "2026-11-06",
    checkout: "2026-11-08",
  });
});

test("Stay22 se ancla en la coordenada de partida, no en la ciudad", () => {
  const url = new URL(
    urlStay22({
      aid: "luanna",
      lat: -12.1745,
      lng: -77.0221,
      checkin: "2026-11-06",
      checkout: "2026-11-08",
      titulo: "Reto Olaya Inverso",
    }),
  );
  assert.equal(url.origin + url.pathname, "https://www.stay22.com/embed/gm");
  assert.equal(url.searchParams.get("aid"), "luanna");
  assert.equal(url.searchParams.get("lat"), "-12.1745");
  assert.equal(url.searchParams.get("lng"), "-77.0221");
  assert.equal(url.searchParams.get("checkin"), "2026-11-06");
});

test("el enlace de hoteles de respaldo lleva el marker de afiliado", () => {
  const url = new URL(
    urlHotelesFallback({
      marker: "12345",
      ciudad: "Lima",
      checkin: "2026-11-06",
      checkout: "2026-11-08",
    }),
  );
  assert.equal(url.origin + url.pathname, "https://tp.media/r");
  assert.equal(url.searchParams.get("marker"), "12345");
  assert.equal(url.searchParams.get("p"), "4115");
  const inner = new URL(url.searchParams.get("u")!);
  assert.equal(inner.searchParams.get("destination"), "Lima");
  assert.equal(inner.searchParams.get("checkIn"), "2026-11-06");
});

test("un evento de una disciplina obtiene su tramo con el color correcto", () => {
  assert.deepEqual(tramosDelEvento(evento), []);

  assert.deepEqual(
    tramosDelEvento({ ...evento, ruta_gpx_url: "https://x/r.gpx" }),
    [{ tipo: "natacion", nombre: "Recorrido", gpx_url: "https://x/r.gpx" }],
  );
  assert.equal(
    tramosDelEvento({
      ...evento,
      categoria: "cycling",
      ruta_gpx_url: "https://x/r.gpx",
    })[0].tipo,
    "ciclismo",
  );
  assert.equal(
    tramosDelEvento({
      ...evento,
      categoria: "running",
      ruta_gpx_url: "https://x/r.gpx",
    })[0].tipo,
    "carrera",
  );
});

test("los tramos explícitos del triatlón ganan sobre la ruta única", () => {
  const triatlon: Evento = {
    ...evento,
    categoria: "triatlon",
    ruta_gpx_url: "https://x/principal.gpx",
    tramos: [
      { tipo: "natacion", nombre: "Natación 1.5K", gpx_url: "https://x/nat.gpx" },
      { tipo: "ciclismo", nombre: "Ciclismo 40K", gpx_url: "https://x/bici.gpx" },
      { tipo: "carrera", nombre: "Carrera 10K", gpx_url: "https://x/run.gpx" },
    ],
  };
  assert.equal(tramosDelEvento(triatlon).length, 3);
});

test("los tramos se ordenan natación → ciclismo → carrera, no como vinieron", () => {
  const desordenado: Evento = {
    ...evento,
    categoria: "triatlon",
    tramos: [
      { tipo: "carrera", nombre: "Carrera 10K", gpx_url: "https://x/run.gpx" },
      { tipo: "t2", nombre: "T2", gpx_url: "https://x/t2.gpx" },
      { tipo: "natacion", nombre: "Natación 1.5K", gpx_url: "https://x/nat.gpx" },
      { tipo: "ciclismo", nombre: "Ciclismo 40K", gpx_url: "https://x/bici.gpx" },
      { tipo: "t1", nombre: "T1", gpx_url: "https://x/t1.gpx" },
    ],
  };
  assert.deepEqual(
    tramosDelEvento(desordenado).map((t) => t.tipo),
    ["natacion", "t1", "ciclismo", "t2", "carrera"],
  );
});

test("una columna DATE que llega como Date se normaliza a ISO", () => {
  // Lo que devuelve el driver de Neon sin el cast a texto. `String(...)` sobre
  // esto da "Fri Nov 07 2026 …", y su slice(0,10) es basura.
  assert.equal(aFechaISO(new Date(2026, 10, 7)), "2026-11-07");
  assert.equal(aFechaISO("2026-11-07"), "2026-11-07");
  assert.equal(aFechaISO("2026-11-07T05:00:00.000Z"), "2026-11-07");
});

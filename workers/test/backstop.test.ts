import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { detectStaleReprint } from "../src/index";

const withTools = (...names: string[]) => ({
  steps: [{ toolCalls: names.map((toolName) => ({ toolName })) }],
});

describe("detectStaleReprint", () => {
  test("flight ask + prices + no search → force search_flights", () => {
    assert.equal(
      detectStaleReprint("busca vuelos de Lima a Cusco", {
        text: "El más barato: $264 Viva Air 21 ene",
        ...withTools(),
      }),
      "search_flights",
    );
  });

  test("flight ask + no-availability claim + no search → force search_flights", () => {
    assert.equal(
      detectStaleReprint("vuelos a San Andrés en enero", {
        text: "No hay precios en cache para enero 😅",
        ...withTools(),
      }),
      "search_flights",
    );
  });

  test("flight ask + PAST-TENSE accented 'No encontré' + no search → force search_flights (DeepSeek regression)", () => {
    // \w is ASCII-only in JS regex — "encontr\w+" silently never matched
    // "encontré". Found live: DeepSeek wrote "No encontré vuelos de LATAM
    // para Lima → Madrid" and promised a link it never wrote, and this
    // exact phrasing sailed through undetected because of the accent gap.
    assert.equal(
      detectStaleReprint("vuelos solo de LATAM de Lima a Madrid", {
        text: "No encontré vuelos de LATAM para Lima → Madrid el 15 de septiembre 😅 Pero igual te dejé el link directo.",
        ...withTools(),
      }),
      "search_flights",
    );
  });

  test("flight ask + irregular stem-changed 'No encuentro' + no search → force search_flights", () => {
    // "encontrar" is irregular: present tense diphthongizes to "encuentro",
    // a different stem than "encontr-" (infinitive/preterite/encontramos).
    assert.equal(
      detectStaleReprint("vuelos a Asunción", {
        text: "No encuentro vuelos LIM → Asunción en los próximos 6 meses, Jean 😅",
        ...withTools(),
      }),
      "search_flights",
    );
  });

  test("search_flights ran → no retry", () => {
    assert.equal(
      detectStaleReprint("busca vuelos a Cusco", {
        text: "El más barato: $59",
        ...withTools("search_flights"),
      }),
      null,
    );
  });

  test("clarifying question (no prices, no claim) → no retry", () => {
    assert.equal(
      detectStaleReprint("busca vuelos baratos", {
        text: "¿Desde qué ciudad sales y a dónde quieres ir? ✈️",
        ...withTools(),
      }),
      null,
    );
  });

  test("hotel ask + prices + no search → force search_hotels", () => {
    assert.equal(
      detectStaleReprint("hoteles en Cusco del 9 al 12", {
        text: "Ronda entre $60-150 la noche 🏨",
        ...withTools(),
      }),
      "search_hotels",
    );
  });

  test("airbnb wording routes to search_stays", () => {
    assert.equal(
      detectStaleReprint("busca un airbnb en Cusco", {
        text: "Hay depas desde $40 la noche",
        ...withTools(),
      }),
      "search_stays",
    );
  });

  test("hotel ask satisfied by search_stays → no retry", () => {
    assert.equal(
      detectStaleReprint("alojamiento en Cusco", {
        text: "Encontré opciones desde $50",
        ...withTools("search_stays"),
      }),
      null,
    );
  });

  test("combined ask: flights ran, hotels didn't → force search_hotels", () => {
    assert.equal(
      detectStaleReprint("vuelo y hotel a Cusco", {
        text: "Vuelo $59 y hoteles desde $60",
        ...withTools("search_flights"),
      }),
      "search_hotels",
    );
  });

  test("combined ask + reply promises links + get_package_link never ran → force get_package_link (Bogotá bug)", () => {
    assert.equal(
      detectStaleReprint("necesito vuelo y hotel para Bogotá del 10 al 14 de octubre", {
        text: "Para confirmar precios reales necesitas abrir los links — ahí eliges vuelo + hotel juntos ✅",
        ...withTools(),
      }),
      "get_package_link",
    );
  });

  test("explicit 'paquete' word + link mention + tool never ran → force get_package_link", () => {
    assert.equal(
      detectStaleReprint("arma un paquete a Cancún", {
        text: "Aquí tienes los links del paquete completo",
        ...withTools(),
      }),
      "get_package_link",
    );
  });

  test("get_package_link ran → no retry even if reply mentions links", () => {
    assert.equal(
      detectStaleReprint("vuelo y hotel a Bogotá", {
        text: "Aquí los links: ...",
        ...withTools("get_package_link"),
      }),
      null,
    );
  });

  test("reply already has a real /r/ link → no retry (nothing to force)", () => {
    assert.equal(
      detectStaleReprint("vuelo y hotel a Bogotá", {
        text: "Aquí el link: https://luanna.app/r/AbC123",
        ...withTools(),
      }),
      null,
    );
  });

  test("only flight intent (no lodging, no 'paquete') + link mention → no package trigger", () => {
    assert.equal(
      detectStaleReprint("vuelos a Bogotá", {
        text: "Te paso el link en un momento",
        ...withTools(),
      }),
      null,
    );
  });

  test("non-travel message with prices → no retry", () => {
    assert.equal(
      detectStaleReprint("cuánto es 100 dólares en soles", {
        text: "$100 son S/375 aprox",
        ...withTools(),
      }),
      null,
    );
  });
});

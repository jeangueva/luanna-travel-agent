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

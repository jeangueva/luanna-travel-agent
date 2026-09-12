import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  formatFlightSearchFallback,
  formatFlightTeaser,
} from "../src/tools";

describe("formatFlightTeaser", () => {
  test("full teaser: route, both currencies, date, stops, link, wait line", () => {
    const s = formatFlightTeaser({
      originIata: "LIM",
      destIata: "CUZ",
      priceUsd: 67,
      priceLocal: { amount: 252, symbol: "S/" },
      airline: "LATAM",
      departureAt: "2026-09-07T08:15:00-05:00",
      returnAt: "2026-09-14T08:15:00-05:00",
      transfers: 0,
      link: "https://luanna.app/r/AbC123",
    });
    assert.match(s, /LIM → CUZ/);
    assert.match(s, /\*\$67\* \(~S\/252\)/);
    assert.match(s, /LATAM \| 7 sep, directo/);
    assert.match(s, /https:\/\/luanna\.app\/r\/AbC123/);
    assert.match(s, /unos segundos/);
  });

  test("no local currency → USD only; stops pluralized", () => {
    const s = formatFlightTeaser({
      originIata: "LIM",
      destIata: "NRT",
      priceUsd: 684,
      airline: "JAL",
      departureAt: "2026-10-15",
      returnAt: "2026-10-22",
      transfers: 2,
      link: null,
    });
    assert.match(s, /\*\$684\* \| JAL/);
    assert.ok(!s.includes("(~"));
    assert.match(s, /2 escalas/);
    assert.ok(!s.includes("null"));
  });

  test("unparseable date falls back to the raw YYYY-MM-DD", () => {
    const s = formatFlightTeaser({
      originIata: "LIM",
      destIata: "MAD",
      priceUsd: 455,
      airline: "IB",
      departureAt: "fecha-rara",
      returnAt: null,
      transfers: 1,
      link: null,
    });
    assert.match(s, /1 escala\b/);
    assert.match(s, /fecha-rara/);
  });

  test("returnAt present → explicitly labeled '(ida y vuelta)', never left implicit", () => {
    const s = formatFlightTeaser({
      originIata: "LIM",
      destIata: "CUZ",
      priceUsd: 67,
      airline: "LATAM",
      departureAt: "2026-09-07",
      returnAt: "2026-09-14",
      transfers: 0,
      link: null,
    });
    assert.match(s, /\(ida y vuelta\)/);
    assert.ok(!s.includes("(solo ida)"));
  });

  test("returnAt null → explicitly labeled '(solo ida)', never left implicit", () => {
    const s = formatFlightTeaser({
      originIata: "LIM",
      destIata: "CUZ",
      priceUsd: 67,
      airline: "LATAM",
      departureAt: "2026-09-07",
      returnAt: null,
      transfers: 0,
      link: null,
    });
    assert.match(s, /\(solo ida\)/);
    assert.ok(!s.includes("(ida y vuelta)"));
  });
});

describe("formatFlightSearchFallback", () => {
  test("renders route, trip type, dates, group size and actionable URL", () => {
    const s = formatFlightSearchFallback({
      originIata: "LIM",
      destIata: "MAD",
      departureWindow: "2026-10-12",
      returnDate: "2026-10-25",
      oneWay: false,
      passengers: 2,
      searchUrl: "https://luanna.app/r/Live12",
      reason: "no_cached_prices",
    });
    assert.match(s, /LIM → MAD/);
    assert.match(s, /ida y vuelta/);
    assert.match(s, /sale 12 oct 2026/);
    assert.match(s, /vuelve 25 oct 2026/);
    assert.match(s, /2 pasajeros/);
    assert.match(s, /https:\/\/luanna\.app\/r\/Live12/);
    assert.ok(!s.includes("cache"));
    assert.ok(!s.includes("error"));
  });

  test("CTA body omits URL while retaining a flexible one-way summary", () => {
    const s = formatFlightSearchFallback(
      {
        originIata: "LIM",
        destIata: "CUZ",
        departureWindow: null,
        returnDate: null,
        oneWay: true,
        passengers: 1,
        searchUrl: "https://luanna.app/r/Live34",
        reason: "upstream_timeout",
      },
      { omitLink: true },
    );
    assert.match(s, /solo ida/);
    assert.match(s, /fechas flexibles/);
    assert.ok(!s.includes("https://"));
  });
});

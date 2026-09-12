import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { ModelMessage } from "ai";
import { classifyHotelOpportunity } from "../src/cron";
import type { Sql } from "../src/db";
import {
  isValidHotelStayRange,
  makeAddHotelWatchlistTool,
} from "../src/tools";

const baseline = (
  observations: number,
  average: number,
  minimum: number,
) => ({
  observations,
  avg_price_usd: average,
  min_price_usd: minimum,
});

describe("classifyHotelOpportunity", () => {
  test("prioritizes the first crossing of a nightly budget", () => {
    assert.deepEqual(
      classifyHotelOpportunity({
        currentPricePerNightUsd: 78,
        maxPricePerNightUsd: 80,
        marketBaseline: baseline(5, 95, 82),
        watchlistBaseline: baseline(2, 90, 85),
        hasNotified: true,
        dropCooldownSatisfied: true,
      }),
      { kind: "target", pctBelowAverage: null },
    );
  });

  test("does not repeat a budget alert once that target was already observed", () => {
    assert.deepEqual(
      classifyHotelOpportunity({
        currentPricePerNightUsd: 79,
        maxPricePerNightUsd: 80,
        marketBaseline: baseline(2, 82, 78),
        watchlistBaseline: baseline(2, 79, 78),
        hasNotified: true,
        dropCooldownSatisfied: true,
      }),
      { kind: "none", pctBelowAverage: null },
    );
  });

  test("sends one activation message when no budget was supplied", () => {
    assert.deepEqual(
      classifyHotelOpportunity({
        currentPricePerNightUsd: 120,
        maxPricePerNightUsd: 999_999,
        marketBaseline: null,
        watchlistBaseline: null,
        hasNotified: false,
        dropCooldownSatisfied: true,
      }),
      { kind: "activation", pctBelowAverage: null },
    );
  });

  test("explains a real drop of at least ten percent", () => {
    assert.deepEqual(
      classifyHotelOpportunity({
        currentPricePerNightUsd: 89,
        maxPricePerNightUsd: 999_999,
        marketBaseline: baseline(4, 100, 94),
        watchlistBaseline: baseline(2, 98, 95),
        hasNotified: true,
        dropCooldownSatisfied: true,
      }),
      { kind: "drop", pctBelowAverage: 11 },
    );
  });

  test("stays quiet for a small move or a thin baseline", () => {
    assert.equal(
      classifyHotelOpportunity({
        currentPricePerNightUsd: 91,
        maxPricePerNightUsd: 999_999,
        marketBaseline: baseline(5, 100, 90),
        watchlistBaseline: null,
        hasNotified: true,
        dropCooldownSatisfied: true,
      }).kind,
      "none",
    );
    assert.equal(
      classifyHotelOpportunity({
        currentPricePerNightUsd: 80,
        maxPricePerNightUsd: 999_999,
        marketBaseline: baseline(2, 100, 90),
        watchlistBaseline: null,
        hasNotified: true,
        dropCooldownSatisfied: true,
      }).kind,
      "none",
    );
  });

  test("respects a three-day cooldown for repeated drop messages", () => {
    assert.equal(
      classifyHotelOpportunity({
        currentPricePerNightUsd: 80,
        maxPricePerNightUsd: 999_999,
        marketBaseline: baseline(5, 100, 90),
        watchlistBaseline: baseline(2, 95, 90),
        hasNotified: true,
        dropCooldownSatisfied: false,
      }).kind,
      "none",
    );
  });
});

describe("hotel watchlist creation", () => {
  test("validates exact, non-past stay dates", () => {
    assert.equal(
      isValidHotelStayRange("2026-08-10", "2026-08-13", "2026-07-31"),
      true,
    );
    assert.equal(
      isValidHotelStayRange("2026-02-30", "2026-03-02", "2026-01-01"),
      false,
    );
    assert.equal(
      isValidHotelStayRange("2026-07-30", "2026-08-02", "2026-07-31"),
      false,
    );
    assert.equal(
      isValidHotelStayRange("2026-08-10", "2026-08-10", "2026-07-31"),
      false,
    );
  });

  test("persists a hotel alert independently from flight route fields", async () => {
    const calls: Array<{ text: string; values: unknown[] }> = [];
    const sql = (async (
      strings: TemplateStringsArray,
      ...values: unknown[]
    ) => {
      calls.push({ text: strings.join("?"), values });
      return [{ id: 41 }];
    }) as unknown as Sql;
    const checkin = new Date(Date.now() + 10 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const checkout = new Date(Date.now() + 13 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const alertTool = makeAddHotelWatchlistTool({ sql, userId: 7 });
    assert.ok(alertTool.execute);

    const output = await alertTool.execute(
      {
        city: " Cusco ",
        checkin,
        checkout,
        adults: 2,
        max_price_per_night_usd: 80,
      },
      { toolCallId: "hotel-alert", messages: [] as ModelMessage[] },
    );

    assert.equal(output.ok, true);
    assert.equal(output.id, 41);
    assert.equal(calls.length, 1);
    assert.match(calls[0].text, /INSERT INTO watchlist/);
    assert.deepEqual(calls[0].values, [
      7,
      "hotel",
      "Cusco",
      null,
      null,
      checkin,
      checkout,
      2,
      80,
      "USD",
      1,
    ]);
  });

  test("rejects an invalid range without writing", async () => {
    let writes = 0;
    const sql = (async () => {
      writes += 1;
      return [{ id: 1 }];
    }) as unknown as Sql;
    const checkin = new Date(Date.now() + 10 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const checkout = new Date(Date.now() + 5 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const alertTool = makeAddHotelWatchlistTool({ sql, userId: 7 });
    assert.ok(alertTool.execute);

    const output = await alertTool.execute(
      { city: "Cusco", checkin, checkout, adults: 2 },
      { toolCallId: "hotel-alert-invalid", messages: [] as ModelMessage[] },
    );

    assert.equal(output.ok, false);
    assert.equal(writes, 0);
  });
});

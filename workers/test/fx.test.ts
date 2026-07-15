import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { __resetFxCache, resolveLocalFx, usdToLocal } from "../src/fx";

const realFetch = globalThis.fetch;

function mockRates(rates: Record<string, number>): void {
  globalThis.fetch = (async () =>
    Response.json({ result: "success", rates })) as typeof fetch;
}

beforeEach(() => __resetFxCache());
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("resolveLocalFx", () => {
  test("Peru phone → PEN with live rate", async () => {
    mockRates({ PEN: 3.61 });
    const fx = await resolveLocalFx("+51987654321");
    assert.equal(fx?.code, "PEN");
    assert.equal(fx?.symbol, "S/");
    assert.equal(fx?.rate, 3.61);
    assert.equal(usdToLocal(48, fx!), 173);
  });

  test("Mexico phone → MXN", async () => {
    mockRates({ MXN: 18.2 });
    const fx = await resolveLocalFx("5215512345678");
    assert.equal(fx?.code, "MXN");
    assert.equal(fx?.symbol, "MX$");
  });

  test("Bolivia (591) wins over Brazil (55) by longest-prefix", async () => {
    mockRates({ BOB: 6.9, BRL: 5.4 });
    const fx = await resolveLocalFx("59171234567");
    assert.equal(fx?.code, "BOB");
  });

  test("USD countries and unknown prefixes → null (USD only)", async () => {
    mockRates({});
    assert.equal(await resolveLocalFx("12025550123"), null); // US
    assert.equal(await resolveLocalFx("593987654321"), null); // Ecuador (USD)
    assert.equal(await resolveLocalFx(null), null);
    assert.equal(await resolveLocalFx(""), null);
  });

  test("FX API down → static fallback rate, never throws", async () => {
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as typeof fetch;
    const fx = await resolveLocalFx("+51987654321");
    assert.equal(fx?.code, "PEN");
    assert.equal(fx?.rate, 3.75); // static fallback
  });

  test("rates are cached across calls (one fetch)", async () => {
    let hits = 0;
    globalThis.fetch = (async () => {
      hits++;
      return Response.json({ result: "success", rates: { PEN: 3.6 } });
    }) as typeof fetch;
    await resolveLocalFx("+51987654321");
    await resolveLocalFx("+51911111111");
    assert.equal(hits, 1);
  });
});

import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import type { ModelMessage } from "ai";
import {
  makeFlightSearchTool,
  type FlightSearchFallback,
} from "../src/tools";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const env = {
  TRAVELPAYOUTS_TOKEN: "tp-token",
  TRAVELPAYOUTS_MARKER: "tp-marker",
};

const executeContext = {
  toolCallId: "flight-test",
  messages: [] as ModelMessage[],
};

function installFlightFetch(
  flightResponse: () => Response | Promise<Response>,
  capturedUrls: string[] = [],
): void {
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.startsWith("https://autocomplete.travelpayouts.com/")) {
      // Empty autocomplete intentionally exercises the valid-IATA fallback.
      return Response.json([]);
    }
    if (url.startsWith("https://api.travelpayouts.com/aviasales/")) {
      capturedUrls.push(url);
      return flightResponse();
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
}

describe("Travelpayouts flight-result waterfall", () => {
  test("unresolved places have their own status and do not masquerade as missing flights", async () => {
    let flightApiCalls = 0;
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.startsWith("https://autocomplete.travelpayouts.com/")) {
        return Response.json([]);
      }
      flightApiCalls += 1;
      throw new Error(`Unexpected URL: ${url}`);
    };
    const flightTool = makeFlightSearchTool(env);
    assert.ok(flightTool.execute);

    const output = await flightTool.execute(
      { origin: "Ciudad desconocida", destination: "MAD" },
      executeContext,
    );

    assert.equal(output.search_status, "place_unresolved");
    assert.equal(output.error, "place_unresolved");
    assert.deepEqual(output.flights, []);
    assert.equal(flightApiCalls, 0);
  });

  test("successful empty cache invokes deterministic live fallback and suppresses duplicate model URL", async () => {
    const apiUrls: string[] = [];
    installFlightFetch(
      () => Response.json({ success: true, data: [] }),
      apiUrls,
    );
    let delivered: FlightSearchFallback | null = null;
    const flightTool = makeFlightSearchTool(
      env,
      undefined,
      undefined,
      async (fallback) => {
        delivered = fallback;
        return true;
      },
    );
    assert.ok(flightTool.execute);

    const output = await flightTool.execute(
      { origin: "LIM", destination: "MAD", passengers: 2 },
      executeContext,
    );

    assert.deepEqual(output.flights, []);
    assert.equal(output.search_status, "no_cached_prices");
    assert.equal(output.live_search_already_sent, true);
    assert.equal("search_url" in output, false);
    assert.ok(delivered);
    assert.equal(delivered.reason, "no_cached_prices");
    assert.equal(delivered.passengers, 2);
    assert.match(delivered.searchUrl, /aviasales\.com\/search\/LIMMAD2/);
    assert.match(delivered.searchUrl, /marker=tp-marker/);
    assert.equal(apiUrls.length, 6);
    for (const rawUrl of apiUrls) {
      assert.equal(new URL(rawUrl).searchParams.get("direct"), "false");
    }
  });

  test("failed deterministic delivery keeps search_url for the model/link repair fallback", async () => {
    installFlightFetch(() => Response.json({ success: true, data: [] }));
    const flightTool = makeFlightSearchTool(
      env,
      undefined,
      undefined,
      async () => {
        throw new Error("WhatsApp unavailable");
      },
    );
    assert.ok(flightTool.execute);

    const output = await flightTool.execute(
      { origin: "LIM", destination: "MAD", one_way: true },
      executeContext,
    );

    assert.equal(output.search_status, "no_cached_prices");
    assert.equal("live_search_already_sent" in output, false);
    assert.match(output.search_url ?? "", /aviasales\.com\/search\/LIMMAD1/);
  });

  test("HTTP 429 is identified as rate limiting instead of no cached flights", async () => {
    installFlightFetch(() => new Response("rate limited", { status: 429 }));
    let delivered: FlightSearchFallback | null = null;
    const flightTool = makeFlightSearchTool(
      env,
      undefined,
      undefined,
      async (fallback) => {
        delivered = fallback;
        return true;
      },
    );
    assert.ok(flightTool.execute);

    const output = await flightTool.execute(
      { origin: "LIM", destination: "MAD" },
      executeContext,
    );

    assert.equal(output.search_status, "rate_limited");
    assert.deepEqual(output.upstream_failure_reasons, ["rate_limited"]);
    assert.ok(delivered);
    assert.equal(delivered.reason, "rate_limited");
    assert.equal(output.live_search_already_sent, true);
  });

  test("timeouts are identified and still retain a live search URL", async () => {
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.startsWith("https://autocomplete.travelpayouts.com/")) {
        return Response.json([]);
      }
      if (url.startsWith("https://api.travelpayouts.com/aviasales/")) {
        throw new DOMException("timed out", "TimeoutError");
      }
      throw new Error(`Unexpected URL: ${url}`);
    };
    const flightTool = makeFlightSearchTool(env);
    assert.ok(flightTool.execute);

    const output = await flightTool.execute(
      { origin: "LIM", destination: "NRT" },
      executeContext,
    );

    assert.equal(output.search_status, "upstream_timeout");
    assert.deepEqual(output.upstream_failure_reasons, ["upstream_timeout"]);
    assert.match(output.search_url ?? "", /aviasales\.com\/search\/LIMNRT1/);
  });

  test("valid cached data preserves the normal top-result path", async () => {
    installFlightFetch(() =>
      Response.json({
        success: true,
        data: [
          {
            origin: "LIM",
            destination: "MAD",
            price: 499,
            airline: "IB",
            flight_number: 6650,
            departure_at: "2026-10-12T12:00:00-05:00",
            return_at: "2026-10-25T08:00:00+02:00",
            transfers: 0,
            return_transfers: 0,
            duration_to: 720,
            duration_back: 740,
            link: "/search/LIM1210MAD25101",
          },
        ],
      }),
    );
    let topCalls = 0;
    let fallbackCalls = 0;
    const flightTool = makeFlightSearchTool(
      env,
      undefined,
      async () => {
        topCalls += 1;
        return true;
      },
      async () => {
        fallbackCalls += 1;
        return true;
      },
    );
    assert.ok(flightTool.execute);

    const output = await flightTool.execute(
      { origin: "LIM", destination: "MAD" },
      executeContext,
    );

    assert.equal(output.search_status, "results");
    assert.equal(output.flights.length, 1);
    assert.equal(output.flights[0].price_usd, 499);
    assert.equal(topCalls, 1);
    assert.equal(fallbackCalls, 0);
  });
});

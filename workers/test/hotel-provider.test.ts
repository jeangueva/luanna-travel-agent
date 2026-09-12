import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import type { ModelMessage } from "ai";
import {
  makeHotelSearchTool,
  normalizeApifyHotelPages,
} from "../src/tools";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("normalizeApifyHotelPages", () => {
  test("validates, derives nightly totals, converts local display, dedupes, and sorts", () => {
    const rows = normalizeApifyHotelPages(
      [
        {
          properties: [
            {
              name: "Hotel Centro",
              property_token: "hotel-centro",
              rate_per_night: { extracted: 120, currency: "USD" },
              total_rate: { extracted: 360, currency: "USD" },
              extracted_hotel_class: 4,
              overall_rating: 4.6,
              reviews: 987,
              address: "Centro Histórico",
              images: ["https://images.example/centro.jpg"],
              amenities: ["Wi-Fi", "Breakfast", "Pool", "Gym", "Parking", "Spa"],
            },
            {
              name: "Hotel Budget",
              property_token: "hotel-budget",
              total_rate: { extracted: "240", currency: "USD" },
              hotel_class: "3 stars",
            },
          ],
        },
        {
          properties: [
            {
              name: "Hotel Centro",
              property_token: "hotel-centro",
              rate_per_night: { extracted: 999, currency: "USD" },
            },
            {
              name: "Wrong Currency",
              rate_per_night: { extracted: 80, currency: "EUR" },
            },
            { name: "No Price" },
          ],
        },
      ],
      3,
      { code: "PEN", symbol: "S/", rate: 3.5 },
    );

    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], {
      name: "Hotel Budget",
      stars: 3,
      price_from_usd: 80,
      price_from_local_approx: 280,
      local_currency: "PEN",
      local_symbol: "S/",
      price_avg_usd: null,
      price_total_usd: 240,
      price_total_local_approx: 840,
      rating: null,
      reviews: null,
      location: null,
      country: null,
      image_url: null,
      amenities: [],
      property_token: "hotel-budget",
    });
    assert.equal(rows[1].name, "Hotel Centro");
    assert.equal(rows[1].price_from_usd, 120);
    assert.equal(rows[1].price_total_usd, 360);
    assert.equal(rows[1].rating, 4.6);
    assert.equal(rows[1].reviews, 987);
    assert.deepEqual(rows[1].amenities, [
      "Wi-Fi",
      "Breakfast",
      "Pool",
      "Gym",
      "Parking",
    ]);
  });

  test("rejects malformed response shapes", () => {
    assert.deepEqual(normalizeApifyHotelPages({}, 2, null), []);
    assert.deepEqual(
      normalizeApifyHotelPages([{ properties: "not-an-array" }], 2, null),
      [],
    );
  });
});

describe("Apify hotel provider request", () => {
  test("uses bearer auth, one page, a charge cap, and returns normalized hotels", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return Response.json([
        {
          properties: [
            {
              name: "Hotel Test",
              rate_per_night: { extracted: 90, currency: "USD" },
              total_rate: { extracted: 270, currency: "USD" },
            },
          ],
        },
      ]);
    };

    const hotelTool = makeHotelSearchTool(
      { TRAVELPAYOUTS_TOKEN: "tp-token", TRAVELPAYOUTS_MARKER: "marker" },
      undefined,
      {
        provider: "apify",
        apify: {
          apiToken: "secret-apify-token",
          actorId: "johnvc/google-hotels-search-scraper",
        },
      },
    );
    assert.ok(hotelTool.execute);
    const output = await hotelTool.execute(
      {
        city: "Cusco",
        checkin: "2026-08-10",
        checkout: "2026-08-13",
        adults: 2,
      },
      { toolCallId: "hotel-test", messages: [] as ModelMessage[] },
    );

    const requestUrl = new URL(capturedUrl);
    assert.equal(
      requestUrl.pathname,
      "/v2/acts/johnvc~google-hotels-search-scraper/run-sync-get-dataset-items",
    );
    assert.equal(requestUrl.searchParams.get("limit"), "1");
    assert.equal(requestUrl.searchParams.get("maxTotalChargeUsd"), "0.05");
    assert.equal(requestUrl.searchParams.has("token"), false);
    const headers = new Headers(capturedInit?.headers);
    assert.equal(headers.get("Authorization"), "Bearer secret-apify-token");
    const body = JSON.parse(String(capturedInit?.body));
    assert.deepEqual(body, {
      search_type: "search",
      q: "hotels in Cusco",
      gl: "us",
      hl: "es",
      currency: "USD",
      check_in_date: "2026-08-10",
      check_out_date: "2026-08-13",
      adults: 2,
      max_pages: 1,
    });
    assert.equal(output.hotels[0].name, "Hotel Test");
    assert.equal(output.hotels[0].price_from_usd, 90);
    assert.equal(output.hotels[0].price_total_usd, 270);
    assert.ok(output.search_url);
    assert.ok(output.booking_url);
  });

  test("falls back to direct searches without calling a gated cache when token is absent", async () => {
    let fetchCalls = 0;
    globalThis.fetch = async () => {
      fetchCalls += 1;
      throw new Error("fetch should not run");
    };
    const hotelTool = makeHotelSearchTool(
      { TRAVELPAYOUTS_TOKEN: "tp-token", TRAVELPAYOUTS_MARKER: "marker" },
      undefined,
      { provider: "apify" },
    );
    assert.ok(hotelTool.execute);
    const output = await hotelTool.execute(
      {
        city: "Lima",
        checkin: "2026-09-01",
        checkout: "2026-09-03",
        adults: 2,
      },
      { toolCallId: "hotel-fallback", messages: [] as ModelMessage[] },
    );

    assert.equal(fetchCalls, 0);
    assert.deepEqual(output.hotels, []);
    assert.match(output.booking_url, /booking\.com/);
    assert.match(output.search_url, /tp\.media/);
  });
});

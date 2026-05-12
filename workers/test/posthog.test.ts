import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { distinctIdForUser, track, trackBatch } from "../src/posthog";

interface CapturedRequest {
  url: string;
  init: RequestInit;
}

let captured: CapturedRequest[] = [];
let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  captured = [];
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    captured.push({ url: String(input), init: init ?? {} });
    return new Response('{"status":"ok"}', { status: 200 });
  }) as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("track", () => {
  it("is a no-op when POSTHOG_API_KEY is unset", async () => {
    await track(
      {},
      { event: "x", distinct_id: "y", properties: { foo: 1 } },
    );
    assert.equal(captured.length, 0);
  });

  it("POSTs to the default US ingest host", async () => {
    await track(
      { POSTHOG_API_KEY: "phc_test" },
      { event: "message_received", distinct_id: "user_42" },
    );
    assert.equal(captured.length, 1);
    assert.equal(captured[0].url, "https://us.i.posthog.com/capture/");
    assert.equal(captured[0].init.method, "POST");
  });

  it("honors POSTHOG_HOST when set, stripping trailing slashes", async () => {
    await track(
      { POSTHOG_API_KEY: "phc_test", POSTHOG_HOST: "https://eu.i.posthog.com/" },
      { event: "x", distinct_id: "y" },
    );
    assert.equal(captured[0].url, "https://eu.i.posthog.com/capture/");
  });

  it("includes api_key, event, distinct_id, properties, and an ISO timestamp", async () => {
    await track(
      { POSTHOG_API_KEY: "phc_test" },
      {
        event: "tool_called",
        distinct_id: "user_7",
        properties: { tool_name: "search_flights", origin: "LIM" },
      },
    );
    const body = JSON.parse(String(captured[0].init.body));
    assert.equal(body.api_key, "phc_test");
    assert.equal(body.event, "tool_called");
    assert.equal(body.distinct_id, "user_7");
    assert.deepEqual(body.properties, {
      tool_name: "search_flights",
      origin: "LIM",
    });
    assert.match(body.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("never throws when fetch rejects", async () => {
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as typeof globalThis.fetch;
    await assert.doesNotReject(() =>
      track(
        { POSTHOG_API_KEY: "phc_test" },
        { event: "x", distinct_id: "y" },
      ),
    );
  });

  it("never throws when the response is non-2xx", async () => {
    globalThis.fetch = (async () => new Response("nope", { status: 500 })) as typeof globalThis.fetch;
    await assert.doesNotReject(() =>
      track(
        { POSTHOG_API_KEY: "phc_test" },
        { event: "x", distinct_id: "y" },
      ),
    );
  });

  it("defaults properties to {} when omitted", async () => {
    await track(
      { POSTHOG_API_KEY: "phc_test" },
      { event: "x", distinct_id: "y" },
    );
    const body = JSON.parse(String(captured[0].init.body));
    assert.deepEqual(body.properties, {});
  });
});

describe("trackBatch", () => {
  it("is a no-op when POSTHOG_API_KEY is unset", async () => {
    await trackBatch({}, [{ event: "x", distinct_id: "y" }]);
    assert.equal(captured.length, 0);
  });

  it("is a no-op for empty event array", async () => {
    await trackBatch(
      { POSTHOG_API_KEY: "phc_test" },
      [],
    );
    assert.equal(captured.length, 0);
  });

  it("POSTs to the /batch/ endpoint with all events", async () => {
    await trackBatch({ POSTHOG_API_KEY: "phc_test" }, [
      { event: "a", distinct_id: "u1", properties: { p: 1 } },
      { event: "b", distinct_id: "u2" },
    ]);
    assert.equal(captured.length, 1);
    assert.equal(captured[0].url, "https://us.i.posthog.com/batch/");
    const body = JSON.parse(String(captured[0].init.body));
    assert.equal(body.api_key, "phc_test");
    assert.equal(body.batch.length, 2);
    assert.equal(body.batch[0].event, "a");
    assert.equal(body.batch[1].event, "b");
    assert.deepEqual(body.batch[1].properties, {});
  });
});

describe("distinctIdForUser", () => {
  it("formats the user id with a user_ prefix", () => {
    assert.equal(distinctIdForUser(42), "user_42");
    assert.equal(distinctIdForUser(0), "user_0");
    assert.equal(distinctIdForUser(999999), "user_999999");
  });
});

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  sendKapsoButtons,
  sendKapsoCtaUrl,
  sendKapsoLocationRequest,
  sendKapsoReaction,
} from "../src/kapso";

// Capture outgoing fetches; respond 200 so senders resolve.
let calls: Array<{ url: string; body: Record<string, unknown> }> = [];
const realFetch = globalThis.fetch;

beforeEach(() => {
  calls = [];
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(url),
      body: init?.body ? JSON.parse(String(init.body)) : {},
    });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const base = { apiKey: "k", phoneNumberId: "pn1", to: "51999" };

describe("sendKapsoButtons", () => {
  test("builds an interactive button payload, caps at 3 buttons / 20 chars", async () => {
    await sendKapsoButtons({
      ...base,
      bodyText: "Elige:",
      buttons: [
        { id: "a", title: "Uno" },
        { id: "b", title: "Dos" },
        { id: "c", title: "Este título es demasiado largo para WhatsApp" },
        { id: "d", title: "Cuatro (fuera)" },
      ],
    });
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/pn1\/messages$/);
    const b = calls[0].body as {
      type: string;
      interactive: {
        type: string;
        action: { buttons: Array<{ reply: { id: string; title: string } }> };
      };
    };
    assert.equal(b.type, "interactive");
    assert.equal(b.interactive.type, "button");
    assert.equal(b.interactive.action.buttons.length, 3);
    assert.ok(b.interactive.action.buttons[2].reply.title.length <= 20);
  });

  test("throws on non-OK so the caller can fall back to plain text", async () => {
    globalThis.fetch = (async () =>
      new Response("boom", { status: 500 })) as typeof fetch;
    await assert.rejects(
      sendKapsoButtons({ ...base, bodyText: "x", buttons: [{ id: "a", title: "A" }] }),
      /500/,
    );
  });
});

describe("sendKapsoCtaUrl", () => {
  test("builds a native URL CTA with the live flight-search link", async () => {
    await sendKapsoCtaUrl({
      ...base,
      bodyText: "✈️ LIM → MAD\nCompara las opciones en vivo",
      buttonText: "Ver vuelos ✈️",
      url: "https://luanna.app/r/Live12",
    });
    assert.equal(calls.length, 1);
    const body = calls[0].body as {
      type: string;
      interactive: {
        type: string;
        action: {
          name: string;
          parameters: { display_text: string; url: string };
        };
      };
    };
    assert.equal(body.type, "interactive");
    assert.equal(body.interactive.type, "cta_url");
    assert.equal(body.interactive.action.name, "cta_url");
    assert.equal(body.interactive.action.parameters.display_text, "Ver vuelos ✈️");
    assert.equal(
      body.interactive.action.parameters.url,
      "https://luanna.app/r/Live12",
    );
  });
});

describe("sendKapsoLocationRequest", () => {
  test("builds a location_request_message payload", async () => {
    await sendKapsoLocationRequest({ ...base, bodyText: "¿Desde dónde sales?" });
    const b = calls[0].body as {
      interactive: { type: string; action: { name: string } };
    };
    assert.equal(b.interactive.type, "location_request_message");
    assert.equal(b.interactive.action.name, "send_location");
  });
});

describe("sendKapsoReaction", () => {
  test("builds a reaction payload targeting the message id", async () => {
    await sendKapsoReaction({ ...base, messageId: "wamid.X", emoji: "✅" });
    const b = calls[0].body as {
      type: string;
      reaction: { message_id: string; emoji: string };
    };
    assert.equal(b.type, "reaction");
    assert.equal(b.reaction.message_id, "wamid.X");
    assert.equal(b.reaction.emoji, "✅");
  });

  test("never throws (cosmetic)", async () => {
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as typeof fetch;
    await sendKapsoReaction({ ...base, messageId: "m", emoji: "✅" });
  });
});

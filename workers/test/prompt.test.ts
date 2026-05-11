import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildLuannaSystemPrompt } from "../src/prompt";

describe("buildLuannaSystemPrompt — temporal context", () => {
  it("includes the ISO date for an arbitrary 'now'", () => {
    // Tuesday 14 May 2024
    const now = new Date("2024-05-14T12:00:00Z");
    const prompt = buildLuannaSystemPrompt({ now });
    assert.match(prompt, /2024-05-14/);
    assert.match(prompt, /martes 14 de mayo de 2024/);
  });

  it("instructs the model to roll bare months forward when they already passed", () => {
    const now = new Date("2026-08-01T00:00:00Z");
    const prompt = buildLuannaSystemPrompt({ now });
    // Next year is 2027 — the prompt should mention it for rollover guidance
    assert.match(prompt, /2027/);
  });

  it("emits a hard rule banning past dates in tool calls", () => {
    const prompt = buildLuannaSystemPrompt({ now: new Date("2026-05-10T00:00:00Z") });
    assert.match(prompt, /NUNCA.*fechas del pasado/i);
  });
});

describe("buildLuannaSystemPrompt — name handling", () => {
  it("tells the model to ask for the name when unknown", () => {
    const prompt = buildLuannaSystemPrompt({
      now: new Date("2026-05-10T00:00:00Z"),
      userName: null,
    });
    assert.match(prompt, /A[uú]n no sabes su nombre/);
    assert.match(prompt, /save_user_name/);
  });

  it("tells the model to use the name when known", () => {
    const prompt = buildLuannaSystemPrompt({
      now: new Date("2026-05-10T00:00:00Z"),
      userName: "Jean",
    });
    assert.match(prompt, /Se llama "Jean"/);
    assert.match(prompt, /USA su nombre/);
  });

  it("uses the unknown-name path when userName is undefined", () => {
    const prompt = buildLuannaSystemPrompt({ now: new Date() });
    assert.match(prompt, /A[uú]n no sabes su nombre/);
  });
});

describe("buildLuannaSystemPrompt — first contact", () => {
  it("activates the first-contact protocol when isFirstContact is true", () => {
    const prompt = buildLuannaSystemPrompt({
      now: new Date("2026-05-10T00:00:00Z"),
      isFirstContact: true,
    });
    assert.match(prompt, /ESTE ES EL PRIMER CONTACTO/);
  });

  it("omits the first-contact override when isFirstContact is false", () => {
    const prompt = buildLuannaSystemPrompt({
      now: new Date("2026-05-10T00:00:00Z"),
      isFirstContact: false,
    });
    assert.doesNotMatch(prompt, /ESTE ES EL PRIMER CONTACTO/);
  });
});

describe("buildLuannaSystemPrompt — personality is non-empty", () => {
  it("references emoji rule and sarcasm guidance", () => {
    const prompt = buildLuannaSystemPrompt();
    assert.match(prompt, /USA EMOJIS/);
    assert.match(prompt, /[Ss]arc[aá]stica/);
    assert.match(prompt, /save_user_name/);
    assert.match(prompt, /search_flights/);
    assert.match(prompt, /search_hotels/);
    assert.match(prompt, /get_package_link/);
    assert.match(prompt, /add_watchlist/);
  });
});

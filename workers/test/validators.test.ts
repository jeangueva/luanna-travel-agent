import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CHAT_MESSAGE_MAX,
  PREFS_ARRAY_MAX,
  PREFS_BUDGET_MAX,
  PREFS_ORIGIN_MAX,
  PREFS_STRING_MAX,
  clampBudget,
  cleanStringArray,
} from "../src/validators";

describe("validators / limits", () => {
  it("exposes the security-critical constants", () => {
    assert.equal(CHAT_MESSAGE_MAX, 4000);
    assert.equal(PREFS_ARRAY_MAX, 50);
    assert.equal(PREFS_STRING_MAX, 60);
    assert.equal(PREFS_ORIGIN_MAX, 50);
    assert.equal(PREFS_BUDGET_MAX, 1_000_000);
  });
});

describe("cleanStringArray", () => {
  it("returns [] for non-array input", () => {
    assert.deepEqual(cleanStringArray(null), []);
    assert.deepEqual(cleanStringArray(undefined), []);
    assert.deepEqual(cleanStringArray("not array"), []);
    assert.deepEqual(cleanStringArray(42), []);
    assert.deepEqual(cleanStringArray({}), []);
  });

  it("filters out non-strings, empty strings, and whitespace-only strings", () => {
    const input = ["Madrid", "", "  ", 42, null, undefined, "Barcelona", true];
    assert.deepEqual(cleanStringArray(input), ["Madrid", "Barcelona"]);
  });

  it("trims surrounding whitespace from each item", () => {
    assert.deepEqual(cleanStringArray(["  Madrid  ", "\tBCN\n"]), ["Madrid", "BCN"]);
  });

  it("caps the array to PREFS_ARRAY_MAX items", () => {
    const big = Array.from({ length: 200 }, (_, i) => `city-${i}`);
    const result = cleanStringArray(big);
    assert.equal(result.length, PREFS_ARRAY_MAX);
    assert.equal(result[0], "city-0");
    assert.equal(result[PREFS_ARRAY_MAX - 1], `city-${PREFS_ARRAY_MAX - 1}`);
  });

  it("truncates each string to PREFS_STRING_MAX chars after trimming", () => {
    const long = "x".repeat(200);
    const padded = `   ${long}   `;
    const result = cleanStringArray([padded]);
    assert.equal(result.length, 1);
    assert.equal(result[0].length, PREFS_STRING_MAX);
    assert.equal(result[0], "x".repeat(PREFS_STRING_MAX));
  });

  it("applies both caps together: 200 items × 200 chars → 50 items × 60 chars", () => {
    const huge = Array.from({ length: 200 }, () => "y".repeat(200));
    const result = cleanStringArray(huge);
    assert.equal(result.length, 50);
    for (const item of result) {
      assert.equal(item.length, 60);
    }
  });

  it("does not mutate the input array", () => {
    const input = ["a", "b", "c"];
    const snapshot = [...input];
    cleanStringArray(input);
    assert.deepEqual(input, snapshot);
  });
});

describe("clampBudget", () => {
  it("returns null for non-number input", () => {
    assert.equal(clampBudget(null), null);
    assert.equal(clampBudget(undefined), null);
    assert.equal(clampBudget("100"), null);
    assert.equal(clampBudget("not a number"), null);
    assert.equal(clampBudget({}), null);
    assert.equal(clampBudget([]), null);
  });

  it("returns null for NaN and Infinity", () => {
    assert.equal(clampBudget(NaN), null);
    assert.equal(clampBudget(Infinity), null);
    assert.equal(clampBudget(-Infinity), null);
  });

  it("returns null for negative numbers", () => {
    assert.equal(clampBudget(-1), null);
    assert.equal(clampBudget(-0.5), null);
    assert.equal(clampBudget(-PREFS_BUDGET_MAX), null);
  });

  it("accepts 0", () => {
    assert.equal(clampBudget(0), 0);
  });

  it("floors decimal values", () => {
    assert.equal(clampBudget(99.9), 99);
    assert.equal(clampBudget(100.5), 100);
    assert.equal(clampBudget(0.7), 0);
  });

  it("clamps values above PREFS_BUDGET_MAX", () => {
    assert.equal(clampBudget(PREFS_BUDGET_MAX + 1), PREFS_BUDGET_MAX);
    assert.equal(clampBudget(99_999_999), PREFS_BUDGET_MAX);
    assert.equal(clampBudget(Number.MAX_SAFE_INTEGER), PREFS_BUDGET_MAX);
  });

  it("preserves values inside the valid range", () => {
    assert.equal(clampBudget(500), 500);
    assert.equal(clampBudget(PREFS_BUDGET_MAX), PREFS_BUDGET_MAX);
    assert.equal(clampBudget(PREFS_BUDGET_MAX - 1), PREFS_BUDGET_MAX - 1);
  });
});

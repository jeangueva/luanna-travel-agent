import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { inferOriginFromPhone, nearestAirport } from "../src/geo";

describe("inferOriginFromPhone", () => {
  it("maps Peru numbers to Lima", () => {
    assert.equal(inferOriginFromPhone("51977150415")?.iata, "LIM");
  });
  it("maps Brazil to São Paulo, Mexico to MEX, Spain to Madrid", () => {
    assert.equal(inferOriginFromPhone("5511999998888")?.iata, "GRU");
    assert.equal(inferOriginFromPhone("5215512345678")?.iata, "MEX");
    assert.equal(inferOriginFromPhone("34611223344")?.iata, "MAD");
  });
  it("prefers the longest matching calling code (593 over 5/59)", () => {
    assert.equal(inferOriginFromPhone("593987654321")?.iata, "UIO");
  });
  it("handles + prefix and US +1", () => {
    assert.equal(inferOriginFromPhone("+13055551234")?.iata, "MIA");
  });
  it("returns null for web sessions and unknown prefixes", () => {
    assert.equal(inferOriginFromPhone("web:abc123"), null);
    assert.equal(inferOriginFromPhone("9990001112"), null);
    assert.equal(inferOriginFromPhone(""), null);
  });
});

describe("nearestAirport", () => {
  it("snaps Cusco coords to CUZ, not Lima", () => {
    assert.equal(nearestAirport(-13.53, -71.97)?.iata, "CUZ");
  });
  it("snaps central Lima to LIM", () => {
    assert.equal(nearestAirport(-12.05, -77.04)?.iata, "LIM");
  });
  it("snaps São Paulo center to GRU", () => {
    assert.equal(nearestAirport(-23.55, -46.63)?.iata, "GRU");
  });
});

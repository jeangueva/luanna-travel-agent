import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { OPTION_NUMBER_RE } from "../src/index";

describe("OPTION_NUMBER_RE (deterministic numbered-link fallback)", () => {
  const matches = (s: string) => OPTION_NUMBER_RE.exec(s)?.[1];

  test("bare number", () => {
    assert.equal(matches("2"), "2");
    assert.equal(matches("  3  "), "3");
    assert.equal(matches("12"), "12");
  });

  test("common natural phrasings", () => {
    assert.equal(matches("opción 2"), "2");
    assert.equal(matches("opcion 2"), "2");
    assert.equal(matches("el 2"), "2");
    assert.equal(matches("la 3"), "3");
    assert.equal(matches("número 1"), "1");
    assert.equal(matches("numero 1"), "1");
    assert.equal(matches("#4"), "4");
    assert.equal(matches("2."), "2");
    assert.equal(matches("2!"), "2");
  });

  test("must NOT match a number embedded in ordinary text (ambiguity guard)", () => {
    assert.equal(matches("2 personas"), undefined);
    assert.equal(matches("somos 3"), undefined);
    assert.equal(matches("el vuelo dura 2 horas"), undefined);
    assert.equal(matches("dame la opcion 2 por favor"), undefined);
    assert.equal(matches("2 días en Cusco"), undefined);
  });

  test("must NOT match non-numeric messages", () => {
    assert.equal(matches("hola"), undefined);
    assert.equal(matches("busca vuelos a Cusco"), undefined);
    assert.equal(matches(""), undefined);
  });
});

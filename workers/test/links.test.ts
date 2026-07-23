import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  createLinkGuardStream,
  repairTrackedLinks,
  scrubHistoryLinks,
} from "../src/links";
import type { Sql } from "../src/db";

// Fake Neon client: answers the filterExistingClickIds query with the ids in
// `existing`, intersected with the ids the query asks about.
function fakeSql(existing: string[]): Sql {
  const fn = (async (_strings: TemplateStringsArray, ...values: unknown[]) => {
    const asked = (values[0] as string[]) ?? [];
    return existing
      .filter((id) => asked.includes(id))
      .map((id) => ({ id }));
  }) as unknown as Sql;
  return fn;
}

function failingSql(): Sql {
  return (async () => {
    throw new Error("db down");
  }) as unknown as Sql;
}

const steps = (...urls: string[]) => [
  { toolResults: urls.map((u) => ({ output: { link: u } })) },
];

describe("repairTrackedLinks", () => {
  test("text without /r/ links passes through untouched", async () => {
    const out = await repairTrackedLinks(failingSql(), "hola ✈️", steps());
    assert.equal(out, "hola ✈️");
  });

  test("links created this turn pass through untouched", async () => {
    const text = "Mira: https://luanna.app/r/AbC123";
    const out = await repairTrackedLinks(
      failingSql(),
      text,
      steps("https://luanna.app/r/AbC123"),
    );
    assert.equal(out, text);
  });

  test("mistyped id remaps positionally when counts match", async () => {
    const out = await repairTrackedLinks(
      failingSql(),
      "Opción: https://luanna.app/r/WRONG1 🔥",
      steps("https://luanna.app/r/Righty"),
    );
    assert.equal(out, "Opción: https://luanna.app/r/Righty 🔥");
  });

  test("fabricated id with NO tool links this turn is stripped (the /r/CpbWiH bug)", async () => {
    const out = await repairTrackedLinks(
      fakeSql([]),
      "Prueba el buscador: https://luanna.app/r/CpbWiH 🔍",
      steps(), // model answered from history, no tool ran
    );
    assert.ok(!out.includes("/r/CpbWiH"));
  });

  test("valid id echoed from an earlier turn is kept (exists in DB)", async () => {
    const text = "Te lo repito: https://luanna.app/r/OldReal 👍";
    const out = await repairTrackedLinks(fakeSql(["OldReal"]), text, steps());
    assert.equal(out, text);
  });

  test("count mismatch: real ids kept, fabricated swapped for unused fresh link", async () => {
    const out = await repairTrackedLinks(
      fakeSql([]),
      "A https://luanna.app/r/Real01 y B https://luanna.app/r/Fake99",
      steps("https://luanna.app/r/Real01", "https://luanna.app/r/Real02", "https://luanna.app/r/Real03"),
    );
    assert.ok(out.includes("/r/Real01"));
    assert.ok(!out.includes("/r/Fake99"));
    assert.ok(out.includes("/r/Real02"));
  });

  test("count mismatch: stale id that still exists in DB is swapped for this turn's link", async () => {
    // Tool ran this turn (5 results) but the model showed only 1 link and
    // echoed an OLD id from history. Even though the old id resolves, it
    // points at a previous search — the fresh cheapest link must win.
    const out = await repairTrackedLinks(
      fakeSql(["Stale1"]),
      "Top: https://luanna.app/r/Stale1 y 4 opciones más sin link",
      steps(
        "https://luanna.app/r/New001",
        "https://luanna.app/r/New002",
        "https://luanna.app/r/New003",
        "https://luanna.app/r/New004",
        "https://luanna.app/r/New005",
      ),
    );
    assert.ok(!out.includes("/r/Stale1"));
    assert.ok(out.includes("/r/New001"));
  });

  test("count mismatch with no fresh links left: DB-existing echo kept, dead stripped", async () => {
    const out = await repairTrackedLinks(
      fakeSql(["OldReal"]),
      "A https://luanna.app/r/OldReal y B https://luanna.app/r/Dead01",
      steps(),
    );
    assert.ok(out.includes("/r/OldReal"));
    assert.ok(!out.includes("/r/Dead01"));
  });

  test("DB failure strips unknown ids instead of leaking dead links", async () => {
    const out = await repairTrackedLinks(
      failingSql(),
      "Link: https://luanna.app/r/Maybe1",
      steps(),
    );
    assert.ok(!out.includes("/r/Maybe1"));
  });

  test("ghost id in the step REQUEST (chat history) does not count as real (CpbWiH regression)", async () => {
    // AI SDK steps embed the request payload, which contains the chat history.
    // A dead link echoed there must NOT whitelist itself.
    const poisonedSteps = [
      {
        request: {
          body: JSON.stringify({
            messages: [
              { role: "assistant", content: "viejo: https://luanna.app/r/CpbWiH" },
            ],
          }),
        },
        toolResults: [{ output: { link: "https://luanna.app/r/Real01" } }],
      },
    ];
    const out = await repairTrackedLinks(
      fakeSql([]),
      "Top: https://luanna.app/r/CpbWiH y más opciones",
      poisonedSteps,
    );
    // Exactly one real URL and one in-text URL → positional remap to the real one.
    assert.ok(!out.includes("/r/CpbWiH"));
    assert.ok(out.includes("/r/Real01"));
  });
});

describe("repairTrackedLinks: model promised a link and never wrote it", () => {
  test("real link created this turn but text has zero /r/ tokens → appended (Prague bug)", async () => {
    const out = await repairTrackedLinks(
      failingSql(),
      "En Praga no encuentro precios guardados ahorita, Jean 🏰 Pero acá puedes ver opciones en vivo:\n\n¿Quieres que te arme una alerta para cuando bajen? 📍✈️",
      steps("https://luanna.app/r/9GlckM"),
    );
    assert.ok(out.includes("https://luanna.app/r/9GlckM"));
  });

  test("no tool link this turn and text has zero /r/ tokens → untouched", async () => {
    const text = "¿A dónde quieres ir, Jean? ✈️";
    const out = await repairTrackedLinks(failingSql(), text, steps());
    assert.equal(out, text);
  });

  test("TWO real links created this turn but text has zero /r/ tokens → BOTH appended (Cancún airbnb bug)", async () => {
    // search_stays creates airbnb_url + booking_url together; the model
    // wrote "Ver en Airbnb: / Ver en Booking:" with nothing after either
    // label. Backfilling only the first link still leaves the second
    // labeled slot pointing at nothing.
    const out = await repairTrackedLinks(
      failingSql(),
      "🏡 Ver en Airbnb: \n🏨 Ver en Booking: \n\n¿Algo más?",
      steps("https://luanna.app/r/AirBnb1", "https://luanna.app/r/Booking2"),
    );
    assert.ok(out.includes("https://luanna.app/r/AirBnb1"));
    assert.ok(out.includes("https://luanna.app/r/Booking2"));
  });
});

describe("scrubHistoryLinks", () => {
  test("replaces /r/ links with an inert placeholder", () => {
    const out = scrubHistoryLinks(
      "Top: https://luanna.app/r/CpbWiH ✈️ y https://luanna.app/r/AbC123",
    );
    assert.ok(!out.includes("/r/CpbWiH"));
    assert.ok(!out.includes("/r/AbC123"));
    assert.ok(out.includes("[SISTEMA: link vencido, no reutilizar]"));
    assert.ok(out.includes("✈️"));
  });

  test("text without links passes through untouched", () => {
    assert.equal(scrubHistoryLinks("hola ✈️"), "hola ✈️");
  });

  test("non-/r/ luanna URLs (trip pages) are preserved", () => {
    const text = "Tu plan: https://luanna.app/trip/abc123 📄";
    assert.equal(scrubHistoryLinks(text), text);
  });
});

// Drive the guard with arbitrary chunk boundaries and collect the output.
async function runGuard(
  sql: Sql,
  chunks: string[],
  realUrls: string[] = [],
): Promise<string> {
  const guard = createLinkGuardStream(sql, "https://luanna.app");
  for (const u of realUrls) guard.addRealUrl(u);
  const writer = guard.stream.writable.getWriter();
  const reader = guard.stream.readable.getReader();
  const out: string[] = [];
  const drain = (async () => {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      out.push(value);
    }
  })();
  for (const c of chunks) await writer.write(c);
  await writer.close();
  await drain;
  return out.join("");
}

describe("createLinkGuardStream", () => {
  test("plain text streams through unchanged", async () => {
    const out = await runGuard(failingSql(), ["Hola ", "Jean ✈️ ", "¿a dónde vamos?"]);
    assert.equal(out, "Hola Jean ✈️ ¿a dónde vamos?");
  });

  test("real link created this turn but never referenced in the stream → appended on flush (Prague bug)", async () => {
    const out = await runGuard(
      failingSql(),
      ["Pero acá puedes ver opciones en vivo:\n\n¿Te armo una alerta? 📍"],
      ["https://luanna.app/r/9GlckM"],
    );
    assert.ok(out.includes("https://luanna.app/r/9GlckM"));
  });

  test("TWO real links this turn, neither referenced → BOTH appended on flush", async () => {
    const out = await runGuard(
      failingSql(),
      ["🏡 Ver en Airbnb: \n🏨 Ver en Booking: "],
      ["https://luanna.app/r/AirBnb1", "https://luanna.app/r/Booking2"],
    );
    assert.ok(out.includes("https://luanna.app/r/AirBnb1"));
    assert.ok(out.includes("https://luanna.app/r/Booking2"));
  });

  test("no real link this turn → nothing appended", async () => {
    const out = await runGuard(failingSql(), ["¿A dónde quieres ir, Jean? ✈️"]);
    assert.equal(out, "¿A dónde quieres ir, Jean? ✈️");
  });

  test("valid tool link passes even when split across chunks", async () => {
    const out = await runGuard(
      failingSql(),
      ["Mira: https://luanna.a", "pp/r/AbC", "123 🔥"],
      ["https://luanna.app/r/AbC123"],
    );
    assert.equal(out, "Mira: https://luanna.app/r/AbC123 🔥");
  });

  test("fabricated id is swapped for the unused real link", async () => {
    const out = await runGuard(
      failingSql(),
      ["Link: https://luanna.app/r/FAKE99 listo"],
      ["https://luanna.app/r/Righty"],
    );
    assert.equal(out, "Link: https://luanna.app/r/Righty listo");
  });

  test("fabricated id with no real links and no DB row is stripped (streamed /r/CpbWiH bug)", async () => {
    const out = await runGuard(fakeSql([]), [
      "Prueba: https://luanna.app/r/CpbWiH",
      " 🔍",
    ]);
    assert.ok(!out.includes("/r/CpbWiH"));
  });

  test("echoed id that exists in DB is kept", async () => {
    const out = await runGuard(fakeSql(["OldReal"]), [
      "De nuevo: https://luanna.app/r/OldReal 👍",
    ]);
    assert.equal(out, "De nuevo: https://luanna.app/r/OldReal 👍");
  });

  test("foreign-host URLs are stripped mid-stream", async () => {
    const out = await runGuard(failingSql(), [
      "Ve a https://evil.example.com/phish y listo",
    ]);
    assert.equal(out, "Ve a  y listo");
  });

  test("emoji glued to a fabricated link does not smuggle it through", async () => {
    const out = await runGuard(fakeSql([]), [
      "Buscador: https://luanna.app/r/CpbWiH🔍📍 ¿qué prefieres?",
    ]);
    assert.ok(!out.includes("/r/CpbWiH"));
    assert.ok(out.includes("¿qué prefieres?"));
  });

  test("URL at end of message resolves on flush", async () => {
    const out = await runGuard(
      failingSql(),
      ["Acá: https://luanna.app/r/WRONG1"],
      ["https://luanna.app/r/Righty"],
    );
    assert.equal(out, "Acá: https://luanna.app/r/Righty");
  });

  test("non-/r/ luanna URLs (trip pages) pass through", async () => {
    const out = await runGuard(failingSql(), [
      "Tu plan: https://luanna.app/trip/abc123 📄",
    ]);
    assert.equal(out, "Tu plan: https://luanna.app/trip/abc123 📄");
  });
});

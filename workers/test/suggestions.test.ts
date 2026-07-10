import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { deriveSuggestions, mapTapToMessage } from "../src/suggestions";
import { extractButtonReply } from "../src/kapso";

describe("deriveSuggestions", () => {
  test("no tools → no suggestions (plain chat turns stay clean)", () => {
    assert.deepEqual(deriveSuggestions([]), []);
    assert.deepEqual(deriveSuggestions(["save_user_name"]), []);
  });

  test("search_flights → alert, hotels, itinerary", () => {
    const s = deriveSuggestions(["search_flights"]);
    assert.deepEqual(
      s.map((x) => x.id),
      ["qr_alert", "qr_hotels", "qr_itinerary"],
    );
  });

  test("last tool with follow-ups wins", () => {
    const s = deriveSuggestions(["search_flights", "search_hotels"]);
    assert.equal(s[0].id, "qr_flights");
  });

  test("start_itinerary suppresses everything", () => {
    assert.deepEqual(
      deriveSuggestions(["search_flights", "start_itinerary"]),
      [],
    );
  });

  test("max 3, titles fit WhatsApp 20-char button limit", () => {
    for (const tool of [
      "search_flights",
      "search_hotels",
      "search_stays",
      "get_package_link",
      "suggest_itinerary",
      "trip_prep",
      "add_watchlist",
    ]) {
      const s = deriveSuggestions([tool]);
      assert.ok(s.length >= 1 && s.length <= 3, tool);
      for (const x of s) {
        assert.ok([...x.title].length <= 20, `${tool}: "${x.title}" too long`);
        assert.ok(x.message.length > 0);
      }
    }
  });
});

describe("mapTapToMessage", () => {
  test("known id maps to the canned user message", () => {
    assert.match(mapTapToMessage("qr_alert", "🔔 Crear alerta"), /alerta de precio/);
  });

  test("unknown id falls back to the visible title", () => {
    assert.equal(mapTapToMessage("qr_future", "Ver más"), "Ver más");
  });
});

describe("extractButtonReply", () => {
  const envelope = (interactive: unknown) => ({
    event: "whatsapp.message.received",
    data: {
      message: {
        id: "wamid.tap1",
        timestamp: "1",
        type: "interactive",
        from: "51999",
        interactive,
      },
      conversation: { id: "c1", phone_number_id: "pn1" },
      phone_number_id: "pn1",
    },
  });

  test("button_reply is extracted", () => {
    const tap = extractButtonReply(
      envelope({ type: "button_reply", button_reply: { id: "qr_alert", title: "🔔 Crear alerta" } }),
    );
    assert.deepEqual(tap, {
      message_id: "wamid.tap1",
      from: "51999",
      phone_number_id: "pn1",
      id: "qr_alert",
      title: "🔔 Crear alerta",
    });
  });

  test("list_reply is extracted", () => {
    const tap = extractButtonReply(
      envelope({ type: "list_reply", list_reply: { id: "opt2", title: "16 ago · $624" } }),
    );
    assert.equal(tap?.id, "opt2");
  });

  test("flow nfm_reply is NOT a button tap", () => {
    const tap = extractButtonReply(
      envelope({ type: "nfm_reply", nfm_reply: { response_json: "{}" } }),
    );
    assert.equal(tap, null);
  });

  test("plain text message is NOT a button tap", () => {
    const tap = extractButtonReply({
      event: "whatsapp.message.received",
      data: {
        message: { id: "m", timestamp: "1", type: "text", from: "51999", text: { body: "hola" } },
        conversation: { id: "c1", phone_number_id: "pn1" },
        phone_number_id: "pn1",
      },
    });
    assert.equal(tap, null);
  });
});

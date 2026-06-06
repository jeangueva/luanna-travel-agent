import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractMessageBatch,
  extractMessageReceived,
  extractMediaMessage,
  extractFlowSubmission,
} from "../src/kapso";

const textMsg = (id: string, body: string) => ({
  message: { id, timestamp: "1", type: "text", from: "5199", text: { body } },
  conversation: { id: "c1", phone_number_id: "PN1" },
  phone_number_id: "PN1",
});

describe("extractMessageBatch — shape normalization", () => {
  it("unwraps the unbuffered single-object envelope", () => {
    const body = { event: "whatsapp.message.received", data: textMsg("m1", "hola") };
    const batch = extractMessageBatch(body);
    assert.equal(batch.length, 1);
    assert.equal(batch[0].message.id, "m1");
    assert.equal(batch[0].phone_number_id, "PN1");
  });

  it("unwraps a buffered batch (data is an array) preserving order", () => {
    const body = {
      event: "whatsapp.message.received",
      data: [textMsg("m1", "hola"), textMsg("m2", "voy a japon"), textMsg("m3", "me ayudas")],
      batch_info: { size: 3, window_ms: 5000 },
    };
    const batch = extractMessageBatch(body);
    assert.deepEqual(batch.map((b) => b.message.id), ["m1", "m2", "m3"]);
  });

  it("derives phone_number_id from conversation or whatsapp_config when absent at top level", () => {
    const fromConv = {
      message: { id: "m1", timestamp: "1", type: "text", from: "5199", text: { body: "x" } },
      conversation: { id: "c1", phone_number_id: "PN_CONV" },
    };
    const fromConfig = {
      message: { id: "m2", timestamp: "1", type: "text", from: "5199", text: { body: "y" } },
      whatsapp_config: { phone_number_id: "PN_CFG" },
    };
    const batch = extractMessageBatch({
      event: "whatsapp.message.received",
      data: [fromConv, fromConfig],
    });
    assert.equal(batch[0].phone_number_id, "PN_CONV");
    assert.equal(batch[1].phone_number_id, "PN_CFG");
  });

  it("ignores non-message events", () => {
    assert.deepEqual(extractMessageBatch({ event: "whatsapp.status.updated", data: textMsg("m1", "x") }), []);
  });

  it("drops malformed items (missing message / from / phone_number_id)", () => {
    const body = {
      event: "whatsapp.message.received",
      data: [
        textMsg("ok", "hi"),
        { message: { id: "no-from", type: "text", text: { body: "z" } } },
        { conversation: { id: "c", phone_number_id: "PN" } },
        null,
      ],
    };
    const batch = extractMessageBatch(body);
    assert.deepEqual(batch.map((b) => b.message.id), ["ok"]);
  });

  it("returns [] for non-object input", () => {
    assert.deepEqual(extractMessageBatch(null), []);
    assert.deepEqual(extractMessageBatch("nope"), []);
  });

  it("per-item extractors work on normalized batch elements", () => {
    const image = {
      message: {
        id: "img1",
        timestamp: "1",
        type: "image",
        from: "5199",
        image: { id: "MEDIA1", mime_type: "image/jpeg", caption: "playa" },
      },
      phone_number_id: "PN1",
    };
    const flow = {
      message: {
        id: "f1",
        timestamp: "1",
        type: "interactive",
        from: "5199",
        interactive: { type: "nfm_reply", nfm_reply: { response_json: '{"origin":"Lima"}' } },
      },
      phone_number_id: "PN1",
    };
    const batch = extractMessageBatch({
      event: "whatsapp.message.received",
      data: [textMsg("t1", "hola"), image, flow],
    });
    assert.equal(extractMessageReceived(batch[0])?.message.id, "t1");
    const media = extractMediaMessage(batch[1]);
    assert.equal(media?.kind, "image");
    assert.equal(media?.media_id, "MEDIA1");
    assert.equal(media?.phone_number_id, "PN1");
    const sub = extractFlowSubmission(batch[2]);
    assert.deepEqual(sub?.responseJson, { origin: "Lima" });
  });
});

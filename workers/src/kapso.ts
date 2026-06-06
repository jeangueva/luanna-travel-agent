export interface KapsoMessage {
  id: string;
  timestamp: string;
  type: string;
  from: string;
  text?: { body?: string };
  image?: { id: string; mime_type?: string; caption?: string; sha256?: string };
  audio?: { id: string; mime_type?: string; voice?: boolean };
  voice?: { id: string; mime_type?: string };
  interactive?: {
    type?: string;
    nfm_reply?: {
      name?: string;
      body?: string;
      response_json?: string;
    };
  };
}

export interface KapsoMessageReceivedData {
  message: KapsoMessage;
  conversation: { id: string; phone_number_id: string };
  phone_number_id: string;
  is_new_conversation?: boolean;
}

interface KapsoEnvelope {
  event?: string;
  data?: KapsoMessageReceivedData;
}

function unwrapEnvelope(
  body: unknown,
): KapsoMessageReceivedData | null {
  if (!body || typeof body !== "object") return null;
  const envelope = body as KapsoEnvelope & Partial<KapsoMessageReceivedData>;
  if (envelope.event && envelope.event !== "whatsapp.message.received") {
    return null;
  }
  const data = envelope.data ?? (envelope as KapsoMessageReceivedData);
  if (!data?.message || !data.message.from || !data.phone_number_id) return null;
  return data;
}

export function extractMessageReceived(
  body: unknown,
): KapsoMessageReceivedData | null {
  const data = unwrapEnvelope(body);
  if (!data) return null;
  if (data.message.type !== "text") return null;
  return data;
}

export interface FlowSubmission {
  from: string;
  phoneNumberId: string;
  responseJson: Record<string, unknown>;
}

export interface MediaMessage {
  message_id: string;
  from: string;
  phone_number_id: string;
  kind: "image" | "audio";
  media_id: string;
  mime_type: string | null;
  caption: string | null;
}

export function extractMediaMessage(body: unknown): MediaMessage | null {
  const data = unwrapEnvelope(body);
  if (!data) return null;
  const t = data.message.type;
  if (t === "image" && data.message.image?.id) {
    return {
      message_id: data.message.id,
      from: data.message.from,
      phone_number_id: data.phone_number_id,
      kind: "image",
      media_id: data.message.image.id,
      mime_type: data.message.image.mime_type ?? null,
      caption: data.message.image.caption ?? null,
    };
  }
  if ((t === "audio" || t === "voice") && (data.message.audio?.id || data.message.voice?.id)) {
    const media = data.message.audio ?? data.message.voice!;
    return {
      message_id: data.message.id,
      from: data.message.from,
      phone_number_id: data.phone_number_id,
      kind: "audio",
      media_id: media.id,
      mime_type: media.mime_type ?? null,
      caption: null,
    };
  }
  return null;
}

// When webhook message buffering is enabled in Kapso, a single delivery
// carries an ARRAY of messages (`data: [...]`) plus a `batch_info` object —
// even for a lone message. With buffering off, `data` is a single object (or
// the body itself is the bare data). Normalize all three shapes into an
// ordered array of message-data records, each with a guaranteed top-level
// `phone_number_id` so the per-message extractors above
// (extractMessageReceived / extractMediaMessage / extractFlowSubmission) work
// on each element unchanged. Unknown event types yield an empty array.
export function extractMessageBatch(
  body: unknown,
): KapsoMessageReceivedData[] {
  if (!body || typeof body !== "object") return [];
  const envelope = body as { event?: string; data?: unknown };
  if (envelope.event && envelope.event !== "whatsapp.message.received") {
    return [];
  }
  const rawItems: unknown[] = Array.isArray(envelope.data)
    ? envelope.data
    : envelope.data
      ? [envelope.data]
      : [body];
  const out: KapsoMessageReceivedData[] = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") continue;
    const d = raw as KapsoMessageReceivedData & {
      whatsapp_config?: { phone_number_id?: string };
    };
    const phone_number_id =
      d.phone_number_id ??
      d.conversation?.phone_number_id ??
      d.whatsapp_config?.phone_number_id;
    if (!d.message || !d.message.from || !phone_number_id) continue;
    out.push({ ...d, phone_number_id });
  }
  return out;
}

export async function sendKapsoTypingIndicator(params: {
  apiKey: string;
  phoneNumberId: string;
  messageId: string;
}): Promise<void> {
  // WhatsApp Cloud API: marking a message as read with a typing_indicator
  // payload shows the "typing…" dots in the user's chat for up to 25 seconds,
  // and is dismissed automatically when we send the real reply. This is the
  // native, lightweight way to signal "buscando…" without an extra message.
  const url = `https://api.kapso.ai/meta/whatsapp/v24.0/${params.phoneNumberId}/messages`;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": params.apiKey,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: params.messageId,
        typing_indicator: { type: "text" },
      }),
    });
  } catch (err) {
    // Typing indicator is purely cosmetic — never let it fail the reply.
    console.error("sendKapsoTypingIndicator failed", err);
  }
}

export async function downloadKapsoMedia(
  apiKey: string,
  mediaId: string,
  phoneNumberId: string,
): Promise<{ bytes: ArrayBuffer; mimeType: string }> {
  // Step 1: ask Meta (via Kapso proxy) for the temporary download URL.
  // Kapso requires phone_number_id as a query param so it knows which
  // WhatsApp Business Account credentials to use.
  const metaRes = await fetch(
    `https://api.kapso.ai/meta/whatsapp/v24.0/${mediaId}?phone_number_id=${encodeURIComponent(phoneNumberId)}`,
    { headers: { "X-API-Key": apiKey } },
  );
  if (!metaRes.ok) {
    const t = await metaRes.text().catch(() => "");
    throw new Error(`Kapso media meta ${metaRes.status}: ${t.slice(0, 200)}`);
  }
  const meta = (await metaRes.json()) as {
    url?: string;
    download_url?: string;
    mime_type?: string;
  };
  // Prefer the Kapso-hosted authenticated download_url (works with X-API-Key);
  // fall back to the raw Meta url if Kapso doesn't return it.
  const fetchUrl = meta.download_url ?? meta.url;
  if (!fetchUrl) {
    throw new Error("Kapso media: missing url in response");
  }
  const blobRes = await fetch(fetchUrl, {
    headers: { "X-API-Key": apiKey },
  });
  if (!blobRes.ok) {
    const t = await blobRes.text().catch(() => "");
    throw new Error(`Kapso media blob ${blobRes.status}: ${t.slice(0, 200)}`);
  }
  return {
    bytes: await blobRes.arrayBuffer(),
    mimeType: meta.mime_type ?? blobRes.headers.get("content-type") ?? "application/octet-stream",
  };
}

export function extractFlowSubmission(body: unknown): FlowSubmission | null {
  const data = unwrapEnvelope(body);
  if (!data) return null;
  if (data.message.type !== "interactive") return null;
  const reply = data.message.interactive?.nfm_reply;
  const raw = reply?.response_json;
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  return {
    from: data.message.from,
    phoneNumberId: data.phone_number_id,
    responseJson: parsed as Record<string, unknown>,
  };
}

export async function verifyKapsoSignature(
  rawBody: string,
  signatureHex: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHex) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const expected = bufferToHex(mac);
  return timingSafeEqualHex(expected, signatureHex);
}

function bufferToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function sendKapsoText(params: {
  apiKey: string;
  phoneNumberId: string;
  to: string;
  body: string;
}): Promise<void> {
  const url = `https://api.kapso.ai/meta/whatsapp/v24.0/${params.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": params.apiKey,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: params.to,
      type: "text",
      text: { body: params.body },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Kapso send failed ${res.status}: ${text}`);
  }
}

export async function sendKapsoCtaUrl(params: {
  apiKey: string;
  phoneNumberId: string;
  to: string;
  bodyText: string;
  buttonText: string;
  url: string;
  headerText?: string;
  footerText?: string;
}): Promise<void> {
  const url = `https://api.kapso.ai/meta/whatsapp/v24.0/${params.phoneNumberId}/messages`;
  const interactive: Record<string, unknown> = {
    type: "cta_url",
    body: { text: params.bodyText.slice(0, 1024) },
    action: {
      name: "cta_url",
      parameters: {
        display_text: params.buttonText.slice(0, 20),
        url: params.url,
      },
    },
  };
  if (params.headerText) {
    interactive.header = { type: "text", text: params.headerText.slice(0, 60) };
  }
  if (params.footerText) {
    interactive.footer = { text: params.footerText.slice(0, 60) };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": params.apiKey,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: params.to,
      type: "interactive",
      interactive,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Kapso CTA url send failed ${res.status}: ${text}`);
  }
}

export async function sendKapsoFlow(params: {
  apiKey: string;
  phoneNumberId: string;
  to: string;
  flowId: string;
  bodyText: string;
  cta: string;
  screen: string;
  draft?: boolean;
}): Promise<void> {
  const url = `https://api.kapso.ai/meta/whatsapp/v24.0/${params.phoneNumberId}/messages`;
  const parameters: Record<string, unknown> = {
    flow_message_version: "3",
    flow_id: params.flowId,
    flow_cta: params.cta,
    flow_action: "navigate",
    flow_action_payload: { screen: params.screen },
  };
  if (params.draft) parameters.mode = "draft";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": params.apiKey,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: params.to,
      type: "interactive",
      interactive: {
        type: "flow",
        body: { text: params.bodyText },
        action: { name: "flow", parameters },
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Kapso flow send failed ${res.status}: ${text}`);
  }
}

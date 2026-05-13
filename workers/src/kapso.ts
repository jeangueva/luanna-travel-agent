export interface KapsoMessage {
  id: string;
  timestamp: string;
  type: string;
  from: string;
  text?: { body?: string };
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

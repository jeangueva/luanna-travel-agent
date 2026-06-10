import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

export interface MultimodalEnv {
  ANTHROPIC_API_KEY: string;
  LUANNA_MODEL?: string;
  AI?: { run: (model: string, input: unknown) => Promise<unknown> };
}

// Haiku 4.5 supports vision and is much less likely to hit "Overloaded"
// (HTTP 529) during peak load. Landmark recognition doesn't need Sonnet.
const VISION_MODEL = "claude-haiku-4-5";

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  // Workers V8 has btoa for binary strings; build it chunk by chunk to avoid
  // call-stack issues on large images.
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, Math.min(i + chunkSize, bytes.length))),
    );
  }
  return btoa(binary);
}

export interface ImageIdentification {
  /** Full text reply from Claude. Either a location guess or "NO_IDENTIFICADO". */
  raw: string;
  /** Cleaned-up one-liner suitable for showing the user. */
  summary: string;
  /** True when the model said it could not identify the location. */
  unknown: boolean;
}

export async function identifyDestinationFromImage(
  env: MultimodalEnv,
  imageBytes: ArrayBuffer,
  mimeType: string,
  caption: string | null,
): Promise<ImageIdentification> {
  const base64 = arrayBufferToBase64(imageBytes);
  const dataUrl = `data:${mimeType};base64,${base64}`;
  const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const model = anthropic(env.LUANNA_MODEL ?? VISION_MODEL);
  const captionLine = caption
    ? `\nCaption del usuario: "${caption.slice(0, 200)}"`
    : "";
  const { text } = await generateText({
    model,
    system:
      "Eres Luanna, experta en geografía y viajes. Te paso una foto que un usuario mandó por WhatsApp. " +
      "Tu trabajo: identificar en una sola frase corta dónde es (ciudad, país) si reconoces el lugar. " +
      "Si reconoces un destino o landmark famoso (Machu Picchu, Torre Eiffel, Big Ben, Cristo Redentor, etc.), nombralo. " +
      "Si parece un lugar más genérico (playa, montaña, ciudad sin landmarks distintivos), descríbelo así pero NO inventes coordenadas. " +
      "Si la foto no es de un destino turístico (selfie, comida sin contexto, screenshot random), responde EXACTAMENTE: NO_IDENTIFICADO\n" +
      "Formato: una sola línea. No saludes ni expliques.",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "¿Qué lugar es esta foto?" + captionLine },
          { type: "image", image: dataUrl },
        ],
      },
    ],
  });
  const raw = (text || "").trim();
  const unknown = /NO_IDENTIFICADO/i.test(raw) || raw.length < 4;
  const summary = unknown
    ? "No logré identificar el lugar"
    : raw.replace(/^["']|["']$/g, "").slice(0, 200);
  return { raw, summary, unknown };
}

export interface AudioTranscript {
  text: string;
  duration_seconds?: number;
  // ISO-639-1 code Whisper detected (e.g. "es", "en", "pt"). undefined if
  // the model didn't report one.
  language?: string;
}

export async function transcribeAudio(
  env: MultimodalEnv,
  audioBytes: ArrayBuffer,
): Promise<AudioTranscript> {
  if (!env.AI) {
    throw new Error("Workers AI binding (AI) is not configured");
  }
  // whisper-large-v3-turbo handles OGG/Opus (WhatsApp voice format). We DON'T
  // pin a language: Luanna serves Spanish, English and Portuguese speakers, so
  // we let Whisper auto-detect — pinning "es" mangled English/Portuguese notes
  // into garbage Spanish. The initial_prompt is just language-neutral proper
  // nouns (place names) to bias spelling without biasing the detected language.
  const base64 = arrayBufferToBase64(audioBytes);
  const result = (await env.AI.run("@cf/openai/whisper-large-v3-turbo", {
    audio: base64,
    task: "transcribe",
    initial_prompt:
      "Luanna. Lima, Madrid, Cancún, Cartagena, Cusco, Buenos Aires, Barcelona, Tokyo, São Paulo, Rio de Janeiro, Miami.",
  })) as {
    text?: string;
    transcription_info?: { duration?: number; language?: string };
    language?: string;
  };
  const text = (result.text ?? "").trim();
  const language =
    result.transcription_info?.language ?? result.language ?? undefined;
  return {
    text,
    duration_seconds:
      typeof result.transcription_info?.duration === "number"
        ? result.transcription_info.duration
        : undefined,
    language:
      typeof language === "string" ? language.slice(0, 5).toLowerCase() : undefined,
  };
}

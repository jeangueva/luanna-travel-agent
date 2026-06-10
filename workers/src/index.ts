import { createAnthropic } from "@ai-sdk/anthropic";
import {
  generateText,
  stepCountIs,
  streamText,
  type ModelMessage,
} from "ai";
import {
  downloadKapsoMedia,
  extractFlowSubmission,
  extractMediaMessage,
  extractMessageBatch,
  extractMessageReceived,
  type MediaMessage,
  sendKapsoCtaUrl,
  sendKapsoSticker,
  sendKapsoFlow,
  sendKapsoText,
  sendKapsoTypingIndicator,
  verifyKapsoSignature,
} from "./kapso";
import {
  identifyDestinationFromImage,
  transcribeAudio,
} from "./multimodal";
import {
  addWatchlistItem,
  appendMessage,
  checkRateLimit,
  consumeClickRedirect,
  countReferralsFor,
  createDataDeletionRequest,
  deleteWatchlistItem,
  ensureReferralCode,
  findReferrerByCode,
  getDashboardStats,
  getDb,
  getOrCreateUser,
  getPreferences,
  getRecentMessages,
  getUserWatchlist,
  completeLinkCode,
  createLinkCode,
  findLinkCode,
  listPendingDeletionRequests,
  listRecentErrors,
  listRecentFeedback,
  mergeWebUserInto,
  processDeletionRequest,
  recordError,
  recordFeedback,
  recordWebhookOrSkip,
  resetInactivityNudgeCount,
  setReferredBy,
  type FeedbackKind,
  upsertPreferences,
  type Message,
  type Preferences,
  type RateLimitResult,
} from "./db";
import { renderAdminDashboardPage, renderAdminLoginPage } from "./admin";
import {
  CHAT_MESSAGE_MAX,
  PREFS_ORIGIN_MAX,
  clampBudget,
  cleanStringArray,
} from "./validators";
import { distinctIdForUser, track, trackBatch } from "./posthog";
import { buildLuannaSystemPrompt } from "./prompt";
import {
  makeAddFavoritePlacesTool,
  makeAddWatchlistTool,
  makeFlightSearchTool,
  makeHotelSearchTool,
  makePackageLinkTool,
  makePreferencesCtaTool,
  makePreferencesFlowTool,
  makePreferencesLinkTool,
  makeRemoveFavoritePlacesTool,
  makeSaveUserNameTool,
  makeSendStickerTool,
  makeSuggestItineraryTool,
} from "./tools";
import {
  createChatToken,
  createWebviewToken,
  verifyChatToken,
  verifyWebviewToken,
} from "./auth";
import { renderPreferencesPage } from "./webview";
import {
  runCleanupCron,
  runDailyOffersCron,
  runErrorAlertCron,
  runReEngagementCron,
  runWatchlistCron,
} from "./cron";

export interface Env {
  ANTHROPIC_API_KEY: string;
  KAPSO_WEBHOOK_SECRET: string;
  KAPSO_API_KEY: string;
  KAPSO_PREFS_FLOW_ID?: string;
  KAPSO_PREFS_FLOW_DRAFT?: string;
  KAPSO_PREFS_FLOWS_ENABLED?: string;
  DATABASE_URL: string;
  TRAVELPAYOUTS_TOKEN: string;
  TRAVELPAYOUTS_MARKER: string;
  WEBVIEW_SIGNING_KEY: string;
  LUANNA_MODEL?: string;
  ADMIN_API_KEY?: string;
  ALERT_WEBHOOK_URL?: string;
  POSTHOG_API_KEY?: string;
  POSTHOG_HOST?: string;
  PUBLIC_BASE_URL?: string;
  LUANNA_WHATSAPP_NUMBER?: string;
  ASSETS: Fetcher;
  AI?: { run: (model: string, input: unknown) => Promise<unknown> };
}

const DEFAULT_MODEL = "claude-haiku-4-5";

interface ReplyContext {
  userId: number;
  baseUrl: string;
  history: Message[];
  sql: ReturnType<typeof getDb>;
  to?: string;
  phoneNumberId?: string;
  userName?: string | null;
  isFirstContact?: boolean;
  userPrefs?: Preferences | null;
}

const TRAVELPAYOUTS_HOSTS = new Set([
  "www.aviasales.com",
  "aviasales.com",
  "search.hotellook.com",
  "hotellook.com",
  "tp.media",
]);

/**
 * Only let URLs on our own domain reach the user. Tools wrap every
 * affiliate URL through wrapClickUrl into a luanna.app/r/<id> short link,
 * so anything else in the LLM output is either a hallucination, an echo
 * of stale chat history, or a path we forgot to wrap. Stripping is the
 * safe default — a missing URL is recoverable, a 200-char Aviasales URL
 * blasted to WhatsApp is not.
 */
function sanitizeReply(text: string, baseUrl: string): string {
  const allowedHost = new URL(baseUrl).host;
  return text.replace(/https?:\/\/[^\s)]+/g, (url) => {
    try {
      const host = new URL(url).host;
      if (host === allowedHost) return url;
      // Travelpayouts hosts used to be allowed inline. Now we strip them so
      // long affiliate URLs can never reach the user — the tool result
      // already provides a wrapped luanna.app URL the model should use.
      if (TRAVELPAYOUTS_HOSTS.has(host)) return "";
      return "";
    } catch {
      return "";
    }
  });
}

const PREFS_INTENT_RE =
  /\b(configura|configurar|preferencia|preferencias|gustos|perfil|prefer)\b/i;

function buildFirstContactWelcome(): string {
  return [
    "¡Hola! ✈️ Soy Luanna, tu agente de viajes en WhatsApp.",
    "¿Cómo te llamas? 😊",
    "",
    "Te puedo ayudar con:",
    "🔹 Vuelos baratos",
    "🔹 Hoteles",
    "🔹 Paquetes vuelo+hotel",
    "🔹 Alertas cuando bajen precios",
    "",
    "Dime a dónde quieres ir y desde qué ciudad sales, ¡y te busco vuelos al toque! 🔎",
  ].join("\n");
}

async function generateReply(
  env: Env,
  userMessage: string,
  ctx: ReplyContext,
): Promise<string> {
  const flowEnabled =
    env.KAPSO_PREFS_FLOWS_ENABLED === "1" &&
    !!env.KAPSO_PREFS_FLOW_ID &&
    !!ctx.to &&
    !!ctx.phoneNumberId;

  const inWhatsApp = !!ctx.to && !!ctx.phoneNumberId;

  // First contact: deterministic welcome that greets, asks the name, and
  // invites the user to search flights. We DON'T push the preferences form
  // here anymore — it's surfaced on demand (PREFS_INTENT below) and in the
  // re-engagement nudges instead, so the first message stays light.
  if (ctx.isFirstContact && ctx.userId > 0) {
    // Send the welcome sticker first (cosmetic, never blocks the greeting).
    if (inWhatsApp) {
      await sendKapsoSticker({
        apiKey: env.KAPSO_API_KEY,
        phoneNumberId: ctx.phoneNumberId!,
        to: ctx.to!,
        link: `${ctx.baseUrl}/stickers/welcome.webp`,
      });
    }
    return buildFirstContactWelcome();
  }

  if (PREFS_INTENT_RE.test(userMessage)) {
    if (flowEnabled) {
      await sendKapsoFlow({
        apiKey: env.KAPSO_API_KEY,
        phoneNumberId: ctx.phoneNumberId!,
        to: ctx.to!,
        flowId: env.KAPSO_PREFS_FLOW_ID!,
        bodyText: "Configura tus preferencias para que te recomiende mejor 🎯",
        cta: "Configurar",
        screen: "PREFERENCES",
        draft: env.KAPSO_PREFS_FLOW_DRAFT === "1",
      });
      return "Listo 👆";
    }
    if (ctx.userId > 0) {
      const token = await createWebviewToken(ctx.userId, env.WEBVIEW_SIGNING_KEY);
      const url = `${ctx.baseUrl}/webview/prefs?token=${encodeURIComponent(token)}`;
      if (inWhatsApp) {
        try {
          await sendKapsoCtaUrl({
            apiKey: env.KAPSO_API_KEY,
            phoneNumberId: ctx.phoneNumberId!,
            to: ctx.to!,
            bodyText: "Acá puedes editar tus preferencias y alertas 🎯",
            buttonText: "Abrir panel",
            url,
            footerText: "Solo tú puedes ver este link",
          });
          return "Listo 👆";
        } catch (err) {
          console.error("prefs-intent CTA url failed, falling back to text", err);
        }
      }
      return `Configura tus gustos acá: ${url}`;
    }
  }

  const llmArgs = buildLLMArgs(env, userMessage, ctx, flowEnabled, inWhatsApp);
  const result = await generateText(llmArgs);
  // PostHog tracking is fire-and-forget — never block the user's reply on
  // analytics. Errors swallowed (analytics SDK has its own retry).
  if (ctx.userId > 0) {
    const toolEvents = collectToolEvents(
      result as unknown as { steps?: ToolCallStep[] },
      ctx.userId,
    );
    if (toolEvents.length > 0) {
      trackBatch(env, toolEvents).catch((err) =>
        console.error("trackBatch failed", err),
      );
    }
  }
  return sanitizeReply(result.text, ctx.baseUrl).trim();
}

/**
 * Build the args for either generateText or streamText. Centralizes the
 * model / tools / system / messages plumbing so the streaming and non-
 * streaming paths can't drift apart.
 */
function buildLLMArgs(
  env: Env,
  userMessage: string,
  ctx: ReplyContext,
  flowEnabled: boolean,
  inWhatsApp: boolean,
) {
  const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const model = anthropic(env.LUANNA_MODEL ?? DEFAULT_MODEL);
  const messages: ModelMessage[] = [
    ...ctx.history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: userMessage },
  ];
  const tpEnv = {
    TRAVELPAYOUTS_TOKEN: env.TRAVELPAYOUTS_TOKEN,
    TRAVELPAYOUTS_MARKER: env.TRAVELPAYOUTS_MARKER,
  };
  const clickCtx = ctx.userId > 0
    ? { sql: ctx.sql, userId: ctx.userId, baseUrl: ctx.baseUrl }
    : undefined;
  const tools = {
    search_flights: makeFlightSearchTool(tpEnv, clickCtx),
    search_hotels: makeHotelSearchTool(tpEnv, clickCtx),
    get_package_link: makePackageLinkTool(tpEnv, clickCtx),
    suggest_itinerary: makeSuggestItineraryTool(),
    ...(flowEnabled
      ? {
          open_preferences_form: makePreferencesFlowTool({
            apiKey: env.KAPSO_API_KEY,
            phoneNumberId: ctx.phoneNumberId!,
            to: ctx.to!,
            flowId: env.KAPSO_PREFS_FLOW_ID!,
            draft: env.KAPSO_PREFS_FLOW_DRAFT === "1",
          }),
        }
      : inWhatsApp
        ? {
            open_preferences_form: makePreferencesCtaTool({
              apiKey: env.KAPSO_API_KEY,
              phoneNumberId: ctx.phoneNumberId!,
              to: ctx.to!,
              userId: ctx.userId,
              baseUrl: ctx.baseUrl,
              signingKey: env.WEBVIEW_SIGNING_KEY,
            }),
          }
        : {
            get_preferences_link: makePreferencesLinkTool({
              userId: ctx.userId,
              baseUrl: ctx.baseUrl,
              signingKey: env.WEBVIEW_SIGNING_KEY,
            }),
          }),
    add_watchlist: makeAddWatchlistTool({
      sql: ctx.sql,
      userId: ctx.userId,
    }),
    add_favorite_places: makeAddFavoritePlacesTool({
      sql: ctx.sql,
      userId: ctx.userId,
    }),
    remove_favorite_places: makeRemoveFavoritePlacesTool({
      sql: ctx.sql,
      userId: ctx.userId,
    }),
    save_user_name: makeSaveUserNameTool({
      sql: ctx.sql,
      userId: ctx.userId,
    }),
    // Stickers only make sense in WhatsApp (need a real recipient + phone id).
    ...(inWhatsApp
      ? {
          send_sticker: makeSendStickerTool({
            apiKey: env.KAPSO_API_KEY,
            phoneNumberId: ctx.phoneNumberId!,
            to: ctx.to!,
            baseUrl: ctx.baseUrl,
          }),
        }
      : {}),
  };
  return {
    model,
    system: buildLuannaSystemPrompt({
      now: new Date(),
      userName: ctx.userName ?? null,
      isFirstContact: ctx.isFirstContact ?? false,
      userOrigin: ctx.userPrefs?.origin ?? null,
      userCountries: ctx.userPrefs?.countries ?? [],
      userCities: ctx.userPrefs?.cities ?? [],
      userStyles: ctx.userPrefs?.styles ?? [],
    }),
    messages,
    tools,
    // 3 steps is plenty for the typical flow: one tool call + one reply.
    // Capping lower than 5 saves a roundtrip when the model wanders.
    stopWhen: stepCountIs(3),
  };
}

/**
 * Streaming sibling of generateReply for the web chat's text-only path.
 * Returns a ReadableStream of plain-text chunks the frontend can append to
 * the message bubble token-by-token. The full text is committed to Postgres
 * via onFinish so we don't block the stream on the persist roundtrip.
 *
 * IMPORTANT: handleChat must call this ONLY when none of the early-return
 * paths in generateReply apply (no first-contact, no prefs intent). Those
 * paths return short strings synthesized by the worker, not LLM tokens,
 * and streaming them would just add overhead.
 */
function streamReply(
  env: Env,
  userMessage: string,
  ctx: ReplyContext,
): Response {
  const flowEnabled =
    env.KAPSO_PREFS_FLOWS_ENABLED === "1" &&
    !!env.KAPSO_PREFS_FLOW_ID &&
    !!ctx.to &&
    !!ctx.phoneNumberId;
  const inWhatsApp = !!ctx.to && !!ctx.phoneNumberId;
  const args = buildLLMArgs(env, userMessage, ctx, flowEnabled, inWhatsApp);
  const baseUrl = ctx.baseUrl;
  const sql = ctx.sql;
  const userId = ctx.userId;
  const result = streamText({
    ...args,
    onFinish: ({ text, steps }) => {
      const sanitized = sanitizeReply(text, baseUrl).trim();
      if (sanitized && userId > 0) {
        appendMessage(sql, userId, "assistant", sanitized).catch((err) =>
          console.error("appendMessage assistant (stream) failed", err),
        );
      }
      if (userId > 0) {
        const toolEvents = collectToolEvents(
          { steps } as unknown as { steps?: ToolCallStep[] },
          userId,
        );
        if (toolEvents.length > 0) {
          trackBatch(env, toolEvents).catch((err) =>
            console.error("trackBatch (stream) failed", err),
          );
        }
      }
    },
  });
  return result.toTextStreamResponse();
}

interface ToolCallStep {
  toolCalls?: Array<{
    toolName?: string;
    input?: unknown;
    args?: unknown;
  }>;
}

function collectToolEvents(
  result: { steps?: ToolCallStep[] },
  userId: number,
): Array<{
  event: string;
  distinct_id: string;
  properties?: Record<string, unknown>;
}> {
  const events: ReturnType<typeof collectToolEvents> = [];
  for (const step of result.steps ?? []) {
    for (const call of step.toolCalls ?? []) {
      if (!call?.toolName) continue;
      const args = (call.input ?? call.args ?? {}) as Record<string, unknown>;
      events.push({
        event: "tool_called",
        distinct_id: distinctIdForUser(userId),
        properties: {
          tool_name: call.toolName,
          ...sanitizeToolArgs(args),
        },
      });
    }
  }
  return events;
}

function sanitizeToolArgs(args: Record<string, unknown>): Record<string, unknown> {
  // Drop the user's free-text message body if present and trim string args
  // so we don't ship raw PII or oversized strings into analytics.
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === "string") {
      out[k] = v.slice(0, 80);
    } else if (typeof v === "number" || typeof v === "boolean" || v === null) {
      out[k] = v;
    } else if (Array.isArray(v)) {
      out[k + "_count"] = v.length;
    } else if (v && typeof v === "object") {
      // skip nested objects
    } else {
      out[k] = v;
    }
  }
  return out;
}

type WebhookSql = ReturnType<typeof getDb>;

interface IncomingMessage {
  id: string;
  text: string | null;
  media: MediaMessage | null;
}

// Resolve one incoming message (text / image / audio) into a plain-text
// fragment for the LLM. Media items do their heavy lifting here (vision /
// Whisper). On media failure or an empty/unidentifiable result we send the
// user a per-item fallback, persist it, and return null so the caller skips
// this fragment (the rest of the burst still gets answered).
async function resolveIncomingText(
  env: Env,
  sql: WebhookSql,
  item: IncomingMessage,
  userId: number,
  phone_number_id: string,
  from: string,
  distinctId: string,
): Promise<{ text: string; kind: "text" | "image" | "audio" } | null> {
  if (item.text) {
    return { text: item.text, kind: "text" };
  }
  const media = item.media;
  if (!media) return null;

  if (media.kind === "image") {
    try {
      const blob = await downloadKapsoMedia(env.KAPSO_API_KEY, media.media_id, phone_number_id);
      const ident = await identifyDestinationFromImage(
        env,
        blob.bytes,
        blob.mimeType,
        media.caption,
      );
      await track(env, {
        event: "image_identified",
        distinct_id: distinctId,
        properties: { unknown: ident.unknown, summary_length: ident.summary.length },
      });
      if (ident.unknown) {
        const fallback = "Recibí tu foto 🤔 pero no logré identificar dónde es. ¿Me cuentas qué lugar es?";
        await appendMessage(sql, userId, "user", `[foto recibida]${media.caption ? ` "${media.caption}"` : ""}`);
        await appendMessage(sql, userId, "assistant", fallback);
        await sendKapsoText({
          apiKey: env.KAPSO_API_KEY,
          phoneNumberId: phone_number_id,
          to: from,
          body: fallback,
        });
        return null;
      }
      const text =
        `[El usuario mandó una foto. Identifiqué el lugar como: ${ident.summary}.` +
        (media.caption ? ` Caption del usuario: "${media.caption}".` : "") +
        ` Tu trabajo: confirmar entusiasmada el destino, preguntarle si quiere que busques vuelos/hotel/paquete desde su origen, e impulsar la conversación. NO le digas que "identificaste una foto" textualmente — habla como si supieras del lugar.]`;
      return { text, kind: "image" };
    } catch (err) {
      console.error("image processing failed", err);
      await recordError(sql, "webhook:image", err, { user_id: userId, media_id: media.media_id });
      const fallback = "Recibí tu foto pero tuve un problema procesándola 😬 ¿Me cuentas qué lugar es?";
      await appendMessage(sql, userId, "assistant", fallback);
      await sendKapsoText({
        apiKey: env.KAPSO_API_KEY,
        phoneNumberId: phone_number_id,
        to: from,
        body: fallback,
      });
      return null;
    }
  }

  // audio / voice
  try {
    const blob = await downloadKapsoMedia(env.KAPSO_API_KEY, media.media_id, phone_number_id);
    const transcript = await transcribeAudio(env, blob.bytes);
    await track(env, {
      event: "audio_transcribed",
      distinct_id: distinctId,
      properties: {
        text_length: transcript.text.length,
        duration_seconds: transcript.duration_seconds ?? null,
      },
    });
    if (!transcript.text || transcript.text.length < 2) {
      const fallback = "No te escuché bien 😅 ¿Lo intentas otra vez o me lo escribes?";
      await appendMessage(sql, userId, "user", "[audio inaudible]");
      await appendMessage(sql, userId, "assistant", fallback);
      await sendKapsoText({
        apiKey: env.KAPSO_API_KEY,
        phoneNumberId: phone_number_id,
        to: from,
        body: fallback,
      });
      return null;
    }
    return { text: transcript.text, kind: "audio" };
  } catch (err) {
    console.error("audio processing failed", err);
    await recordError(sql, "webhook:audio", err, { user_id: userId, media_id: media.media_id });
    const fallback = "Recibí tu audio pero tuve un problema escuchándolo 😬 ¿Lo intentas otra vez o me escribes?";
    await appendMessage(sql, userId, "assistant", fallback);
    await sendKapsoText({
      apiKey: env.KAPSO_API_KEY,
      phoneNumberId: phone_number_id,
      to: from,
      body: fallback,
    });
    return null;
  }
}

async function handleKapsoWebhook(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get("X-Webhook-Signature");

  const valid = await verifyKapsoSignature(
    rawBody,
    signature,
    env.KAPSO_WEBHOOK_SECRET,
  );
  if (!valid) return new Response("invalid signature", { status: 401 });

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  // Kapso delivers either a single message (`data: {...}`) or, when webhook
  // buffering is enabled, a batch (`data: [...]`) — even a lone message arrives
  // as a 1-element batch. Normalizing to an array lets us process a burst of
  // rapid messages as ONE conversational turn instead of racing N overlapping
  // LLM calls (or dropping all but the first, which the old single-message
  // parse did).
  const batch = extractMessageBatch(payload);
  if (batch.length === 0) {
    return new Response("ignored", { status: 200 });
  }

  const phone_number_id = batch[0].phone_number_id;
  const from = batch[0].message.from;
  const baseUrl = new URL(request.url).origin;

  // Flow (preferences form) submissions are their own turn — handle each
  // independently, never merged into the conversational text.
  for (const item of batch) {
    const submission = extractFlowSubmission(item);
    if (submission) {
      ctx.waitUntil(handleFlowSubmission(env, submission));
    }
  }

  // Collect the conversational messages (text + media), de-duplicated by wamid
  // so a Kapso retry of the whole batch never double-replies. Heavy multimodal
  // work (vision + Whisper) happens later INSIDE ctx.waitUntil so we still ack
  // the webhook in <500ms.
  const dedupeSql = getDb(env.DATABASE_URL);
  const incoming: IncomingMessage[] = [];
  for (const item of batch) {
    const data = extractMessageReceived(item);
    const media = data ? null : extractMediaMessage(item);
    if (!data && !media) continue; // flow / unsupported type
    const text = data ? data.message.text?.body?.trim() ?? null : null;
    if (data && !text) continue; // empty text body
    const id = data ? data.message.id : media!.message_id;
    const fresh = await recordWebhookOrSkip(dedupeSql, id);
    if (!fresh) {
      console.log("kapso webhook duplicate", id);
      continue;
    }
    incoming.push({ id, text, media });
  }

  if (incoming.length === 0) {
    return new Response("ok", { status: 200 });
  }

  // Typing indicator + error logging anchor on the most recent message.
  const message_id = incoming[incoming.length - 1].id;

  // Fire WhatsApp's native typing indicator immediately so the user sees
  // the typing dots while we're transcribing audio, vision-identifying
  // photos, or fanning out flight searches. Auto-dismisses on real reply.
  ctx.waitUntil(
    sendKapsoTypingIndicator({
      apiKey: env.KAPSO_API_KEY,
      phoneNumberId: phone_number_id,
      messageId: message_id,
    }),
  );

  ctx.waitUntil(
    (async () => {
      try {
        const sql = getDb(env.DATABASE_URL);
        const user = await getOrCreateUser(sql, from, phone_number_id);
        // Parallelize the three independent post-user-fetch DB roundtrips.
        // None of them depend on each other and they all hit the same Neon
        // connection — saves ~300ms vs the sequential chain.
        const [history] = await Promise.all([
          getRecentMessages(sql, user.id),
          ensureReferralCode(sql, user.id).catch(() => null),
          resetInactivityNudgeCount(sql, user.id).catch(() => undefined),
        ]);
        const isFirstContact = history.length === 0;
        const distinctId = distinctIdForUser(user.id);

        // ── Resolve every batched message (text / image / audio) and merge
        // the fragments into ONE turn. Media failures send their own per-item
        // fallback and contribute no fragment. If the batch mixes media kinds,
        // sourceKind reflects the last non-text item (analytics only).
        const fragments: string[] = [];
        let sourceKind: "text" | "image" | "audio" = "text";
        for (const item of incoming) {
          const resolved = await resolveIncomingText(
            env,
            sql,
            item,
            user.id,
            phone_number_id,
            from,
            distinctId,
          );
          if (!resolved) continue;
          fragments.push(resolved.text);
          if (resolved.kind !== "text") sourceKind = resolved.kind;
        }

        let resolvedText = fragments.join("\n").trim();
        if (!resolvedText) return;

        // ── Magic-link merge intercept (skip LLM, merge web user) ──────
        // Match "vincular ABCDxyz" or "link ABCDxyz" — the user copy-paste
        // arrives here from the wa.me CTA fired by /chat. We're conservative:
        // require the verb at the START of the message and a known code in
        // link_codes. Anything else falls through to the LLM.
        const linkMatch = resolvedText.match(
          /^\s*(?:vincular|link)\s+([A-Za-z0-9]{4,16})\b/i,
        );
        if (linkMatch) {
          const code = linkMatch[1];
          const linkRow = await findLinkCode(sql, code).catch(() => null);
          let ack: string;
          if (!linkRow) {
            ack = "No reconocí ese código de vinculación 🤔 Asegúrate de copiarlo desde el chat web.";
          } else if (linkRow.status !== "pending") {
            ack = "Ese código ya fue usado o expiró ⏰ Pide uno nuevo desde el chat web.";
          } else if (new Date(linkRow.expires_at).getTime() < Date.now()) {
            ack = "Ese código ya expiró ⏰ Pide uno nuevo desde el chat web.";
          } else if (linkRow.web_user_id === user.id) {
            ack = "Ya estás vinculado a este número 🙌";
          } else {
            try {
              await mergeWebUserInto(sql, linkRow.web_user_id, user.id);
              await completeLinkCode(sql, code, user.id);
              await track(env, {
                event: "web_linked_to_whatsapp",
                distinct_id: distinctId,
                properties: { code, web_user_id: linkRow.web_user_id },
              });
              ack = "¡Listo! 🙌 Tu chat web quedó vinculado a este número. Tus preferencias y conversación ahora viven acá ✨";
            } catch (err) {
              console.error("merge failed", err);
              await recordError(sql, "webhook:link_merge", err, {
                code,
                web_user_id: linkRow.web_user_id,
                target_user_id: user.id,
              });
              ack = "Tuve un problema vinculando tu chat web 😬 Intenta otra vez en un minuto.";
            }
          }
          await appendMessage(sql, user.id, "user", resolvedText);
          await appendMessage(sql, user.id, "assistant", ack);
          await sendKapsoText({
            apiKey: env.KAPSO_API_KEY,
            phoneNumberId: phone_number_id,
            to: from,
            body: ack,
          });
          return;
        }

        // ── /feedback intercept (skip LLM, record + ack) ──────────────
        const feedbackMatch = resolvedText.match(
          /^\s*\/(feedback|bug|idea)\b\s*(.*)$/is,
        );
        if (feedbackMatch) {
          const cmd = feedbackMatch[1].toLowerCase();
          const body = (feedbackMatch[2] || "").trim();
          const kind: FeedbackKind =
            cmd === "bug" ? "bug" : cmd === "idea" ? "idea" : "other";
          if (!body) {
            const ask =
              cmd === "bug"
                ? "Cuéntame qué falló y te lo paso al equipo. Escribe: `/bug <lo que pasó>` 🐞"
                : cmd === "idea"
                  ? "¡Cuéntame tu idea! Escribe: `/idea <tu sugerencia>` 💡"
                  : "¡Mándame tu feedback! Escribe: `/feedback <lo que quieras contarme>` ✨";
            await appendMessage(sql, user.id, "user", resolvedText);
            await appendMessage(sql, user.id, "assistant", ask);
            await sendKapsoText({
              apiKey: env.KAPSO_API_KEY,
              phoneNumberId: phone_number_id,
              to: from,
              body: ask,
            });
            return;
          }
          await recordFeedback(sql, user.id, kind, body, "whatsapp");
          await track(env, {
            event: "feedback_submitted",
            distinct_id: distinctId,
            properties: { kind, length: body.length },
          });
          const ack =
            kind === "bug"
              ? "Anotado 🐞 Lo paso al equipo y lo revisamos. ¡Gracias por ayudar a hacer Luanna mejor!"
              : kind === "idea"
                ? "¡Buenísima idea! 💡 Queda anotada. Gracias por compartirla 🙌"
                : "¡Gracias por el feedback! ✨ Lo leemos y nos ayuda muchísimo. 🙌";
          await appendMessage(sql, user.id, "user", resolvedText);
          await appendMessage(sql, user.id, "assistant", ack);
          await sendKapsoText({
            apiKey: env.KAPSO_API_KEY,
            phoneNumberId: phone_number_id,
            to: from,
            body: ack,
          });
          return;
        }

        // ── Referral linking on first contact ──────────────────────────
        if (isFirstContact) {
          const refMatch = resolvedText.match(/(?:^|\s)ref:([A-Za-z0-9]{4,20})\b/i);
          if (refMatch) {
            try {
              const ref = await findReferrerByCode(sql, refMatch[1]);
              if (ref && ref.referrer_id !== user.id) {
                const linked = await setReferredBy(sql, user.id, ref.referrer_id);
                if (linked) {
                  await track(env, {
                    event: "referred_signup",
                    distinct_id: distinctId,
                    properties: { referrer_id: ref.referrer_id, code: refMatch[1] },
                  });
                }
              }
            } catch (e) { /* never break the reply */ }
            resolvedText = resolvedText.replace(/(?:^|\s)ref:[A-Za-z0-9]{4,20}\b/i, "").trim();
            if (!resolvedText) resolvedText = "Hola";
          }
        }

        // ── Standard pipeline ──────────────────────────────────────────
        if (isFirstContact) {
          await track(env, {
            event: "user_signed_up",
            distinct_id: distinctId,
            properties: { source: "whatsapp" },
          });
        }
        await track(env, {
          event: "message_received",
          distinct_id: distinctId,
          properties: {
            source: "whatsapp",
            source_kind: sourceKind,
            is_first_contact: isFirstContact,
            has_name: !!user.name,
            length: resolvedText.length,
          },
        });
        // appendMessage(user) and getPreferences both touch Neon and don't
        // depend on each other — fire in parallel.
        const [, userPrefs] = await Promise.all([
          appendMessage(sql, user.id, "user", resolvedText),
          getPreferences(sql, user.id).catch(() => null),
        ]);
        const reply = await generateReply(env, resolvedText, {
          userId: user.id,
          baseUrl,
          history,
          sql,
          to: from,
          phoneNumberId: phone_number_id,
          userName: user.name,
          isFirstContact,
          userPrefs,
        });
        if (reply.trim()) {
          // Send the reply FIRST (user sees it immediately), then persist the
          // assistant turn. We MUST await the persist: a fire-and-forget write
          // races worker termination — once this async IIFE resolves, the
          // ctx.waitUntil promise settles and the runtime can kill the
          // invocation before a dangling DB write lands. That dropped the
          // assistant turns from history, so the bot never "saw" its own
          // replies and repeated itself / lost context.
          await sendKapsoText({
            apiKey: env.KAPSO_API_KEY,
            phoneNumberId: phone_number_id,
            to: from,
            body: reply,
          });
          await appendMessage(sql, user.id, "assistant", reply).catch((err) =>
            console.error("appendMessage assistant failed", err),
          );
        }
      } catch (err) {
        console.error("kapso handler error", err);
        await recordError(getDb(env.DATABASE_URL), "webhook:kapso", err, {
          from,
          phone_number_id,
          message_id,
        });
      }
    })(),
  );

  return new Response("ok", { status: 200 });
}

function parseCsvList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v) => typeof v === "string" && v.trim()).map((v) =>
      (v as string).trim(),
    );
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.trim());
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

async function handleFlowSubmission(
  env: Env,
  submission: {
    from: string;
    phoneNumberId: string;
    responseJson: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const sql = getDb(env.DATABASE_URL);
    const user = await getOrCreateUser(
      sql,
      submission.from,
      submission.phoneNumberId,
    );
    const r = submission.responseJson;
    const prefs = {
      origin:
        typeof r.origin === "string" && r.origin.trim()
          ? r.origin.trim().slice(0, PREFS_ORIGIN_MAX)
          : null,
      countries: cleanStringArray(parseCsvList(r.countries)),
      cities: cleanStringArray(parseCsvList(r.cities)),
      styles: cleanStringArray(parseCsvList(r.styles)),
      budget_min: clampBudget(parseNumber(r.budget_min)),
      budget_max: clampBudget(parseNumber(r.budget_max)),
      budget_currency: "USD",
    };
    await upsertPreferences(sql, user.id, prefs);
    await track(env, {
      event: "preferences_saved",
      distinct_id: distinctIdForUser(user.id),
      properties: {
        source: "whatsapp_flow",
        has_origin: !!prefs.origin,
        countries_count: prefs.countries.length,
        cities_count: prefs.cities.length,
        styles_count: prefs.styles.length,
        has_budget: prefs.budget_min != null || prefs.budget_max != null,
      },
    });
    const summary = buildPrefsSummary(prefs);
    const ackText = `Listo, guardé tus preferencias ✓${summary ? `\n${summary}` : ""}`;
    await appendMessage(sql, user.id, "assistant", ackText);
    await sendKapsoText({
      apiKey: env.KAPSO_API_KEY,
      phoneNumberId: submission.phoneNumberId,
      to: submission.from,
      body: ackText,
    });
  } catch (err) {
    console.error("flow submission error", err);
    await recordError(getDb(env.DATABASE_URL), "webhook:flow", err, {
      from: submission.from,
      phone_number_id: submission.phoneNumberId,
    });
  }
}

function buildPrefsSummary(prefs: {
  origin: string | null;
  countries: string[];
  cities: string[];
  styles: string[];
  budget_min: number | null;
  budget_max: number | null;
}): string {
  const parts: string[] = [];
  if (prefs.origin) parts.push(`Origen: ${prefs.origin}`);
  if (prefs.countries.length)
    parts.push(`Países: ${prefs.countries.join(", ")}`);
  if (prefs.cities.length) parts.push(`Ciudades: ${prefs.cities.join(", ")}`);
  if (prefs.budget_min != null || prefs.budget_max != null) {
    const min = prefs.budget_min != null ? `$${prefs.budget_min}` : "?";
    const max = prefs.budget_max != null ? `$${prefs.budget_max}` : "?";
    parts.push(`Presupuesto: ${min}–${max}`);
  }
  if (prefs.styles.length) parts.push(`Estilo: ${prefs.styles.join(", ")}`);
  return parts.join(" · ");
}

async function handleWebviewPrefs(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return new Response("missing token", { status: 400 });
  const userId = await verifyWebviewToken(token, env.WEBVIEW_SIGNING_KEY);
  if (!userId) return new Response("invalid or expired token", { status: 401 });
  return new Response(renderPreferencesPage(token), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

async function handleApiMe(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token)
    return Response.json({ error: "missing token" }, { status: 400 });
  const userId = await verifyWebviewToken(token, env.WEBVIEW_SIGNING_KEY);
  if (!userId)
    return Response.json(
      { error: "invalid or expired token" },
      { status: 401 },
    );
  const sql = getDb(env.DATABASE_URL);

  if (request.method === "GET") {
    const rows = (await sql`
      SELECT name, phone FROM users WHERE id = ${userId}
    `) as Array<{ name: string | null; phone: string }>;
    if (rows.length === 0)
      return Response.json({ error: "user not found" }, { status: 404 });
    const row = rows[0];
    const displayPhone = row.phone.startsWith("web:") ? null : row.phone;
    const referralCode = await ensureReferralCode(sql, userId).catch(() => null);
    const referralCount = referralCode ? await countReferralsFor(sql, userId).catch(() => 0) : 0;
    return Response.json({
      name: row.name,
      phone: displayPhone,
      referral_code: referralCode,
      referral_count: referralCount,
    });
  }

  if (request.method === "PUT") {
    const body = (await request.json().catch(() => null)) as
      | { name?: string | null }
      | null;
    if (!body) return Response.json({ error: "invalid json" }, { status: 400 });
    const cleanedName =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim().slice(0, 80)
        : null;
    await sql`UPDATE users SET name = ${cleanedName} WHERE id = ${userId}`;
    return Response.json({ ok: true, name: cleanedName });
  }

  return new Response("method not allowed", { status: 405 });
}

async function handleApiPrefs(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token)
    return Response.json({ error: "missing token" }, { status: 400 });
  const userId = await verifyWebviewToken(token, env.WEBVIEW_SIGNING_KEY);
  if (!userId)
    return Response.json(
      { error: "invalid or expired token" },
      { status: 401 },
    );

  const sql = getDb(env.DATABASE_URL);

  if (request.method === "GET") {
    const prefs = await getPreferences(sql, userId);
    return Response.json(prefs);
  }

  if (request.method === "PUT") {
    const body = (await request.json().catch(() => null)) as Partial<Preferences> | null;
    if (!body)
      return Response.json({ error: "invalid json" }, { status: 400 });
    // Simplified schema: origin + interests (stored in `countries`) + currency.
    // `cities`, `styles`, and `budget_*` are kept in the DB schema but no
    // longer surfaced — always written as empty/null from this path. The
    // `countries` field now carries the unified interest tags (mix of
    // countries and cities by name).
    const cleaned: Preferences = {
      origin:
        typeof body.origin === "string" && body.origin.trim()
          ? body.origin.trim().slice(0, PREFS_ORIGIN_MAX)
          : null,
      countries: cleanStringArray(body.countries),
      cities: [],
      styles: [],
      budget_min: null,
      budget_max: null,
      budget_currency:
        typeof body.budget_currency === "string" && body.budget_currency.trim()
          ? body.budget_currency.trim().toUpperCase().slice(0, 3)
          : "USD",
    };
    await upsertPreferences(sql, userId, cleaned);
    await track(env, {
      event: "preferences_saved",
      distinct_id: distinctIdForUser(userId),
      properties: {
        source: "webview",
        has_origin: !!cleaned.origin,
        countries_count: cleaned.countries.length,
        cities_count: cleaned.cities.length,
        styles_count: cleaned.styles.length,
        has_budget: cleaned.budget_min != null || cleaned.budget_max != null,
      },
    });
    return Response.json({ ok: true });
  }

  return new Response("method not allowed", { status: 405 });
}

async function handleApiWatchlist(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token)
    return Response.json({ error: "missing token" }, { status: 400 });
  const userId = await verifyWebviewToken(token, env.WEBVIEW_SIGNING_KEY);
  if (!userId)
    return Response.json(
      { error: "invalid or expired token" },
      { status: 401 },
    );

  const sql = getDb(env.DATABASE_URL);

  if (request.method === "GET") {
    const items = await getUserWatchlist(sql, userId);
    return Response.json({ items });
  }

  if (request.method === "POST") {
    const body = (await request.json().catch(() => null)) as {
      destination?: string;
      destination_iata?: string;
      origin_iata?: string;
      max_price_usd?: number;
      frequency_days?: number;
    } | null;
    if (
      !body ||
      typeof body.destination_iata !== "string" ||
      typeof body.origin_iata !== "string"
    ) {
      return Response.json({ error: "invalid body" }, { status: 400 });
    }
    const destIata = body.destination_iata.trim().toUpperCase().slice(0, 3);
    const originIata = body.origin_iata.trim().toUpperCase().slice(0, 3);
    if (destIata.length !== 3 || originIata.length !== 3) {
      return Response.json({ error: "invalid IATA" }, { status: 400 });
    }
    // Price is no longer collected from the UI; store an effectively
    // unlimited cap so the cron always alerts (the column is still
    // NOT NULL in the schema). Destination name is optional now too —
    // default to the IATA code if absent so the column stays populated.
    const maxPrice =
      typeof body.max_price_usd === "number" && body.max_price_usd > 0
        ? Math.floor(body.max_price_usd)
        : 999_999;
    const destName =
      typeof body.destination === "string" && body.destination.trim()
        ? body.destination.trim().slice(0, 80)
        : destIata;
    const { id } = await addWatchlistItem(sql, userId, {
      destination: destName,
      destination_iata: destIata,
      origin_iata: originIata,
      max_price: maxPrice,
      currency: "USD",
      frequency_days:
        typeof body.frequency_days === "number" &&
        body.frequency_days >= 1 &&
        body.frequency_days <= 30
          ? Math.floor(body.frequency_days)
          : 7,
    });
    return Response.json({ id, ok: true });
  }

  if (request.method === "DELETE") {
    const idStr = url.searchParams.get("id");
    const id = Number(idStr);
    if (!Number.isFinite(id))
      return Response.json({ error: "invalid id" }, { status: 400 });
    const ok = await deleteWatchlistItem(sql, id, userId);
    if (!ok) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ ok: true });
  }

  return new Response("method not allowed", { status: 405 });
}

function getClientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}

function rateLimitResponse(r: RateLimitResult, msg: string): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(r.retry_after_seconds),
    },
  });
}

const CHAT_COOKIE_NAME = "luanna_chat";

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v ?? "");
  }
  return null;
}

async function readChatCookieUserId(
  request: Request,
  env: Env,
): Promise<number | null> {
  const token = readCookie(request, CHAT_COOKIE_NAME);
  if (!token) return null;
  return verifyChatToken(token, env.WEBVIEW_SIGNING_KEY);
}

async function loadUserById(
  sql: ReturnType<typeof getDb>,
  userId: number,
): Promise<{ id: number; phone: string; name: string | null; phone_number_id: string | null } | null> {
  const rows = (await sql`
    SELECT id, phone, name, phone_number_id FROM users WHERE id = ${userId} LIMIT 1
  `) as Array<{ id: number; phone: string; name: string | null; phone_number_id: string | null }>;
  return rows[0] ?? null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

const ADMIN_COOKIE_NAME = "luanna_admin_session";
const ADMIN_SESSION_TTL_SECONDS = 24 * 60 * 60;

async function signAdminCookie(env: Env, expUnix: number): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(env.ADMIN_API_KEY!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(`admin:${expUnix}`),
  );
  const bytes = new Uint8Array(mac);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const sigB64 = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${expUnix}.${sigB64}`;
}

async function verifyAdminCookie(env: Env, value: string): Promise<boolean> {
  if (!env.ADMIN_API_KEY) return false;
  const m = value.match(/^(\d+)\.([\w-]+)$/);
  if (!m) return false;
  const expUnix = Number(m[1]);
  if (!Number.isFinite(expUnix) || expUnix < Math.floor(Date.now() / 1000)) {
    return false;
  }
  const expected = await signAdminCookie(env, expUnix);
  return timingSafeEqual(expected, value);
}

function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const pair of header.split(";")) {
    const [k, ...rest] = pair.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

async function checkAdminAuth(request: Request, env: Env): Promise<boolean> {
  if (!env.ADMIN_API_KEY) return false;
  // Bearer (CLI / fetch). Basic auth is INTENTIONALLY rejected here so the
  // browser-native popup we used to ship before the cookie flow can no longer
  // keep an old session alive after the user clicks "Salir" — old Basic
  // creds cached by the browser get ignored.
  const auth = request.headers.get("Authorization");
  if (auth && auth.startsWith("Bearer ")) {
    return timingSafeEqual(auth, `Bearer ${env.ADMIN_API_KEY}`);
  }
  // Cookie path — set by /admin/login when password matches
  const cookie = getCookie(request, ADMIN_COOKIE_NAME);
  if (cookie) return await verifyAdminCookie(env, cookie);
  return false;
}

function redirectToLogin(): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: "/admin/login" },
  });
}

async function handleAdminLoginPage(
  request: Request,
  env: Env,
): Promise<Response> {
  // If already authenticated, skip the form and bounce to the dashboard.
  if (await checkAdminAuth(request, env)) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/admin/" },
    });
  }
  const url = new URL(request.url);
  const error = url.searchParams.get("error") === "1";
  return new Response(renderAdminLoginPage(error), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function handleAdminLoginSubmit(
  request: Request,
  env: Env,
): Promise<Response> {
  if (!env.ADMIN_API_KEY) {
    return new Response("admin not configured", { status: 503 });
  }
  let password = "";
  const contentType = request.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const body = await request.text();
    const params = new URLSearchParams(body);
    password = params.get("password") ?? "";
  } else if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as
      | { password?: string }
      | null;
    password = body?.password ?? "";
  }
  if (!password || !timingSafeEqual(password, env.ADMIN_API_KEY)) {
    return new Response(null, {
      status: 302,
      headers: { Location: "/admin/login?error=1" },
    });
  }
  const expUnix = Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS;
  const token = await signAdminCookie(env, expUnix);
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/admin/",
      "Set-Cookie": `${ADMIN_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=${ADMIN_SESSION_TTL_SECONDS}`,
    },
  });
}

async function handleAdminLogout(): Promise<Response> {
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/admin/login",
      "Set-Cookie": `${ADMIN_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=0`,
    },
  });
}

async function handleAdminDashboardPage(
  request: Request,
  env: Env,
): Promise<Response> {
  if (!(await checkAdminAuth(request, env))) return redirectToLogin();
  return new Response(renderAdminDashboardPage(), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function handleAdminDashboardJson(
  request: Request,
  env: Env,
): Promise<Response> {
  if (!(await checkAdminAuth(request, env))) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const sql = getDb(env.DATABASE_URL);
  try {
    const stats = await getDashboardStats(sql);
    return new Response(JSON.stringify(stats), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("admin dashboard query failed", err);
    await recordError(sql, "admin:dashboard", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "dashboard error" },
      { status: 500 },
    );
  }
}

async function handleAdminListPending(
  request: Request,
  env: Env,
): Promise<Response> {
  if (!(await checkAdminAuth(request, env))) {
    return new Response("unauthorized", { status: 401 });
  }
  const url = new URL(request.url);
  const daysParam = url.searchParams.get("older_than_days") ?? "7";
  const parsed = parseInt(daysParam, 10);
  const days = Number.isFinite(parsed)
    ? Math.max(0, Math.min(365, parsed))
    : 7;
  const sql = getDb(env.DATABASE_URL);
  const requests = await listPendingDeletionRequests(sql, days);
  return Response.json({
    older_than_days: days,
    count: requests.length,
    requests,
  });
}

async function handleAdminPosthogPing(
  request: Request,
  env: Env,
): Promise<Response> {
  if (!(await checkAdminAuth(request, env))) {
    return new Response("unauthorized", { status: 401 });
  }
  if (!env.POSTHOG_API_KEY) {
    return Response.json(
      { ok: false, error: "POSTHOG_API_KEY not set" },
      { status: 400 },
    );
  }
  const targetHost = (env.POSTHOG_HOST ?? "https://us.i.posthog.com").replace(
    /\/+$/,
    "",
  );
  const url = `${targetHost}/capture/`;
  const payload = {
    api_key: env.POSTHOG_API_KEY,
    event: "diagnostic_ping",
    distinct_id: "admin_ping",
    properties: { source: "admin_diagnostic" },
    timestamp: new Date().toISOString(),
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.text().catch(() => "")).slice(0, 1000);
    return Response.json({
      target: url,
      key_prefix: env.POSTHOG_API_KEY.slice(0, 8),
      status: res.status,
      body,
      ok: res.ok,
    });
  } catch (err) {
    return Response.json(
      {
        target: url,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

async function handleAdminErrorsRecent(
  request: Request,
  env: Env,
): Promise<Response> {
  if (!(await checkAdminAuth(request, env))) {
    return new Response("unauthorized", { status: 401 });
  }
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit") ?? "50";
  const parsedLimit = parseInt(limitParam, 10);
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(200, parsedLimit))
    : 50;
  const context = url.searchParams.get("context");
  const sql = getDb(env.DATABASE_URL);
  const errors = await listRecentErrors(sql, limit, context);
  return Response.json({ limit, context, count: errors.length, errors });
}

async function handleAdminFeedbackRecent(
  request: Request,
  env: Env,
): Promise<Response> {
  if (!(await checkAdminAuth(request, env))) {
    return new Response("unauthorized", { status: 401 });
  }
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit") ?? "50";
  const parsedLimit = parseInt(limitParam, 10);
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(200, parsedLimit))
    : 50;
  const sql = getDb(env.DATABASE_URL);
  const feedback = await listRecentFeedback(sql, limit);
  return Response.json({ limit, count: feedback.length, feedback });
}

async function handleAdminProcessDeletion(
  request: Request,
  env: Env,
): Promise<Response> {
  if (!(await checkAdminAuth(request, env))) {
    return new Response("unauthorized", { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as
    | { request_id?: number }
    | null;
  if (!body || typeof body.request_id !== "number") {
    return Response.json({ error: "missing request_id" }, { status: 400 });
  }
  const sql = getDb(env.DATABASE_URL);
  const result = await processDeletionRequest(sql, body.request_id);
  if (!result) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json({ ok: true, ...result });
}

async function handleApiDataDeletion(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = (await request.json().catch(() => null)) as
    | { phone?: string; email?: string; reason?: string }
    | null;
  if (!body || typeof body.phone !== "string") {
    return Response.json({ error: "missing phone" }, { status: 400 });
  }
  const phone = body.phone.trim().replace(/[^\d+]/g, "");
  if (phone.length < 8 || phone.length > 20) {
    return Response.json({ error: "invalid phone" }, { status: 400 });
  }
  const email =
    typeof body.email === "string" && body.email.trim()
      ? body.email.trim().slice(0, 200)
      : null;
  const reason =
    typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim().slice(0, 1000)
      : null;
  const sql = getDb(env.DATABASE_URL);
  const ip = getClientIp(request);
  const rl = await checkRateLimit(sql, `deletion:${ip}`, 5, 3600);
  if (!rl.allowed) return rateLimitResponse(rl, "too many requests");
  const { id } = await createDataDeletionRequest(sql, { phone, email, reason });
  return Response.json({ ok: true, id });
}

const CHAT_IMAGE_MAX_BYTES = 6 * 1024 * 1024;
const CHAT_AUDIO_MAX_BYTES = 8 * 1024 * 1024;

interface UploadedFile {
  size: number;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

function asUploadedFile(value: unknown): UploadedFile | null {
  if (value && typeof value === "object" && "arrayBuffer" in value && "size" in value) {
    const f = value as UploadedFile;
    return f.size > 0 ? f : null;
  }
  return null;
}

async function handleChat(request: Request, env: Env): Promise<Response> {
  const contentType = request.headers.get("content-type") || "";
  let message: string | undefined;
  let rawSession = "";
  let refField: string | undefined;
  let imageFile: UploadedFile | null = null;
  let audioFile: UploadedFile | null = null;

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return Response.json({ error: "invalid form" }, { status: 400 });
    }
    const m = form.get("message");
    if (typeof m === "string") message = m;
    const s = form.get("session_id");
    if (typeof s === "string") rawSession = s;
    const r = form.get("ref");
    if (typeof r === "string") refField = r;
    imageFile = asUploadedFile(form.get("image"));
    audioFile = asUploadedFile(form.get("audio"));
  } else {
    const body = (await request.json().catch(() => null)) as
      | { message?: string; session_id?: string; ref?: string }
      | null;
    message = body?.message;
    rawSession = typeof body?.session_id === "string" ? body.session_id : "";
    refField = typeof body?.ref === "string" ? body.ref : undefined;
  }

  // Cookie-based identity takes precedence over the session_id. If the
  // user previously vinculó su chat web con WhatsApp, the cookie carries a
  // signed token for their WhatsApp user_id and we use that account.
  const linkedUserId = await readChatCookieUserId(request, env);

  const session_id = rawSession.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  if (!linkedUserId && !session_id) {
    return Response.json({ error: "missing 'session_id'" }, { status: 400 });
  }

  const hasMedia = imageFile !== null || audioFile !== null;
  const trimmedMessage = typeof message === "string" ? message : "";
  if (!hasMedia && trimmedMessage.trim() === "") {
    return Response.json({ error: "missing 'message'" }, { status: 400 });
  }
  if (trimmedMessage.length > CHAT_MESSAGE_MAX) {
    return Response.json({ error: "message too long" }, { status: 413 });
  }
  if (imageFile && imageFile.size > CHAT_IMAGE_MAX_BYTES) {
    return Response.json({ error: "image too large" }, { status: 413 });
  }
  if (audioFile && audioFile.size > CHAT_AUDIO_MAX_BYTES) {
    return Response.json({ error: "audio too large" }, { status: 413 });
  }

  const sql = getDb(env.DATABASE_URL);
  const ip = getClientIp(request);
  const rl = await checkRateLimit(sql, `chat:${ip}`, 20, 60);
  if (!rl.allowed) return rateLimitResponse(rl, "too many requests");
  // If the linked user_id from the cookie still exists, use it (WA-linked
  // account). Otherwise fall back to the legacy web:session_id flow.
  const user = linkedUserId
    ? await loadUserById(sql, linkedUserId) ?? await getOrCreateUser(sql, `web:${session_id}`)
    : await getOrCreateUser(sql, `web:${session_id}`);
  await ensureReferralCode(sql, user.id).catch(() => {});
  const history = await getRecentMessages(sql, user.id);
  const isFirstContact = history.length === 0;
  const distinctId = distinctIdForUser(user.id);

  // ── Resolve incoming content: text, image, or audio ──────────────
  let resolvedText: string = trimmedMessage;
  let sourceKind: "text" | "image" | "audio" = "text";
  let userBubbleText: string = trimmedMessage; // what we persist as the user's message

  if (imageFile) {
    sourceKind = "image";
    try {
      const buf = await imageFile.arrayBuffer();
      const ident = await identifyDestinationFromImage(
        env,
        buf,
        imageFile.type || "image/jpeg",
        trimmedMessage || null,
      );
      await track(env, {
        event: "image_identified",
        distinct_id: distinctId,
        properties: {
          source: "web",
          unknown: ident.unknown,
          summary_length: ident.summary.length,
        },
      });
      if (ident.unknown) {
        const fallback =
          "Recibí tu foto 🤔 pero no logré identificar dónde es. ¿Me cuentas qué lugar es?";
        await appendMessage(
          sql,
          user.id,
          "user",
          `[foto recibida]${trimmedMessage ? ` "${trimmedMessage}"` : ""}`,
        );
        await appendMessage(sql, user.id, "assistant", fallback);
        return Response.json({ reply: fallback });
      }
      userBubbleText = trimmedMessage
        ? `[foto] ${trimmedMessage}`
        : "[foto]";
      resolvedText =
        `[El usuario mandó una foto. Identifiqué el lugar como: ${ident.summary}.` +
        (trimmedMessage ? ` Caption del usuario: "${trimmedMessage}".` : "") +
        ` Tu trabajo: confirmar entusiasmada el destino, preguntarle si quiere que busques vuelos/hotel/paquete desde su origen, e impulsar la conversación. NO le digas que "identificaste una foto" textualmente — habla como si supieras del lugar.]`;
    } catch (err) {
      console.error("web image processing failed", err);
      await recordError(sql, "web:image", err, { user_id: user.id });
      const fallback =
        "Recibí tu foto pero tuve un problema procesándola 😬 ¿Me cuentas qué lugar es?";
      await appendMessage(sql, user.id, "assistant", fallback);
      return Response.json({ reply: fallback });
    }
  } else if (audioFile) {
    sourceKind = "audio";
    try {
      const buf = await audioFile.arrayBuffer();
      const transcript = await transcribeAudio(env, buf);
      await track(env, {
        event: "audio_transcribed",
        distinct_id: distinctId,
        properties: {
          source: "web",
          text_length: transcript.text.length,
          duration_seconds: transcript.duration_seconds ?? null,
        },
      });
      if (!transcript.text || transcript.text.length < 2) {
        const fallback =
          "No te escuché bien 😅 ¿Lo intentas otra vez o me lo escribes?";
        await appendMessage(sql, user.id, "user", "[audio inaudible]");
        await appendMessage(sql, user.id, "assistant", fallback);
        return Response.json({ reply: fallback });
      }
      resolvedText = transcript.text;
      userBubbleText = `🎤 ${transcript.text}`;
    } catch (err) {
      console.error("web audio processing failed", err);
      await recordError(sql, "web:audio", err, { user_id: user.id });
      const fallback =
        "Recibí tu audio pero tuve un problema escuchándolo 😬 ¿Lo intentas otra vez o me escribes?";
      await appendMessage(sql, user.id, "assistant", fallback);
      return Response.json({ reply: fallback });
    }
  }

  // Referral linking for web users: ?ref= param surfaces here as body.ref
  // on the first message of a new session. We also tolerate ref: prefixes
  // inline in the message itself.
  if (isFirstContact && sourceKind === "text") {
    let refCode: string | null = null;
    if (typeof refField === "string" && /^[A-Za-z0-9]{4,20}$/.test(refField)) {
      refCode = refField;
    } else {
      const m = resolvedText.match(/(?:^|\s)ref:([A-Za-z0-9]{4,20})\b/i);
      if (m) {
        refCode = m[1];
        resolvedText = resolvedText.replace(/(?:^|\s)ref:[A-Za-z0-9]{4,20}\b/i, "").trim();
        if (!resolvedText) resolvedText = "Hola";
        userBubbleText = resolvedText;
      }
    }
    if (refCode) {
      try {
        const ref = await findReferrerByCode(sql, refCode);
        if (ref && ref.referrer_id !== user.id) {
          const linked = await setReferredBy(sql, user.id, ref.referrer_id);
          if (linked) {
            await track(env, {
              event: "referred_signup",
              distinct_id: distinctId,
              properties: { referrer_id: ref.referrer_id, code: refCode, source: "web" },
            });
          }
        }
      } catch (_) { /* never break the reply */ }
    }
  }

  // ── /feedback intercept (mirror WhatsApp behavior) ────────────────
  if (sourceKind === "text") {
    const feedbackMatch = resolvedText.match(
      /^\s*\/(feedback|bug|idea)\b\s*(.*)$/is,
    );
    if (feedbackMatch) {
      const cmd = feedbackMatch[1].toLowerCase();
      const fbBody = (feedbackMatch[2] || "").trim();
      const kind: FeedbackKind =
        cmd === "bug" ? "bug" : cmd === "idea" ? "idea" : "other";
      let ack: string;
      if (!fbBody) {
        ack =
          cmd === "bug"
            ? "Cuéntame qué falló y te lo paso al equipo. Escribe: `/bug <lo que pasó>` 🐞"
            : cmd === "idea"
              ? "¡Cuéntame tu idea! Escribe: `/idea <tu sugerencia>` 💡"
              : "¡Mándame tu feedback! Escribe: `/feedback <lo que quieras contarme>` ✨";
      } else {
        await recordFeedback(sql, user.id, kind, fbBody, "web");
        await track(env, {
          event: "feedback_submitted",
          distinct_id: distinctId,
          properties: { kind, length: fbBody.length, source: "web" },
        });
        ack =
          kind === "bug"
            ? "Anotado 🐞 Lo paso al equipo y lo revisamos. ¡Gracias por ayudar a hacer Luanna mejor!"
            : kind === "idea"
              ? "¡Buenísima idea! 💡 Queda anotada. Gracias por compartirla 🙌"
              : "¡Gracias por el feedback! ✨ Lo leemos y nos ayuda muchísimo. 🙌";
      }
      await appendMessage(sql, user.id, "user", resolvedText);
      await appendMessage(sql, user.id, "assistant", ack);
      return Response.json({ reply: ack });
    }
  }

  // Persist user turn and fetch prefs in parallel — they're independent.
  // PostHog events fire-and-forget so analytics never gates the reply.
  const [, userPrefs] = await Promise.all([
    appendMessage(sql, user.id, "user", userBubbleText),
    getPreferences(sql, user.id).catch(() => null),
  ]);
  if (isFirstContact) {
    track(env, {
      event: "user_signed_up",
      distinct_id: distinctId,
      properties: { source: "web" },
    }).catch(() => undefined);
  }
  track(env, {
    event: "message_received",
    distinct_id: distinctId,
    properties: {
      source: "web",
      source_kind: sourceKind,
      is_first_contact: isFirstContact,
      has_name: !!user.name,
      length: resolvedText.length,
    },
  }).catch(() => undefined);
  // Stream the LLM response when this is a "regular" text chat — no media,
  // not a first-contact welcome (handled deterministically), and not a
  // preferences-intent reply (also deterministic). Streaming wins ~1-3s of
  // perceived latency because tokens land in the bubble as they're produced.
  const canStream =
    sourceKind === "text" && !isFirstContact && !PREFS_INTENT_RE.test(resolvedText);
  if (canStream) {
    return streamReply(env, resolvedText, {
      userId: user.id,
      baseUrl: new URL(request.url).origin,
      history,
      sql,
      userName: user.name,
      isFirstContact,
      userPrefs,
    });
  }
  const reply = await generateReply(env, resolvedText, {
    userId: user.id,
    baseUrl: new URL(request.url).origin,
    history,
    sql,
    userName: user.name,
    isFirstContact,
    userPrefs,
  });
  if (reply.trim()) {
    // Persist the assistant turn in the background — the web client
    // already has the JSON response, so we don't gate on the DB write.
    appendMessage(sql, user.id, "assistant", reply).catch((err) =>
      console.error("appendMessage assistant (web) failed", err),
    );
  }
  return Response.json({ reply });
}

async function handleChatReset(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as
    | { session_id?: string }
    | null;
  const rawSession = typeof body?.session_id === "string" ? body.session_id : "";
  const session_id = rawSession.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  if (!session_id) {
    return Response.json({ error: "missing 'session_id'" }, { status: 400 });
  }
  const phone = `web:${session_id}`;
  const sql = getDb(env.DATABASE_URL);
  await sql`DELETE FROM users WHERE phone = ${phone}`;
  return Response.json({ ok: true });
}

const CHAT_TRACK_ALLOWED_EVENTS = new Set([
  "share_clicked",
  "share_dialog_canceled",
  "email_dismissed",
]);

async function handleChatEmail(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as
    | { session_id?: string; email?: string }
    | null;
  if (!body) return Response.json({ error: "invalid json" }, { status: 400 });
  const rawSession = typeof body.session_id === "string" ? body.session_id : "";
  const session_id = rawSession.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  if (!session_id) {
    return Response.json({ error: "missing 'session_id'" }, { status: 400 });
  }
  const rawEmail = typeof body.email === "string" ? body.email.trim() : "";
  // Basic email validation: local@host.tld with at least one dot in domain.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(rawEmail) || rawEmail.length > 200) {
    return Response.json({ error: "invalid email" }, { status: 400 });
  }
  const email = rawEmail.toLowerCase();
  const sql = getDb(env.DATABASE_URL);
  const ip = getClientIp(request);
  const rl = await checkRateLimit(sql, `email:${ip}`, 5, 3600);
  if (!rl.allowed) return rateLimitResponse(rl, "too many requests");
  const phone = `web:${session_id}`;
  const rows = (await sql`
    SELECT id FROM users WHERE phone = ${phone} LIMIT 1
  `) as Array<{ id: number }>;
  if (rows.length === 0) {
    return Response.json({ error: "session not found" }, { status: 404 });
  }
  const userId = rows[0].id;
  await sql`
    UPDATE users SET email = ${email}, email_captured_at = NOW()
    WHERE id = ${userId}
  `;
  await track(env, {
    event: "email_captured",
    distinct_id: distinctIdForUser(userId),
    properties: { source: "web_chat" },
  });
  return Response.json({ ok: true });
}

async function handleChatTrack(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as
    | { session_id?: string; event?: string; properties?: Record<string, unknown> }
    | null;
  if (!body) return Response.json({ error: "invalid json" }, { status: 400 });
  const rawSession = typeof body.session_id === "string" ? body.session_id : "";
  const session_id = rawSession.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  if (!session_id) {
    return Response.json({ error: "missing 'session_id'" }, { status: 400 });
  }
  const event = typeof body.event === "string" ? body.event : "";
  if (!CHAT_TRACK_ALLOWED_EVENTS.has(event)) {
    return Response.json({ error: "event not allowed" }, { status: 400 });
  }
  const sql = getDb(env.DATABASE_URL);
  const rows = (await sql`
    SELECT id FROM users WHERE phone = ${`web:${session_id}`} LIMIT 1
  `) as Array<{ id: number }>;
  if (rows.length === 0) {
    return Response.json({ ok: true, skipped: true });
  }
  const props: Record<string, unknown> = { source: "web" };
  if (body.properties && typeof body.properties === "object") {
    for (const [k, v] of Object.entries(body.properties)) {
      // Only allow primitive values, cap names/values
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        props[k.slice(0, 40)] = typeof v === "string" ? v.slice(0, 200) : v;
      }
    }
  }
  await track(env, {
    event,
    distinct_id: distinctIdForUser(rows[0].id),
    properties: props,
  });
  return Response.json({ ok: true });
}

async function handleChatShare(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const rawSession = url.searchParams.get("session_id") ?? "";
  const session_id = rawSession.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  if (!session_id) {
    return Response.json({ error: "missing 'session_id'" }, { status: 400 });
  }
  const sql = getDb(env.DATABASE_URL);
  const phone = `web:${session_id}`;
  const rows = (await sql`
    SELECT id FROM users WHERE phone = ${phone} LIMIT 1
  `) as Array<{ id: number }>;
  if (rows.length === 0) {
    return Response.json({ error: "session not found" }, { status: 404 });
  }
  const userId = rows[0].id;
  const code = await ensureReferralCode(sql, userId).catch(() => null);
  if (!code) {
    return Response.json({ error: "no code" }, { status: 500 });
  }
  const origin = new URL(request.url).origin;
  const share_url = `${origin}/i/${code}`;
  return Response.json({ code, share_url });
}

async function handleChatLinkInit(
  request: Request,
  env: Env,
): Promise<Response> {
  if (!env.LUANNA_WHATSAPP_NUMBER) {
    return Response.json(
      { error: "linking not configured" },
      { status: 503 },
    );
  }
  const body = (await request.json().catch(() => null)) as
    | { session_id?: string }
    | null;
  if (!body) return Response.json({ error: "invalid json" }, { status: 400 });
  const rawSession = typeof body.session_id === "string" ? body.session_id : "";
  const session_id = rawSession.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  if (!session_id) {
    return Response.json({ error: "missing 'session_id'" }, { status: 400 });
  }
  const sql = getDb(env.DATABASE_URL);
  const ip = getClientIp(request);
  const rl = await checkRateLimit(sql, `link:${ip}`, 5, 3600);
  if (!rl.allowed) return rateLimitResponse(rl, "too many requests");
  const rows = (await sql`
    SELECT id FROM users WHERE phone = ${`web:${session_id}`} LIMIT 1
  `) as Array<{ id: number }>;
  if (rows.length === 0) {
    return Response.json({ error: "session not found" }, { status: 404 });
  }
  const code = await createLinkCode(sql, rows[0].id);
  const number = env.LUANNA_WHATSAPP_NUMBER.replace(/[^0-9]/g, "");
  const text = encodeURIComponent(`vincular ${code}`);
  const wa_url = `https://wa.me/${number}?text=${text}`;
  return Response.json({ code, wa_url, expires_in_seconds: 15 * 60 });
}

async function handleChatLinkStatus(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const code = (url.searchParams.get("code") ?? "")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 16);
  if (!code) {
    return Response.json({ error: "missing 'code'" }, { status: 400 });
  }
  const sql = getDb(env.DATABASE_URL);
  const row = await findLinkCode(sql, code);
  if (!row) {
    return Response.json({ status: "not_found" }, { status: 404 });
  }
  if (row.status === "completed" && row.linked_user_id) {
    const token = await createChatToken(
      row.linked_user_id,
      env.WEBVIEW_SIGNING_KEY,
    );
    // Set the HttpOnly chat-session cookie on the response so subsequent
    // /api/chat calls authenticate as the linked WhatsApp user.
    const cookie = `${CHAT_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${30 * 24 * 60 * 60}; HttpOnly; Secure; SameSite=Lax`;
    return new Response(JSON.stringify({ status: "completed" }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": cookie,
      },
    });
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return Response.json({ status: "expired" });
  }
  return Response.json({ status: "pending" });
}

async function handleChatWhoami(
  request: Request,
  env: Env,
): Promise<Response> {
  const userId = await readChatCookieUserId(request, env);
  if (!userId) return Response.json({ linked: false });
  const sql = getDb(env.DATABASE_URL);
  const u = await loadUserById(sql, userId);
  if (!u || u.phone.startsWith("web:")) {
    // The user_id in the cookie was deleted or is a web user (shouldn't
    // happen, but be defensive). Tell the client it's not linked.
    return Response.json({ linked: false });
  }
  return Response.json({ linked: true, name: u.name ?? null });
}

async function handleChatLogout(): Promise<Response> {
  // Clear the chat-session cookie. The web user will need to vincular again
  // (or just chat normally as a brand-new web session) on the next message.
  const cookie = `${CHAT_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Set-Cookie": cookie },
  });
}

async function handleClickRedirect(url: URL, env: Env): Promise<Response> {
  const id = url.pathname.slice(3).replace(/[^A-Za-z0-9_-]/g, "");
  if (!id || id.length < 4 || id.length > 32) {
    return new Response("not found", { status: 404 });
  }
  const sql = getDb(env.DATABASE_URL);
  try {
    const row = await consumeClickRedirect(sql, id);
    if (!row) return new Response("not found", { status: 404 });
    void track(env, {
      event: "link_clicked",
      distinct_id: row.user_id ? distinctIdForUser(row.user_id) : "anon",
      properties: { kind: row.kind, redirect_id: id },
    });
    return Response.redirect(row.original_url, 302);
  } catch (err) {
    console.error("click redirect failed", err);
    await recordError(sql, "fetch:click_redirect", err, { id });
    return new Response("server error", { status: 500 });
  }
}

async function handleInviteRedirect(url: URL, env: Env): Promise<Response> {
  const code = url.pathname.slice(3).replace(/[^A-Za-z0-9]/g, "").slice(0, 20);
  if (!code || code.length < 4) {
    return Response.redirect(`${url.origin}/`, 302);
  }
  const sql = getDb(env.DATABASE_URL);
  try {
    const rows = (await sql`
      SELECT id FROM users WHERE referral_code = ${code} LIMIT 1
    `) as Array<{ id: number }>;
    if (rows.length === 0) {
      return Response.redirect(`${url.origin}/`, 302);
    }
    void track(env, {
      event: "invite_link_visited",
      distinct_id: distinctIdForUser(rows[0].id),
      properties: { code, referrer_id: rows[0].id },
    });
    return Response.redirect(`${url.origin}/?ref=${encodeURIComponent(code)}`, 302);
  } catch (err) {
    console.error("invite redirect failed", err);
    await recordError(sql, "fetch:invite_redirect", err, { code });
    return Response.redirect(`${url.origin}/`, 302);
  }
}

async function handleHealth(env: Env): Promise<Response> {
  const started = Date.now();
  try {
    const sql = getDb(env.DATABASE_URL);
    await sql`SELECT 1 AS ping`;
    return Response.json({
      ok: true,
      db: "ok",
      latency_ms: Date.now() - started,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      {
        ok: false,
        db: "unreachable",
        latency_ms: Date.now() - started,
        error: message.slice(0, 200),
      },
      { status: 503 },
    );
  }
}

async function dispatchFetch(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  try {
    return await routeFetch(request, env, ctx);
  } catch (err) {
    console.error("uncaught fetch error", err);
    const url = new URL(request.url);
    await recordError(getDb(env.DATABASE_URL), "fetch:uncaught", err, {
      path: url.pathname,
      method: request.method,
    });
    return new Response("internal error", { status: 500 });
  }
}

async function routeFetch(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url);

  if (url.hostname === "www.luanna.app") {
    const redirect = new URL(url.toString());
    redirect.hostname = "luanna.app";
    return Response.redirect(redirect.toString(), 301);
  }

  if (request.method === "GET" && url.pathname === "/health") {
    return handleHealth(env);
  }
  if (request.method === "GET" && url.pathname.startsWith("/r/")) {
    return handleClickRedirect(url, env);
  }
  if (request.method === "GET" && url.pathname.startsWith("/i/")) {
    return handleInviteRedirect(url, env);
  }
  if (request.method === "POST" && url.pathname === "/webhook/kapso") {
    return handleKapsoWebhook(request, env, ctx);
  }
  if (request.method === "GET" && url.pathname === "/webview/prefs") {
    return handleWebviewPrefs(request, env);
  }
  if (
    (request.method === "GET" || request.method === "PUT") &&
    url.pathname === "/api/me"
  ) {
    return handleApiMe(request, env);
  }
  if (
    (request.method === "GET" || request.method === "PUT") &&
    url.pathname === "/api/prefs"
  ) {
    return handleApiPrefs(request, env);
  }
  if (
    (request.method === "GET" ||
      request.method === "POST" ||
      request.method === "DELETE") &&
    url.pathname === "/api/watchlist"
  ) {
    return handleApiWatchlist(request, env);
  }
  if (request.method === "POST" && url.pathname === "/api/chat") {
    return handleChat(request, env);
  }
  if (request.method === "GET" && url.pathname === "/api/chat/share") {
    return handleChatShare(request, env);
  }
  if (request.method === "POST" && url.pathname === "/api/chat/track") {
    return handleChatTrack(request, env);
  }
  if (request.method === "POST" && url.pathname === "/api/chat/email") {
    return handleChatEmail(request, env);
  }
  if (request.method === "POST" && url.pathname === "/api/chat/link/init") {
    return handleChatLinkInit(request, env);
  }
  if (request.method === "GET" && url.pathname === "/api/chat/link/status") {
    return handleChatLinkStatus(request, env);
  }
  if (request.method === "GET" && url.pathname === "/api/chat/whoami") {
    return handleChatWhoami(request, env);
  }
  if (request.method === "POST" && url.pathname === "/api/chat/logout") {
    return handleChatLogout();
  }
  if (request.method === "POST" && url.pathname === "/api/chat/reset") {
    return handleChatReset(request, env);
  }
  if (request.method === "POST" && url.pathname === "/api/data-deletion") {
    return handleApiDataDeletion(request, env);
  }
  if (
    request.method === "GET" &&
    url.pathname === "/admin/data-deletion/pending"
  ) {
    return handleAdminListPending(request, env);
  }
  if (
    request.method === "POST" &&
    url.pathname === "/admin/data-deletion/process"
  ) {
    return handleAdminProcessDeletion(request, env);
  }
  if (request.method === "GET" && url.pathname === "/admin/errors/recent") {
    return handleAdminErrorsRecent(request, env);
  }
  if (request.method === "GET" && url.pathname === "/admin/feedback/recent") {
    return handleAdminFeedbackRecent(request, env);
  }
  if (
    request.method === "GET" &&
    (url.pathname === "/admin" || url.pathname === "/admin/")
  ) {
    return handleAdminDashboardPage(request, env);
  }
  if (request.method === "GET" && url.pathname === "/admin/login") {
    return handleAdminLoginPage(request, env);
  }
  if (request.method === "POST" && url.pathname === "/admin/login") {
    return handleAdminLoginSubmit(request, env);
  }
  if (request.method === "POST" && url.pathname === "/admin/logout") {
    return handleAdminLogout();
  }
  if (
    request.method === "GET" &&
    url.pathname === "/admin/dashboard.json"
  ) {
    return handleAdminDashboardJson(request, env);
  }
  if (request.method === "GET" && url.pathname === "/admin/posthog/ping") {
    return handleAdminPosthogPing(request, env);
  }
  return env.ASSETS.fetch(request);
}

async function dispatchScheduled(
  event: ScheduledController,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  const cron = event.cron;
  const run = async () => {
    try {
      if (cron === "0 14 * * *") {
        await runDailyOffersCron(env);
      } else if (cron === "0 3 * * *") {
        await runCleanupCron(env);
      } else if (cron === "0 * * * *") {
        await runErrorAlertCron(env);
      } else if (cron === "0 15 * * *") {
        await runReEngagementCron(env);
      } else {
        await runWatchlistCron(env);
      }
    } catch (err) {
      console.error(`scheduled ${cron} uncaught`, err);
      await recordError(getDb(env.DATABASE_URL), "cron:uncaught", err, { cron });
    }
  };
  ctx.waitUntil(run());
}

export default {
  fetch: dispatchFetch,
  scheduled: dispatchScheduled,
} satisfies ExportedHandler<Env>;

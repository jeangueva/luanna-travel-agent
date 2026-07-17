import { createAnthropic } from "@ai-sdk/anthropic";
import type { BrowserWorker } from "@cloudflare/puppeteer";
import {
  generateText,
  stepCountIs,
  streamText,
  type ModelMessage,
} from "ai";
import {
  downloadKapsoMedia,
  extractButtonReply,
  extractFlowSubmission,
  extractMediaMessage,
  extractLocationMessage,
  extractMessageBatch,
  extractMessageReceived,
  type LocationMessage,
  type MediaMessage,
  sendKapsoAudio,
  sendKapsoButtons,
  sendKapsoCtaUrl,
  sendKapsoDocument,
  sendKapsoReaction,
  sendKapsoSticker,
  sendKapsoFlow,
  sendKapsoText,
  sendKapsoTypingIndicator,
  verifyKapsoSignature,
} from "./kapso";
import {
  deriveSuggestions,
  mapTapToMessage,
  type Suggestion,
} from "./suggestions";
import {
  generateSpeech,
  identifyDestinationFromImage,
  transcribeAudio,
} from "./multimodal";
import {
  addWatchlistItem,
  appendMessage,
  bumpClickCount,
  checkRateLimit,
  countReferralsFor,
  getClickRedirect,
  createDataDeletionRequest,
  createTrip,
  deleteWatchlistItem,
  ensureReferralCode,
  findReferrerByCode,
  getDashboardStats,
  getDb,
  getOrCreateUser,
  getPreferences,
  getRecentMessages,
  getMessagesSince,
  getTripBySlug,
  getUserWatchlist,
  updateTripContent,
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
  createLinkGuardStream,
  extractRealUrls,
  repairTrackedLinks,
} from "./links";
import {
  CHAT_MESSAGE_MAX,
  PREFS_ORIGIN_MAX,
  clampBudget,
  cleanStringArray,
} from "./validators";
import { distinctIdForUser, track, trackBatch } from "./posthog";
import { inferOriginFromPhone, nearestAirport } from "./geo";
import { buildLuannaSystemPrompt } from "./prompt";
import {
  makeAddFavoritePlacesTool,
  makeAddWatchlistTool,
  makeStartItineraryTool,
  formatFlightTeaser,
  type FlightTeaser,
  makeFlightSearchTool,
  makeHotelSearchTool,
  makePackageLinkTool,
  makePreferencesCtaTool,
  makePreferencesFlowTool,
  makePreferencesLinkTool,
  makeRemoveFavoritePlacesTool,
  makeRequestLocationTool,
  makeSaveUserNameTool,
  makeSendStickerTool,
  makeStaysSearchTool,
  makeSuggestItineraryTool,
  makeTripPrepTool,
  makeMyRewardsTool,
  type ItineraryRequest,
} from "./tools";
import {
  createChatToken,
  createWebviewToken,
  verifyChatToken,
  verifyWebviewToken,
} from "./auth";
import { renderPreferencesPage } from "./webview";
import puppeteer from "@cloudflare/puppeteer";
import { enrichItineraryPhotos } from "./wikimedia";
import { renderItineraryHtml } from "./itinerary_html";
import { fetchWithTimeout } from "./http";
import { ItinerarySchema, makeTripSlug, type Itinerary } from "./itinerary";
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
  // LLM provider switch. "minimax" routes the bot through MiniMax's
  // OpenAI-compatible API; anything else (default) uses Anthropic/Claude.
  // Lets us A/B in prod and roll back instantly without a code change.
  LLM_PROVIDER?: string;
  MINIMAX_API_KEY?: string;
  MINIMAX_MODEL?: string;
  MINIMAX_BASE_URL?: string;
  // Hotel price source: "amadeus" (real offers) or default (Hotellook cache).
  HOTELS_PROVIDER?: string;
  AMADEUS_CLIENT_ID?: string;
  AMADEUS_CLIENT_SECRET?: string;
  AMADEUS_BASE_URL?: string;
  // Airbnb-style stays via the external Python scraping service. Enabled when
  // STAYS_PROVIDER=airbnb and the service URL + key are set.
  STAYS_PROVIDER?: string;
  STAYS_SERVICE_URL?: string;
  STAYS_API_KEY?: string;
  ADMIN_API_KEY?: string;
  ALERT_WEBHOOK_URL?: string;
  POSTHOG_API_KEY?: string;
  POSTHOG_HOST?: string;
  PUBLIC_BASE_URL?: string;
  LUANNA_WHATSAPP_NUMBER?: string;
  ASSETS: Fetcher;
  AI?: { run: (model: string, input: unknown) => Promise<unknown> };
  // Browser Rendering binding (headless Chromium) for trip-itinerary PDF export.
  // Optional so the worker still typechecks/runs in environments without it.
  BROWSER?: BrowserWorker;
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
  // Mutable holder: start_itinerary writes the user's itinerary request here so
  // the caller can build + deliver the plan in the BACKGROUND after the reply
  // (heavy generation must never block/timeout the message). Null when no
  // itinerary was requested this turn.
  itineraryRequest?: { value: ItineraryRequest | null };
  // Mutable holder: which tools ran this turn, in call order. The caller uses
  // it to derive deterministic quick-reply suggestions (WhatsApp buttons /
  // web chips) after the reply text is generated.
  toolsUsed?: { value: string[] };
  // The user message id this turn replies to — used to re-fire the typing
  // indicator after an early teaser message so the chat still shows "typing…"
  // while the model writes the full reply.
  typingMessageId?: string;
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

// Turn a reply into something worth speaking aloud: drop URLs (useless in
// audio), markdown, and most emojis, collapse whitespace, and cap length so
// the voice note stays short. Returns "" if nothing speakable remains.
function spokenSummary(reply: string): string {
  let s = reply
    .replace(/https?:\/\/\S+/g, "") // URLs
    .replace(/[*_`#>]/g, "") // markdown
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, ". ")
    // strip most emoji / symbol ranges (TTS reads them as noise)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}️]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  // Cap to ~2 sentences / 300 chars so the clip is short.
  if (s.length > 300) {
    const cut = s.slice(0, 300);
    const lastDot = cut.lastIndexOf(". ");
    s = (lastDot > 80 ? cut.slice(0, lastDot + 1) : cut).trim();
  }
  return s;
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

// Bound any promise so a hung LLM call or runaway search fan-out can't run
// past the point where the Workers runtime silently kills our ctx.waitUntil
// (#3). On timeout we throw a tagged error; the webhook catch then sends the
// deterministic fallback, so the user always gets a reply instead of silence.
class TimeoutError extends Error {}
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new TimeoutError(`${label} timed out after ${ms}ms`)),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
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
      try {
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
      } catch (err) {
        // Flow unpublished/misconfigured must never dead-end the user — fall
        // through to the CTA-URL webview path below.
        console.error("prefs flow send failed, falling back to webview", err);
      }
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
  if (ctx.toolsUsed) {
    ctx.toolsUsed.value = collectToolNames(
      result as unknown as { steps?: ToolCallStep[] },
    );
  }
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
  const repaired = await repairTrackedLinks(
    ctx.sql,
    result.text,
    (result as unknown as { steps?: unknown }).steps,
  );
  return sanitizeReply(repaired, ctx.baseUrl).trim();
}

/**
 * Build the args for either generateText or streamText. Centralizes the
 * model / tools / system / messages plumbing so the streaming and non-
 * streaming paths can't drift apart.
 */
// Single source of truth for which LLM the bot talks to. Swappable at runtime
// via env.LLM_PROVIDER so MiniMax can be trialed (and rolled back) without a
// deploy. MiniMax speaks the OpenAI-compatible protocol; tool calling + the
// multi-step loop must hold up there or flight/hotel search degrades.
function getModel(env: Env) {
  if (env.LLM_PROVIDER === "minimax") {
    // MiniMax exposes an Anthropic-compatible endpoint, so we reuse the same
    // provider as Claude and only swap baseURL + key. The wire protocol is
    // identical (Anthropic Messages API), which preserves tool calling, the
    // multi-step loop, and streaming — no OpenAI-protocol translation risk.
    const minimax = createAnthropic({
      apiKey: env.MINIMAX_API_KEY ?? "",
      // Note the trailing /v1: the AI SDK appends only "/messages", unlike the
      // official Anthropic SDK which adds "/v1/messages". So baseURL must end /v1.
      baseURL: env.MINIMAX_BASE_URL ?? "https://api.minimax.io/anthropic/v1",
    });
    return minimax(env.MINIMAX_MODEL ?? "MiniMax-M3");
  }
  const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return anthropic(env.LUANNA_MODEL ?? DEFAULT_MODEL);
}

function buildLLMArgs(
  env: Env,
  userMessage: string,
  ctx: ReplyContext,
  flowEnabled: boolean,
  inWhatsApp: boolean,
) {
  const model = getModel(env);
  const messages: ModelMessage[] = [
    ...ctx.history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: userMessage },
  ];
  const tpEnv = {
    TRAVELPAYOUTS_TOKEN: env.TRAVELPAYOUTS_TOKEN,
    TRAVELPAYOUTS_MARKER: env.TRAVELPAYOUTS_MARKER,
  };
  const clickCtx = ctx.userId > 0
    ? {
        sql: ctx.sql,
        userId: ctx.userId,
        baseUrl: ctx.baseUrl,
        // Phone drives the local display currency (null on web → USD only).
        phone: ctx.to ?? null,
      }
    : undefined;
  const hotelOpts =
    env.HOTELS_PROVIDER === "amadeus" &&
    env.AMADEUS_CLIENT_ID &&
    env.AMADEUS_CLIENT_SECRET
      ? {
          provider: "amadeus",
          amadeus: {
            clientId: env.AMADEUS_CLIENT_ID,
            clientSecret: env.AMADEUS_CLIENT_SECRET,
            baseURL: env.AMADEUS_BASE_URL ?? "https://test.api.amadeus.com",
          },
        }
      : undefined;
  // "scrape" = Airbnb+Booking scraper service; "airbnb" kept as legacy alias.
  const staysOpts =
    (env.STAYS_PROVIDER === "scrape" || env.STAYS_PROVIDER === "airbnb") &&
    env.STAYS_SERVICE_URL &&
    env.STAYS_API_KEY
      ? { serviceUrl: env.STAYS_SERVICE_URL, apiKey: env.STAYS_API_KEY }
      : undefined;
  // Early-teaser callback (WhatsApp only): the instant search_flights has its
  // cheapest option, push it as its own message — the user sees a real price
  // + link ~3-5s before the model finishes writing. One teaser per turn (an
  // open-jaw does two searches; two teasers would read as spam). The full
  // reply then covers the remaining options (the tool result tells the model
  // not to repeat the top one).
  let teaserSent = false;
  const onTopResult =
    inWhatsApp && ctx.userId > 0
      ? async (teaser: FlightTeaser): Promise<boolean> => {
          if (teaserSent) return false;
          teaserSent = true;
          // Preferred shape: native CTA URL button ("Ver vuelo") — no visible
          // link at all, so nothing depends on the model transcribing a URL
          // and the tap opens the flight in the in-app browser. Falls back to
          // a plain text + link if the interactive send fails.
          const body = formatFlightTeaser(teaser, { omitLink: true });
          if (teaser.link) {
            try {
              await sendKapsoCtaUrl({
                apiKey: env.KAPSO_API_KEY,
                phoneNumberId: ctx.phoneNumberId!,
                to: ctx.to!,
                bodyText: body,
                buttonText: "Ver vuelo ✈️",
                url: teaser.link,
              });
            } catch (err) {
              console.error("teaser CTA failed, falling back to text", err);
              await sendKapsoText({
                apiKey: env.KAPSO_API_KEY,
                phoneNumberId: ctx.phoneNumberId!,
                to: ctx.to!,
                body: formatFlightTeaser(teaser),
              });
            }
          } else {
            await sendKapsoText({
              apiKey: env.KAPSO_API_KEY,
              phoneNumberId: ctx.phoneNumberId!,
              to: ctx.to!,
              body,
            });
          }
          // Persist + re-show typing dots in the background; the model's
          // generation continues immediately. History keeps the link so the
          // model knows it was delivered.
          void appendMessage(
            ctx.sql,
            ctx.userId,
            "assistant",
            formatFlightTeaser(teaser),
          ).catch((err) => console.error("appendMessage teaser failed", err));
          if (ctx.typingMessageId) {
            void sendKapsoTypingIndicator({
              apiKey: env.KAPSO_API_KEY,
              phoneNumberId: ctx.phoneNumberId!,
              messageId: ctx.typingMessageId,
            });
          }
          return true;
        }
      : undefined;
  const tools = {
    search_flights: makeFlightSearchTool(tpEnv, clickCtx, onTopResult),
    search_hotels: makeHotelSearchTool(tpEnv, clickCtx, hotelOpts),
    search_stays: makeStaysSearchTool(tpEnv, clickCtx, staysOpts),
    get_package_link: makePackageLinkTool(tpEnv, clickCtx),
    suggest_itinerary: makeSuggestItineraryTool(),
    start_itinerary: makeStartItineraryTool({
      onRequest: (req) => {
        if (ctx.itineraryRequest) ctx.itineraryRequest.value = req;
      },
    }),
    trip_prep: makeTripPrepTool(),
    my_rewards: makeMyRewardsTool({ sql: ctx.sql, userId: ctx.userId }),
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
    // Stickers + native location request only make sense in WhatsApp (need a
    // real recipient + phone id).
    ...(inWhatsApp
      ? {
          send_sticker: makeSendStickerTool({
            apiKey: env.KAPSO_API_KEY,
            phoneNumberId: ctx.phoneNumberId!,
            to: ctx.to!,
            baseUrl: ctx.baseUrl,
          }),
          request_location: makeRequestLocationTool({
            apiKey: env.KAPSO_API_KEY,
            phoneNumberId: ctx.phoneNumberId!,
            to: ctx.to!,
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
      // Capa A: only suggest a phone-derived origin when none is saved.
      suggestedOrigin:
        !ctx.userPrefs?.origin && ctx.to
          ? (() => {
              const g = inferOriginFromPhone(ctx.to!);
              return g ? { city: g.city, iata: g.iata } : null;
            })()
          : null,
      userCountries: ctx.userPrefs?.countries ?? [],
      userCities: ctx.userPrefs?.cities ?? [],
      userStyles: ctx.userPrefs?.styles ?? [],
    }),
    messages,
    tools,
    // 3 steps is plenty for the typical flow: one tool call + one reply.
    // Capping lower than 5 saves a roundtrip when the model wanders.
    stopWhen: stepCountIs(3),
    // WhatsApp replies are 1-3 short lines + links; 600 tokens is generous.
    // Caps the tail latency when the model tries to write an essay.
    maxOutputTokens: 600,
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
  exec: ExecutionContext,
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
  const history = ctx.history;
  // Live link guard: the browser sees raw tokens as they stream, so the
  // batch repair at persist time never protected the visible reply. The guard
  // validates/repairs URLs in-flight; tool-created /r/ links are fed to it as
  // each step finishes (tool steps always complete before the answer streams).
  const guard = createLinkGuardStream(sql, baseUrl);
  // Tool names collected live: tool steps always complete before the final
  // answer streams, so by flush time the list is complete.
  const streamToolNames: string[] = [];
  const result = streamText({
    ...args,
    onStepFinish: (step) => {
      for (const url of extractRealUrls(step)) guard.addRealUrl(url);
      const calls = (step as unknown as ToolCallStep).toolCalls ?? [];
      for (const c of calls) if (c?.toolName) streamToolNames.push(c.toolName);
    },
    onFinish: async ({ text, steps }) => {
      const repaired = await repairTrackedLinks(sql, text, steps).catch(
        () => text,
      );
      const sanitized = sanitizeReply(repaired, baseUrl).trim();
      if (sanitized && userId > 0) {
        // MUST ride on waitUntil: once the stream closes, the runtime can kill
        // the invocation and a dangling fire-and-forget write gets dropped.
        // That silently lost EVERY assistant turn from web-chat history, so
        // the bot never saw its own replies and kept re-greeting the user.
        exec.waitUntil(
          appendMessage(sql, userId, "assistant", sanitized).catch((err) =>
            console.error("appendMessage assistant (stream) failed", err),
          ),
        );
      }
      // Background itinerary generation (web): the user already saw the "lo
      // estoy armando ⏳" ack in the stream; the finished plan is appended as a
      // new assistant message and surfaces in the web client via history polling.
      if (userId > 0 && ctx.itineraryRequest?.value) {
        exec.waitUntil(
          generateAndDeliverItinerary(env, {
            sql,
            userId,
            baseUrl,
            history,
            request: ctx.itineraryRequest.value,
          }),
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
  // Trailer: after the text finishes, append the quick-reply suggestions as a
  // record-separator-delimited JSON blob (\u001E + JSON). The web client
  // splits on \u001E, renders the text part, and turns the JSON into chips.
  // Plain-text consumers that ignore it see one trailing control char at most.
  const suggestionTrailer = new TransformStream<string, string>({
    flush(controller) {
      const suggestions = deriveSuggestions(streamToolNames);
      if (suggestions.length > 0) {
        controller.enqueue("\u001E" + JSON.stringify(suggestions));
      }
    },
  });
  return new Response(
    result.textStream
      .pipeThrough(guard.stream)
      .pipeThrough(suggestionTrailer)
      .pipeThrough(new TextEncoderStream()),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

interface ToolCallStep {
  toolCalls?: Array<{
    toolName?: string;
    input?: unknown;
    args?: unknown;
  }>;
}

function collectToolNames(result: { steps?: ToolCallStep[] }): string[] {
  const names: string[] = [];
  for (const step of result.steps ?? []) {
    for (const call of step.toolCalls ?? []) {
      if (call?.toolName) names.push(call.toolName);
    }
  }
  return names;
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
): Promise<{
  text: string;
  kind: "text" | "image" | "audio";
  language?: string;
} | null> {
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
        language: transcript.language ?? null,
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
    return { text: transcript.text, kind: "audio", language: transcript.language };
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

// Capa B: a shared WhatsApp location pin → set the user's origin to the
// nearest airport city and confirm. Cosmetic-safe: failures are logged, never
// thrown back into the webhook ack.
async function handleLocationMessage(
  env: Env,
  loc: LocationMessage,
): Promise<void> {
  try {
    const sql = getDb(env.DATABASE_URL);
    const user = await getOrCreateUser(sql, loc.from, loc.phone_number_id);
    const airport = nearestAirport(loc.latitude, loc.longitude);
    if (!airport) return;
    const prefs = await getPreferences(sql, user.id);
    await upsertPreferences(sql, user.id, { ...prefs, origin: airport.city });
    const body = `📍 ¡Listo! Te ubiqué cerca de ${airport.city} (${airport.iata}). Usaré ese origen para tus vuelos. Si sales desde otra ciudad, dímelo 🙂`;
    await appendMessage(sql, user.id, "user", "[ubicación compartida]");
    await appendMessage(sql, user.id, "assistant", body);
    await sendKapsoText({
      apiKey: env.KAPSO_API_KEY,
      phoneNumberId: loc.phone_number_id,
      to: loc.from,
      body,
    });
    await track(env, {
      event: "location_shared",
      distinct_id: distinctIdForUser(user.id),
      properties: { iata: airport.iata, city: airport.city },
    });
  } catch (err) {
    console.error("location handler error", err);
    await recordError(getDb(env.DATABASE_URL), "webhook:location", err, {
      from: loc.from,
    });
  }
}

// ── Trip itinerary: background generation + delivery ─────────────────────────

const ITINERARY_BUILDER_SYSTEM = [
  "Eres la planificadora de viajes de Luanna. Construyes un itinerario COMPLETO,",
  "realista y bien organizado para el destino y los días pedidos.",
  "Reglas:",
  "- Usa SOLO lugares REALES y reconocibles del destino (atracciones, barrios,",
  "  miradores, museos, restaurantes típicos). NUNCA inventes lugares.",
  "- Ordena los días de forma lógica y geográfica (no saltes de un lado a otro).",
  "- Por cada lugar: categoría, rating 1-5, tiempo de visita aprox y 1-2 tips.",
  "- Por cada día: un título, una línea de contexto (clima/dificultad/transporte",
  "  cuando aplique), hotel sugerido y comida típica.",
  "- Incluye un resumen ejecutivo (grupo, fechas, presupuesto, clima) y un",
  "  presupuesto aproximado por persona, en la moneda más relevante.",
  "- Respeta el estilo del usuario (fotografía, aventura, comida, económico,",
  "  relajado). Ajusta el número de días a lo que pidió.",
  "- Todo en español, cálido pero conciso. NO incluyas URLs ni links.",
].join("\n");

// Compact shape hint appended to the prompt so the model returns JSON that
// validates against ItinerarySchema on the first try.
const ITINERARY_JSON_SHAPE =
  '{"title":str,"subtitle"?:str,"destination":str,"dates_label"?:str,' +
  '"total_days":int,"route_label"?:str,"style":[str],' +
  '"summary":[{"label":str,"value":str}],' +
  '"parts":[{"title"?:str,"subtitle"?:str,"days":[{"number":int,"title":str,' +
  '"header"?:str,"places":[{"name":str,"category"?:str,"rating"?:int(1-5),' +
  '"time"?:str,"description"?:str,"tips":[str],"maps_query"?:str}],' +
  '"meals"?:str,"hotel"?:str,"notes":[str]}]}],' +
  '"budget"?:{"intro"?:str,"rows":[{"label":str,"value":str}],"total"?:str},' +
  '"notes":[str]}';

// Extract a JSON object from model text: strip markdown fences, then take the
// outermost {...}. Throws if no object is present.
function extractJsonObject(text: string): unknown {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first === -1 || last <= first) throw new Error("no JSON object in output");
  return JSON.parse(s.slice(first, last + 1));
}

// Ask the model for the itinerary as raw JSON and validate with Zod. One retry
// feeding back the validation error. Throws if it still fails.
async function composeItinerary(
  model: Parameters<typeof generateText>[0]["model"],
  basePrompt: string,
): Promise<Itinerary> {
  const system =
    ITINERARY_BUILDER_SYSTEM +
    "\n\nResponde ÚNICAMENTE con UN objeto JSON válido (sin markdown, sin texto " +
    "antes ni después) con exactamente esta forma:\n" +
    ITINERARY_JSON_SHAPE;
  const first = await generateText({ model, system, prompt: basePrompt });
  let parsed = ItinerarySchema.safeParse(safeExtract(first.text));
  if (!parsed.success) {
    const retry = await generateText({
      model,
      system,
      prompt:
        basePrompt +
        "\n\nTu respuesta anterior no fue un JSON válido para el formato pedido" +
        ` (${parsed.error.issues.slice(0, 4).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}).` +
        " Devuelve SOLO el JSON corregido, completo y válido.",
    });
    parsed = ItinerarySchema.safeParse(safeExtract(retry.text));
  }
  if (!parsed.success) {
    throw new Error(
      "itinerary schema invalid: " +
        parsed.error.issues
          .slice(0, 4)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
    );
  }
  return parsed.data;
}

function safeExtract(text: string): unknown {
  try {
    return extractJsonObject(text);
  } catch {
    return null;
  }
}

// Build the full itinerary in the background (heavy: 10-40s), persist it, append
// the link as an assistant message (so the web client sees it via history
// polling), and on WhatsApp push the link + PDF document. Never throws — a
// failure appends a friendly retry message instead of leaving the user hanging.
async function generateAndDeliverItinerary(
  env: Env,
  args: {
    sql: ReturnType<typeof getDb>;
    userId: number;
    baseUrl: string;
    history: Message[];
    request: ItineraryRequest;
    whatsapp?: { to: string; phoneNumberId: string };
  },
): Promise<void> {
  const { sql, userId, baseUrl, history, request, whatsapp } = args;
  const wa = whatsapp;
  try {
    const model = getModel(env);
    const convo = history
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n")
      .slice(-6000);
    const basePrompt =
      `Conversación reciente con el usuario:\n${convo}\n\n` +
      `Arma el itinerario COMPLETO para: destino=${request.destination}; ` +
      `días=${request.days ?? "decide según el contexto (3-7 si no se sabe)"}; ` +
      `estilo=${(request.style ?? []).join(", ") || "mixto"}. ` +
      `Notas del usuario: ${request.notes ?? "ninguna"}.`;
    // We DON'T use generateObject here: Anthropic's constrained-decoding grammar
    // compiler times out on this large nested schema. Instead we ask for raw
    // JSON and validate it ourselves with Zod, retrying once on a parse miss.
    const object = await composeItinerary(model, basePrompt);
    const slug = makeTripSlug();
    await createTrip(sql, { userId, slug, itinerary: object });
    const url = `${baseUrl}/trip/${slug}`;
    const msg =
      `¡Tu itinerario está listo! 🗺️✨\n${url}\n` +
      `Ábrelo en el navegador y, si quieres, expórtalo a PDF 📄`;
    await appendMessage(sql, userId, "assistant", msg).catch(() => {});
    if (wa) {
      await sendKapsoText({
        apiKey: env.KAPSO_API_KEY,
        phoneNumberId: wa.phoneNumberId,
        to: wa.to,
        body: msg,
      });
      await deliverItineraryPdf(env, baseUrl, {
        slug,
        to: wa.to,
        phoneNumberId: wa.phoneNumberId,
      }).catch((err) => console.error("deliverItineraryPdf failed", err));
    }
  } catch (err) {
    console.error("generateAndDeliverItinerary failed", err);
    await recordError(getDb(env.DATABASE_URL), "itinerary:generate", err, {
      user_id: userId,
      destination: request.destination,
    });
    const failMsg =
      "Uy, no pude terminar de armar tu itinerario esta vez 😞 ¿Lo intentamos de nuevo en un momentito?";
    await appendMessage(sql, userId, "assistant", failMsg).catch(() => {});
    if (wa) {
      await sendKapsoText({
        apiKey: env.KAPSO_API_KEY,
        phoneNumberId: wa.phoneNumberId,
        to: wa.to,
        body: failMsg,
      }).catch(() => {});
    }
  }
}

// ── Trip itinerary: shared load+enrich, PDF render, WhatsApp delivery ─────────

// Load a trip by slug and lazily fill in place photos (Wikipedia) the first
// time, caching the enriched itinerary back to the row. Web view and PDF render
// both go through here, so photos appear consistently and the Wikipedia fetch
// cost is paid once per trip.
async function loadAndEnrichTrip(
  env: Env,
  slug: string,
): Promise<Itinerary | null> {
  const sql = getDb(env.DATABASE_URL);
  const row = await getTripBySlug(sql, slug);
  if (!row) return null;
  const itinerary = row.content;
  try {
    const changed = await enrichItineraryPhotos(itinerary);
    if (changed) {
      await updateTripContent(sql, slug, itinerary).catch((err) =>
        console.error("updateTripContent (enrich) failed", err),
      );
    }
  } catch (err) {
    console.error("enrichItineraryPhotos failed", err);
  }
  return itinerary;
}

// Render a trip's web page to a PDF via Browser Rendering. Drives the headless
// browser to the trip's own public URL with ?print=1 (hides web chrome, applies
// print CSS). Returns null if the binding is absent or the render fails.
async function renderTripPdf(
  env: Env,
  baseUrl: string,
  slug: string,
): Promise<Uint8Array | null> {
  if (!env.BROWSER) {
    console.error("renderTripPdf: BROWSER binding missing");
    return null;
  }
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/trip/${slug}?print=1`, {
      waitUntil: "networkidle0",
      timeout: 25_000,
    });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    return pdf as Uint8Array;
  } catch (err) {
    console.error("renderTripPdf failed", err);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// WhatsApp delivery: enrich photos, render the PDF, send it as a document.
async function deliverItineraryPdf(
  env: Env,
  baseUrl: string,
  args: { slug: string; to: string; phoneNumberId: string },
): Promise<void> {
  const itinerary = await loadAndEnrichTrip(env, args.slug);
  const pdf = await renderTripPdf(env, baseUrl, args.slug);
  if (!pdf) return;
  const dest = itinerary?.destination ?? "viaje";
  const filename = `Itinerario-${dest.replace(/[^A-Za-z0-9]+/g, "-")}.pdf`;
  await sendKapsoDocument({
    apiKey: env.KAPSO_API_KEY,
    phoneNumberId: args.phoneNumberId,
    to: args.to,
    pdf,
    filename,
    caption: "Tu itinerario completo 📄✨",
  });
}

// GET /trip/:slug         → shareable HTML view (web + WhatsApp link target)
// GET /trip/:slug?print=1 → same view with print CSS (used by Browser Rendering)
// GET /trip/:slug.pdf     → on-demand PDF (web "Exportar PDF" button)
async function handleTripView(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const baseUrl = url.origin;
  let slug = url.pathname.slice("/trip/".length);
  const isPdf = slug.endsWith(".pdf");
  if (isPdf) slug = slug.slice(0, -4);
  slug = slug.replace(/[^A-Za-z0-9]/g, "");
  if (!slug) return Response.redirect(`${baseUrl}/`, 302);

  if (isPdf) {
    await loadAndEnrichTrip(env, slug); // cache photos before the browser render
    const pdf = await renderTripPdf(env, baseUrl, slug);
    if (!pdf) return new Response("pdf unavailable", { status: 503 });
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="itinerario-${slug}.pdf"`,
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  const print = url.searchParams.get("print") === "1";
  const itinerary = await loadAndEnrichTrip(env, slug);
  if (!itinerary) {
    return new Response("<h1>Itinerario no encontrado</h1>", {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  const html = renderItineraryHtml(itinerary, { baseUrl, slug, print });
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=120",
    },
  });
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

  const dedupeSql = getDb(env.DATABASE_URL);

  // Capa B: a shared location pin sets the user's origin to the nearest
  // airport city. Handled as its own intercept (never merged into chat text).
  for (const item of batch) {
    const loc = extractLocationMessage(item);
    if (loc) {
      const fresh = await recordWebhookOrSkip(dedupeSql, loc.message_id);
      if (fresh) {
        ctx.waitUntil(handleLocationMessage(env, loc));
      }
    }
  }

  // Collect the conversational messages (text + media), de-duplicated by wamid
  // so a Kapso retry of the whole batch never double-replies. Heavy multimodal
  // work (vision + Whisper) happens later INSIDE ctx.waitUntil so we still ack
  // the webhook in <500ms.
  // Parse the batch first, then run all dedupe checks in ONE parallel wave —
  // each recordWebhookOrSkip is a Neon roundtrip, and running them
  // sequentially added ~200ms per extra message before the user saw anything.
  const parsed: Array<{ id: string; text: string | null; media: MediaMessage | null; tapId?: string }> = [];
  for (const item of batch) {
    const data = extractMessageReceived(item);
    const media = data ? null : extractMediaMessage(item);
    // A quick-reply button / list-row tap is a first-class user turn: map the
    // tapped id back to the natural-language message it stands for and feed it
    // through the same pipeline as typed text. (Flow nfm_reply submissions
    // don't match extractButtonReply and keep their own handler above.)
    const tap = !data && !media ? extractButtonReply(item) : null;
    if (!data && !media && !tap) continue; // flow / unsupported type
    const text = data
      ? data.message.text?.body?.trim() ?? null
      : tap
        ? mapTapToMessage(tap.id, tap.title)
        : null;
    if (!media && !text) continue; // empty text body / empty tap
    const id = data?.message.id ?? tap?.message_id ?? media!.message_id;
    parsed.push({ id, text, media, tapId: tap?.id });
  }
  const freshFlags = await Promise.all(
    parsed.map((p) =>
      recordWebhookOrSkip(dedupeSql, p.id).catch(() => true),
    ),
  );
  const incoming: IncomingMessage[] = [];
  for (let i = 0; i < parsed.length; i++) {
    if (!freshFlags[i]) {
      console.log("kapso webhook duplicate", parsed[i].id);
      continue;
    }
    if (parsed[i].tapId) {
      void track(env, {
        event: "quick_reply_tapped",
        distinct_id: "anon", // real user id not resolved yet at this point
        properties: { button_id: parsed[i].tapId },
      });
    }
    incoming.push({ id: parsed[i].id, text: parsed[i].text, media: parsed[i].media });
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
        // Parallelize every independent post-user-fetch DB read in ONE wave —
        // prefs included (it only needs user.id, not the resolved text). Each
        // extra sequential Neon roundtrip is ~200-400ms the user waits.
        const [history, userPrefs] = await Promise.all([
          getRecentMessages(sql, user.id),
          getPreferences(sql, user.id).catch(() => null),
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
        // If the user spoke (voice note), we reply with a voice note too
        // (mirror modality). Remember the spoken language for TTS.
        let voiceReplyLang: string | undefined;
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
          if (resolved.kind === "audio") voiceReplyLang = resolved.language;
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
        // Persist the user turn in the background — the LLM gets the text
        // directly (history + userMessage are separate inputs), so this write
        // doesn't need to block the reply. waitUntil keeps it alive past the
        // turn; it lands seconds before the assistant turn's insert.
        ctx.waitUntil(
          appendMessage(sql, user.id, "user", resolvedText).catch((err) =>
            console.error("appendMessage user failed", err),
          ),
        );
        const itineraryRequest = { value: null as ItineraryRequest | null };
        const toolsUsed = { value: [] as string[] };
        const reply = await withTimeout(
          generateReply(env, resolvedText, {
            userId: user.id,
            baseUrl,
            history,
            sql,
            to: from,
            phoneNumberId: phone_number_id,
            userName: user.name,
            isFirstContact,
            userPrefs,
            itineraryRequest,
            toolsUsed,
            typingMessageId: message_id,
          }),
          // Generous bound: legit flight fan-outs run ~10-20s. Cut only true
          // hangs, before the runtime kills the invocation with no reply.
          26_000,
          "generateReply",
        );
        if (reply.trim()) {
          // Send the reply FIRST (user sees it immediately), then persist the
          // assistant turn. We MUST await the persist: a fire-and-forget write
          // races worker termination — once this async IIFE resolves, the
          // ctx.waitUntil promise settles and the runtime can kill the
          // invocation before a dangling DB write lands. That dropped the
          // assistant turns from history, so the bot never "saw" its own
          // replies and repeated itself / lost context.
          //
          // Quick-reply buttons: when a search tool ran, attach up to 3 native
          // reply buttons. Short replies ride in the interactive message body
          // (single bubble); long ones fall back to text + no buttons rather
          // than a second "¿qué sigue?" bubble. Any buttons failure falls back
          // to plain text — the reply must always arrive.
          const suggestions = deriveSuggestions(toolsUsed.value);
          const asButtons = suggestions.length > 0 && reply.length <= 1000;
          let buttonsSent = false;
          if (asButtons) {
            buttonsSent = await sendKapsoButtons({
              apiKey: env.KAPSO_API_KEY,
              phoneNumberId: phone_number_id,
              to: from,
              bodyText: reply,
              buttons: suggestions,
            }).then(
              () => true,
              (err) => {
                console.error("sendKapsoButtons failed, falling back to text", err);
                return false;
              },
            );
          }
          if (!buttonsSent) {
            await sendKapsoText({
              apiKey: env.KAPSO_API_KEY,
              phoneNumberId: phone_number_id,
              to: from,
              body: reply,
            });
          }
          // Alert created this turn → react ✅ to the user's message. Cosmetic,
          // fire-and-forget, never blocks or fails the reply.
          if (toolsUsed.value.includes("add_watchlist")) {
            ctx.waitUntil(
              sendKapsoReaction({
                apiKey: env.KAPSO_API_KEY,
                phoneNumberId: phone_number_id,
                to: from,
                messageId: message_id,
                emoji: "✅",
              }),
            );
          }
          await appendMessage(sql, user.id, "assistant", reply).catch((err) =>
            console.error("appendMessage assistant failed", err),
          );
          // Voice-first: if the user sent a voice note, also reply with a
          // short spoken summary (text already carries the full details +
          // links). Non-blocking and cosmetic — never delays/fails the text.
          if (voiceReplyLang) {
            const spoken = spokenSummary(reply);
            if (spoken) {
              const mp3 = await generateSpeech(env, spoken, voiceReplyLang);
              if (mp3) {
                await sendKapsoAudio({
                  apiKey: env.KAPSO_API_KEY,
                  phoneNumberId: phone_number_id,
                  to: from,
                  mp3,
                });
              }
            }
          }
        }
        // If the user asked for a full itinerary this turn, build + deliver it
        // in the BACKGROUND after the ack reply. Generation is heavy (10-40s)
        // and must never block the message or trip the reply timeout. Scheduled
        // as its own keepalive so it survives this turn's IIFE settling.
        if (itineraryRequest.value) {
          ctx.waitUntil(
            generateAndDeliverItinerary(env, {
              sql,
              userId: user.id,
              baseUrl,
              history,
              request: itineraryRequest.value,
              whatsapp: { to: from, phoneNumberId: phone_number_id },
            }),
          );
        }
      } catch (err) {
        console.error("kapso handler error", err);
        await recordError(getDb(env.DATABASE_URL), "webhook:kapso", err, {
          from,
          phone_number_id,
          message_id,
        });
        // Never leave the user staring at vanishing typing dots. Even if the
        // LLM/DB failed or the turn timed out (#3), send a deterministic
        // fallback so every message gets a reply — critical for first-contact
        // strangers, and the only thing we can do when Neon is down (#4) since
        // this path needs no DB. Best-effort: if the send itself fails (Kapso
        // down), there's nothing more we can do.
        const fallbackBody =
          err instanceof TimeoutError
            ? "Uf, esa búsqueda me está tomando más de lo normal 🐢 Escríbeme de nuevo en un momentito y lo retomo, porfa."
            : "Uy, se me cruzó un cable 😅 Dame un segundo y escríbeme de nuevo, porfa.";
        await sendKapsoText({
          apiKey: env.KAPSO_API_KEY,
          phoneNumberId: phone_number_id,
          to: from,
          body: fallbackBody,
        }).catch((sendErr) =>
          console.error("kapso fallback send failed", sendErr),
        );
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
  // Brute-force guard: the login form is the only unauthenticated path that
  // compares attacker-controlled input against ADMIN_API_KEY.
  {
    const sql = getDb(env.DATABASE_URL);
    const ip = getClientIp(request);
    const rl = await checkRateLimit(sql, `admin_login:${ip}`, 10, 900);
    if (!rl.allowed) return rateLimitResponse(rl, "too many attempts");
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

async function handleChat(
  request: Request,
  env: Env,
  exec: ExecutionContext,
): Promise<Response> {
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
          language: transcript.language ?? null,
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
  // Holder for a background itinerary request triggered by start_itinerary.
  const itineraryRequest = { value: null as ItineraryRequest | null };
  const canStream =
    sourceKind === "text" && !isFirstContact && !PREFS_INTENT_RE.test(resolvedText);
  if (canStream) {
    return streamReply(
      env,
      resolvedText,
      {
        userId: user.id,
        baseUrl: new URL(request.url).origin,
        history,
        sql,
        userName: user.name,
        isFirstContact,
        userPrefs,
        itineraryRequest,
      },
      exec,
    );
  }
  const toolsUsed = { value: [] as string[] };
  const reply = await generateReply(env, resolvedText, {
    userId: user.id,
    baseUrl: new URL(request.url).origin,
    history,
    sql,
    userName: user.name,
    isFirstContact,
    userPrefs,
    itineraryRequest,
    toolsUsed,
  });
  if (reply.trim()) {
    // Persist the assistant turn in the background, but ON waitUntil: a bare
    // fire-and-forget write races worker termination after the response is
    // returned and silently drops the assistant turn from history (the bot
    // then re-greets every message because it never sees its own replies).
    exec.waitUntil(
      appendMessage(sql, user.id, "assistant", reply).catch((err) =>
        console.error("appendMessage assistant (web) failed", err),
      ),
    );
  }
  // Background itinerary generation (web, non-streaming path).
  if (user.id > 0 && itineraryRequest.value) {
    exec.waitUntil(
      generateAndDeliverItinerary(env, {
        sql,
        userId: user.id,
        baseUrl: new URL(request.url).origin,
        history,
        request: itineraryRequest.value,
      }),
    );
  }
  const suggestions: Suggestion[] = deriveSuggestions(toolsUsed.value);
  return Response.json({
    reply,
    ...(suggestions.length > 0 ? { suggestions } : {}),
  });
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
  // Destructive endpoint (cascades the user's history) — cap per IP so it
  // can't be scripted into a delete loop.
  const rl = await checkRateLimit(sql, `reset:${getClientIp(request)}`, 10, 3600);
  if (!rl.allowed) return rateLimitResponse(rl, "too many requests");
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
  // Unauthenticated write into analytics — keep it from becoming a spam pipe.
  const rlTrack = await checkRateLimit(sql, `track:${getClientIp(request)}`, 60, 3600);
  if (!rlTrack.allowed) return rateLimitResponse(rlTrack, "too many requests");
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

// M2 — real-time sync: the web chat polls this for messages newer than
// `since`. Resolves the same user as /api/chat (cookie-linked WhatsApp user,
// else web:session), so a linked user's WhatsApp turns show up in the web UI.
async function handleChatHistory(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const linkedUserId = await readChatCookieUserId(request, env);
  const session_id = (url.searchParams.get("session_id") || "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 64);
  if (!linkedUserId && !session_id) {
    return Response.json({ error: "missing 'session_id'" }, { status: 400 });
  }
  const sinceRaw = url.searchParams.get("since") || "";
  // Default: only messages from the last 2 minutes, so a fresh poller doesn't
  // replay the whole conversation.
  const since = sinceRaw && !Number.isNaN(Date.parse(sinceRaw))
    ? new Date(sinceRaw).toISOString()
    : new Date(Date.now() - 120000).toISOString();

  const sql = getDb(env.DATABASE_URL);
  let user: { id: number } | null = null;
  if (linkedUserId) {
    user = await loadUserById(sql, linkedUserId);
  } else {
    const rows = (await sql`
      SELECT id FROM users WHERE phone = ${`web:${session_id}`} LIMIT 1
    `) as Array<{ id: number }>;
    user = rows[0] ?? null;
  }
  const now = new Date().toISOString();
  if (!user) return Response.json({ messages: [], server_time: now });
  const messages = await getMessagesSince(sql, user.id, since);
  return Response.json({ messages, server_time: now });
}

// POST /api/chat/tts — speak an assistant reply aloud in the web chat (the
// WhatsApp path already answers voice notes with voice). Body: { text, lang? }.
// Returns audio/mpeg. Uses the same spokenSummary cleanup as WhatsApp so URLs
// and emojis never get read out loud.
async function handleChatTts(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as
    | { text?: string; lang?: string }
    | null;
  const text = typeof body?.text === "string" ? body.text : "";
  if (!text.trim()) {
    return Response.json({ error: "missing 'text'" }, { status: 400 });
  }
  if (text.length > 4000) {
    return Response.json({ error: "text too long" }, { status: 413 });
  }
  const sql = getDb(env.DATABASE_URL);
  const rl = await checkRateLimit(sql, `tts:${getClientIp(request)}`, 20, 3600);
  if (!rl.allowed) return rateLimitResponse(rl, "too many requests");
  const spoken = spokenSummary(text);
  if (!spoken) {
    return Response.json({ error: "nothing speakable" }, { status: 422 });
  }
  const lang = typeof body?.lang === "string" ? body.lang : "es";
  const mp3 = await generateSpeech(env, spoken, lang);
  if (!mp3) {
    return Response.json({ error: "tts unavailable" }, { status: 503 });
  }
  return new Response(mp3.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
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

async function handleClickRedirect(
  url: URL,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const id = url.pathname.slice(3).replace(/[^A-Za-z0-9_-]/g, "");
  if (!id || id.length < 4 || id.length > 32) {
    // Malformed/fabricated code: send home instead of a blank "not found"
    // dead-end, same as the unknown-id case below.
    return Response.redirect(`${url.origin}/`, 302);
  }
  const sql = getDb(env.DATABASE_URL);
  try {
    // Fast path: one read-only SELECT, then 302 immediately. The click-count
    // bump and analytics ride waitUntil so they never add latency between the
    // user's tap and the provider page opening.
    const row = await getClickRedirect(sql, id);
    // Unknown id (e.g. a mistyped/expired link): send the user to the homepage
    // instead of a blank "not found" — far better UX than a dead end.
    if (!row) return Response.redirect(`${url.origin}/`, 302);
    ctx.waitUntil(
      Promise.allSettled([
        bumpClickCount(sql, id),
        track(env, {
          event: "link_clicked",
          distinct_id: row.user_id ? distinctIdForUser(row.user_id) : "anon",
          properties: { kind: row.kind, redirect_id: id },
        }),
      ]),
    );
    return new Response(null, {
      status: 302,
      headers: {
        Location: row.original_url,
        // The target affiliate URL is immutable for this id — let the edge
        // cache the hop so repeat taps skip the DB entirely.
        "Cache-Control": "public, max-age=300",
      },
    });
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

// One dependency probe: ok flag + latency. Never throws.
interface DepProbe {
  ok: boolean;
  latency_ms: number;
  detail?: string;
}

async function probe(fn: () => Promise<void>): Promise<DepProbe> {
  const started = Date.now();
  try {
    await fn();
    return { ok: true, latency_ms: Date.now() - started };
  } catch (err) {
    return {
      ok: false,
      latency_ms: Date.now() - started,
      detail: (err instanceof Error ? err.message : String(err)).slice(0, 120),
    };
  }
}

// GET /health        → liveness: DB only. Cheap, safe to hit every minute.
// GET /health?deep=1 → also pings Anthropic + Travelpayouts (the two upstreams
//   a reply can't survive without). Costs a little quota/latency, so the uptime
//   monitor should poll the cheap form and reserve deep checks for low frequency
//   or manual verification.
async function handleHealth(env: Env, deep: boolean): Promise<Response> {
  const db = await probe(async () => {
    const sql = getDb(env.DATABASE_URL);
    await sql`SELECT 1 AS ping`;
  });

  const deps: Record<string, DepProbe> = { db };

  if (deep) {
    const [anthropic, travelpayouts] = await Promise.all([
      // Auth + reachability check, no token cost (model list is free).
      probe(async () => {
        const res = await fetchWithTimeout(
          "https://api.anthropic.com/v1/models?limit=1",
          {
            headers: {
              "x-api-key": env.ANTHROPIC_API_KEY,
              "anthropic-version": "2023-06-01",
            },
          },
          { dep: "anthropic:models", timeoutMs: 6000 },
        );
        if (!res.ok) throw new Error(`status ${res.status}`);
      }),
      // Minimal real query (limit=1) validates the token + the flight upstream.
      probe(async () => {
        const u = new URL(
          "https://api.travelpayouts.com/aviasales/v3/prices_for_dates",
        );
        u.searchParams.set("origin", "LIM");
        u.searchParams.set("destination", "MAD");
        u.searchParams.set("one_way", "true");
        u.searchParams.set("currency", "usd");
        u.searchParams.set("limit", "1");
        const res = await fetchWithTimeout(
          u.toString(),
          { headers: { "X-Access-Token": env.TRAVELPAYOUTS_TOKEN } },
          { dep: "travelpayouts:health", timeoutMs: 6000 },
        );
        if (!res.ok) throw new Error(`status ${res.status}`);
      }),
    ]);
    deps.anthropic = anthropic;
    deps.travelpayouts = travelpayouts;
  }

  const ok = Object.values(deps).every((d) => d.ok);
  return Response.json({ ok, deps }, { status: ok ? 200 : 503 });
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
    return handleHealth(env, url.searchParams.get("deep") === "1");
  }
  if (request.method === "GET" && url.pathname.startsWith("/r/")) {
    return handleClickRedirect(url, env, ctx);
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
  if (request.method === "GET" && url.pathname.startsWith("/trip/")) {
    return handleTripView(request, env);
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
    return handleChat(request, env, ctx);
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
  if (request.method === "GET" && url.pathname === "/api/chat/history") {
    return handleChatHistory(request, env);
  }
  if (request.method === "GET" && url.pathname === "/api/chat/whoami") {
    return handleChatWhoami(request, env);
  }
  if (request.method === "POST" && url.pathname === "/api/chat/tts") {
    return handleChatTts(request, env);
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

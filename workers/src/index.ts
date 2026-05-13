import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, stepCountIs, type ModelMessage } from "ai";
import {
  extractFlowSubmission,
  extractMessageReceived,
  sendKapsoCtaUrl,
  sendKapsoFlow,
  sendKapsoText,
  verifyKapsoSignature,
} from "./kapso";
import {
  addWatchlistItem,
  appendMessage,
  checkRateLimit,
  createDataDeletionRequest,
  deleteWatchlistItem,
  getDb,
  getOrCreateUser,
  getPreferences,
  getRecentMessages,
  getUserWatchlist,
  listPendingDeletionRequests,
  listRecentErrors,
  processDeletionRequest,
  recordError,
  recordWebhookOrSkip,
  upsertPreferences,
  type Message,
  type Preferences,
  type RateLimitResult,
} from "./db";
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
} from "./tools";
import { createWebviewToken, verifyWebviewToken } from "./auth";
import { renderPreferencesPage } from "./webview";
import {
  runCleanupCron,
  runDailyOffersCron,
  runErrorAlertCron,
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
  ASSETS: Fetcher;
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
}

const TRAVELPAYOUTS_HOSTS = new Set([
  "www.aviasales.com",
  "aviasales.com",
  "search.hotellook.com",
  "hotellook.com",
  "tp.media",
]);

function sanitizeReply(text: string, baseUrl: string): string {
  const allowedHost = new URL(baseUrl).host;
  return text.replace(/https?:\/\/[^\s)]+/g, (url) => {
    try {
      const host = new URL(url).host;
      if (host === allowedHost) return url;
      if (TRAVELPAYOUTS_HOSTS.has(host)) return url;
      return "";
    } catch {
      return "";
    }
  });
}

const PREFS_INTENT_RE =
  /\b(configura|configurar|preferencia|preferencias|gustos|perfil|prefer)\b/i;

function buildFirstContactWelcome(prefsUrl: string | null): string {
  const lines = [
    "¡Hola! ✈️ Soy Luanna, tu agente de viajes en WhatsApp.",
    "¿Cómo te llamas? 😊",
    "",
    "Te puedo ayudar con:",
    "🔹 Vuelos baratos",
    "🔹 Hoteles",
    "🔹 Paquetes vuelo+hotel",
    "🔹 Alertas cuando bajen precios",
    "",
  ];
  if (prefsUrl) {
    lines.push("Y si me cuentas tus gustos ahora, te recomiendo mejor 👇");
    lines.push(prefsUrl);
  } else {
    lines.push("De paso, configura tus gustos con el botón de abajo para recomendarte mejor 👇");
  }
  return lines.join("\n");
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

  // First contact: deterministic welcome + preferences entry point. We don't
  // trust the model to follow the exact welcome format every time, so build
  // it ourselves before the conversation deepens.
  if (ctx.isFirstContact && ctx.userId > 0) {
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
      return buildFirstContactWelcome(null);
    }
    const token = await createWebviewToken(ctx.userId, env.WEBVIEW_SIGNING_KEY);
    const url = `${ctx.baseUrl}/webview/prefs?token=${encodeURIComponent(token)}`;
    // In WhatsApp, send the URL as a native CTA URL button (renders as a
    // dedicated "Abrir panel" button below the message; the URL itself
    // doesn't appear inline). On web/chat, return the URL inline so the
    // chat UI renders it as a clickable link.
    if (inWhatsApp) {
      try {
        await sendKapsoCtaUrl({
          apiKey: env.KAPSO_API_KEY,
          phoneNumberId: ctx.phoneNumberId!,
          to: ctx.to!,
          bodyText: "Configura tus preferencias y alertas — el botón te abre el panel dentro de WhatsApp 🎯",
          buttonText: "Abrir panel",
          url,
          footerText: "Solo tú puedes ver este link",
        });
      } catch (err) {
        console.error("first-contact CTA url failed, falling back to text", err);
        return buildFirstContactWelcome(url);
      }
      return buildFirstContactWelcome(null);
    }
    return buildFirstContactWelcome(url);
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
  const tools = {
    search_flights: makeFlightSearchTool(tpEnv),
    search_hotels: makeHotelSearchTool(tpEnv),
    get_package_link: makePackageLinkTool(tpEnv),
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
  };
  const result = await generateText({
    model,
    system: buildLuannaSystemPrompt({
      now: new Date(),
      userName: ctx.userName ?? null,
      isFirstContact: ctx.isFirstContact ?? false,
    }),
    messages,
    tools,
    stopWhen: stepCountIs(5),
  });
  if (ctx.userId > 0) {
    const toolEvents = collectToolEvents(result, ctx.userId);
    if (toolEvents.length > 0) {
      await trackBatch(env, toolEvents);
    }
  }
  return sanitizeReply(result.text, ctx.baseUrl).trim();
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

  const submission = extractFlowSubmission(payload);
  if (submission) {
    ctx.waitUntil(handleFlowSubmission(env, submission));
    return new Response("ok", { status: 200 });
  }

  const data = extractMessageReceived(payload);
  if (!data) return new Response("ignored", { status: 200 });

  const userText = data.message.text?.body?.trim();
  if (!userText) return new Response("ignored", { status: 200 });

  // Idempotency: each WhatsApp message has a globally-unique wamid. If Kapso
  // retries this delivery (e.g. on a 5xx) we'd otherwise double-process.
  const dedupeSql = getDb(env.DATABASE_URL);
  const fresh = await recordWebhookOrSkip(dedupeSql, data.message.id);
  if (!fresh) {
    console.log("kapso webhook duplicate", data.message.id);
    return new Response("duplicate", { status: 200 });
  }

  const baseUrl = new URL(request.url).origin;

  ctx.waitUntil(
    (async () => {
      try {
        const sql = getDb(env.DATABASE_URL);
        const user = await getOrCreateUser(
          sql,
          data.message.from,
          data.phone_number_id,
        );
        const history = await getRecentMessages(sql, user.id);
        const isFirstContact = history.length === 0;
        await appendMessage(sql, user.id, "user", userText);
        const distinctId = distinctIdForUser(user.id);
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
            is_first_contact: isFirstContact,
            has_name: !!user.name,
            length: userText.length,
          },
        });
        const reply = await generateReply(env, userText, {
          userId: user.id,
          baseUrl,
          history,
          sql,
          to: data.message.from,
          phoneNumberId: data.phone_number_id,
          userName: user.name,
          isFirstContact,
        });
        if (reply.trim()) {
          await appendMessage(sql, user.id, "assistant", reply);
          await sendKapsoText({
            apiKey: env.KAPSO_API_KEY,
            phoneNumberId: data.phone_number_id,
            to: data.message.from,
            body: reply,
          });
        }
      } catch (err) {
        console.error("kapso handler error", err);
        await recordError(getDb(env.DATABASE_URL), "webhook:kapso", err, {
          from: data.message.from,
          phone_number_id: data.phone_number_id,
          message_id: data.message.id,
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
    // Hide internal `web:` and `whatsapp:` prefixes from the UI display
    const displayPhone = row.phone.startsWith("web:")
      ? null
      : row.phone;
    return Response.json({
      name: row.name,
      phone: displayPhone,
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

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function checkAdminAuth(request: Request, env: Env): boolean {
  if (!env.ADMIN_API_KEY) return false;
  const auth = request.headers.get("Authorization");
  if (!auth) return false;
  const expected = `Bearer ${env.ADMIN_API_KEY}`;
  return timingSafeEqual(auth, expected);
}

async function handleAdminListPending(
  request: Request,
  env: Env,
): Promise<Response> {
  if (!checkAdminAuth(request, env)) {
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
  if (!checkAdminAuth(request, env)) {
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
  if (!checkAdminAuth(request, env)) {
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

async function handleAdminProcessDeletion(
  request: Request,
  env: Env,
): Promise<Response> {
  if (!checkAdminAuth(request, env)) {
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

async function handleChat(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as
    | { message?: string; session_id?: string }
    | null;
  const message = body?.message;
  if (typeof message !== "string" || message.trim() === "") {
    return Response.json({ error: "missing 'message'" }, { status: 400 });
  }
  if (message.length > CHAT_MESSAGE_MAX) {
    return Response.json({ error: "message too long" }, { status: 413 });
  }
  const rawSession = typeof body?.session_id === "string" ? body.session_id : "";
  const session_id = rawSession.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  if (!session_id) {
    return Response.json({ error: "missing 'session_id'" }, { status: 400 });
  }
  const sql = getDb(env.DATABASE_URL);
  const ip = getClientIp(request);
  const rl = await checkRateLimit(sql, `chat:${ip}`, 20, 60);
  if (!rl.allowed) return rateLimitResponse(rl, "too many requests");
  const phone = `web:${session_id}`;
  const user = await getOrCreateUser(sql, phone);
  const history = await getRecentMessages(sql, user.id);
  const isFirstContact = history.length === 0;
  await appendMessage(sql, user.id, "user", message);
  const distinctId = distinctIdForUser(user.id);
  if (isFirstContact) {
    await track(env, {
      event: "user_signed_up",
      distinct_id: distinctId,
      properties: { source: "web" },
    });
  }
  await track(env, {
    event: "message_received",
    distinct_id: distinctId,
    properties: {
      source: "web",
      is_first_contact: isFirstContact,
      has_name: !!user.name,
      length: message.length,
    },
  });
  const reply = await generateReply(env, message, {
    userId: user.id,
    baseUrl: new URL(request.url).origin,
    history,
    sql,
    userName: user.name,
    isFirstContact,
  });
  if (reply.trim()) {
    await appendMessage(sql, user.id, "assistant", reply);
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

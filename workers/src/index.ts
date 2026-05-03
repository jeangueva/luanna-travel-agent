import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, stepCountIs, type ModelMessage } from "ai";
import {
  extractFlowSubmission,
  extractMessageReceived,
  sendKapsoFlow,
  sendKapsoText,
  verifyKapsoSignature,
} from "./kapso";
import {
  addWatchlistItem,
  appendMessage,
  createDataDeletionRequest,
  deleteWatchlistItem,
  getDb,
  getOrCreateUser,
  getPreferences,
  getRecentMessages,
  getUserWatchlist,
  listPendingDeletionRequests,
  processDeletionRequest,
  upsertPreferences,
  type Message,
  type Preferences,
} from "./db";
import { LUANNA_SYSTEM_PROMPT } from "./prompt";
import {
  makeAddFavoritePlacesTool,
  makeAddWatchlistTool,
  makeFlightSearchTool,
  makePreferencesFlowTool,
  makePreferencesLinkTool,
  makeRemoveFavoritePlacesTool,
} from "./tools";
import { createWebviewToken, verifyWebviewToken } from "./auth";
import { renderPreferencesPage } from "./webview";
import { runWatchlistCron } from "./cron";

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
}

const DEFAULT_MODEL = "claude-haiku-4-5";

interface ReplyContext {
  userId: number;
  baseUrl: string;
  history: Message[];
  sql: ReturnType<typeof getDb>;
  to?: string;
  phoneNumberId?: string;
}

function sanitizeReply(text: string, baseUrl: string): string {
  const allowedHost = new URL(baseUrl).host;
  return text.replace(/https?:\/\/[^\s)]+/g, (url) => {
    try {
      return new URL(url).host === allowedHost ? url : "";
    } catch {
      return "";
    }
  });
}

const PREFS_INTENT_RE =
  /\b(configura|configurar|preferencia|preferencias|gustos|perfil|prefer)\b/i;

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
      return `Configura tus gustos acá: ${url}`;
    }
  }

  const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const model = anthropic(env.LUANNA_MODEL ?? DEFAULT_MODEL);
  const messages: ModelMessage[] = [
    ...ctx.history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: userMessage },
  ];
  const tools = {
    search_flights: makeFlightSearchTool({
      TRAVELPAYOUTS_TOKEN: env.TRAVELPAYOUTS_TOKEN,
      TRAVELPAYOUTS_MARKER: env.TRAVELPAYOUTS_MARKER,
    }),
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
  };
  const { text } = await generateText({
    model,
    system: LUANNA_SYSTEM_PROMPT,
    messages,
    tools,
    stopWhen: stepCountIs(5),
  });
  return sanitizeReply(text, ctx.baseUrl).trim();
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
        await appendMessage(sql, user.id, "user", userText);
        const reply = await generateReply(env, userText, {
          userId: user.id,
          baseUrl,
          history,
          sql,
          to: data.message.from,
          phoneNumberId: data.phone_number_id,
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
          ? r.origin.trim()
          : null,
      countries: parseCsvList(r.countries),
      cities: parseCsvList(r.cities),
      styles: parseCsvList(r.styles),
      budget_min: parseNumber(r.budget_min),
      budget_max: parseNumber(r.budget_max),
      budget_currency: "USD",
    };
    await upsertPreferences(sql, user.id, prefs);
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
    const cleaned: Preferences = {
      origin: typeof body.origin === "string" && body.origin.trim() ? body.origin.trim() : null,
      countries: Array.isArray(body.countries) ? body.countries.filter((x) => typeof x === "string") : [],
      cities: Array.isArray(body.cities) ? body.cities.filter((x) => typeof x === "string") : [],
      styles: Array.isArray(body.styles) ? body.styles.filter((x) => typeof x === "string") : [],
      budget_min: typeof body.budget_min === "number" && body.budget_min >= 0 ? body.budget_min : null,
      budget_max: typeof body.budget_max === "number" && body.budget_max >= 0 ? body.budget_max : null,
      budget_currency:
        typeof body.budget_currency === "string" && body.budget_currency.trim()
          ? body.budget_currency.trim().toUpperCase().slice(0, 3)
          : "USD",
    };
    await upsertPreferences(sql, userId, cleaned);
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
      typeof body.destination !== "string" ||
      typeof body.destination_iata !== "string" ||
      typeof body.origin_iata !== "string" ||
      typeof body.max_price_usd !== "number" ||
      body.max_price_usd <= 0
    ) {
      return Response.json({ error: "invalid body" }, { status: 400 });
    }
    const { id } = await addWatchlistItem(sql, userId, {
      destination: body.destination.trim(),
      destination_iata: body.destination_iata.trim().toUpperCase().slice(0, 3),
      origin_iata: body.origin_iata.trim().toUpperCase().slice(0, 3),
      max_price: Math.floor(body.max_price_usd),
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
  const { id } = await createDataDeletionRequest(sql, { phone, email, reason });
  return Response.json({ ok: true, id });
}

async function handleChat(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as
    | { message?: string }
    | null;
  const message = body?.message;
  if (typeof message !== "string" || message.trim() === "") {
    return Response.json({ error: "missing 'message'" }, { status: 400 });
  }
  const reply = await generateReply(env, message, {
    userId: 0,
    baseUrl: new URL(request.url).origin,
    history: [],
    sql: getDb(env.DATABASE_URL),
  });
  return Response.json({ reply });
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true });
    }
    if (request.method === "POST" && url.pathname === "/webhook/kapso") {
      return handleKapsoWebhook(request, env, ctx);
    }
    if (request.method === "GET" && url.pathname === "/webview/prefs") {
      return handleWebviewPrefs(request, env);
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
    if (request.method === "POST" && url.pathname === "/chat") {
      return handleChat(request, env);
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/data-deletion"
    ) {
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
    return new Response("Not found", { status: 404 });
  },
  async scheduled(_event, env, ctx): Promise<void> {
    ctx.waitUntil(runWatchlistCron(env));
  },
} satisfies ExportedHandler<Env>;

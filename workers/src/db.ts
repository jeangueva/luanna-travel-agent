import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export type Sql = NeonQueryFunction<false, false>;

export interface User {
  id: number;
  phone: string;
  name: string | null;
  phone_number_id: string | null;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export function getDb(databaseUrl: string): Sql {
  return neon(databaseUrl);
}

export async function getOrCreateUser(
  sql: Sql,
  phone: string,
  phoneNumberId?: string,
): Promise<User> {
  const rows = (await sql`
    INSERT INTO users (phone, phone_number_id)
    VALUES (${phone}, ${phoneNumberId ?? null})
    ON CONFLICT (phone) DO UPDATE SET
      phone_number_id = COALESCE(EXCLUDED.phone_number_id, users.phone_number_id)
    RETURNING id, phone, name, phone_number_id
  `) as User[];
  return rows[0];
}

export async function appendMessage(
  sql: Sql,
  userId: number,
  role: Message["role"],
  content: string,
): Promise<void> {
  await sql`
    INSERT INTO messages (user_id, role, content)
    VALUES (${userId}, ${role}, ${content})
  `;
}

export async function getRecentMessages(
  sql: Sql,
  userId: number,
  limit = 20,
): Promise<Message[]> {
  const rows = (await sql`
    SELECT role, content
    FROM messages
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `) as Message[];
  return rows.reverse();
}

export interface Preferences {
  origin: string | null;
  countries: string[];
  cities: string[];
  styles: string[];
  budget_min: number | null;
  budget_max: number | null;
  budget_currency: string;
}

const DEFAULT_PREFERENCES: Preferences = {
  origin: null,
  countries: [],
  cities: [],
  styles: [],
  budget_min: null,
  budget_max: null,
  budget_currency: "USD",
};

export async function getPreferences(
  sql: Sql,
  userId: number,
): Promise<Preferences> {
  const rows = (await sql`
    SELECT origin, countries, cities, styles,
           budget_min, budget_max, budget_currency
    FROM preferences
    WHERE user_id = ${userId}
  `) as Preferences[];
  return rows[0] ?? DEFAULT_PREFERENCES;
}

export async function upsertPreferences(
  sql: Sql,
  userId: number,
  prefs: Preferences,
): Promise<void> {
  await sql`
    INSERT INTO preferences (
      user_id, origin, countries, cities, styles,
      budget_min, budget_max, budget_currency, updated_at
    )
    VALUES (
      ${userId},
      ${prefs.origin},
      ${JSON.stringify(prefs.countries)}::jsonb,
      ${JSON.stringify(prefs.cities)}::jsonb,
      ${JSON.stringify(prefs.styles)}::jsonb,
      ${prefs.budget_min},
      ${prefs.budget_max},
      ${prefs.budget_currency},
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      origin = EXCLUDED.origin,
      countries = EXCLUDED.countries,
      cities = EXCLUDED.cities,
      styles = EXCLUDED.styles,
      budget_min = EXCLUDED.budget_min,
      budget_max = EXCLUDED.budget_max,
      budget_currency = EXCLUDED.budget_currency,
      updated_at = NOW()
  `;
}

export interface Watchlist {
  id: number;
  user_id: number;
  destination: string;
  destination_iata: string | null;
  origin_iata: string | null;
  max_price: number;
  currency: string;
  frequency_days: number;
  last_notified_at: string | null;
}

export async function addWatchlistItem(
  sql: Sql,
  userId: number,
  args: {
    destination: string;
    destination_iata: string | null;
    origin_iata: string | null;
    max_price: number;
    currency?: string;
    frequency_days?: number;
  },
): Promise<{ id: number }> {
  const rows = (await sql`
    INSERT INTO watchlist (
      user_id, destination, destination_iata, origin_iata,
      max_price, currency, frequency_days
    )
    VALUES (
      ${userId},
      ${args.destination},
      ${args.destination_iata},
      ${args.origin_iata},
      ${args.max_price},
      ${args.currency ?? "USD"},
      ${args.frequency_days ?? 7}
    )
    RETURNING id
  `) as { id: number }[];
  return rows[0];
}

export interface DueWatchlistRow extends Watchlist {
  phone: string;
  phone_number_id: string | null;
}

export async function getDueWatchlist(
  sql: Sql,
  limit = 50,
): Promise<DueWatchlistRow[]> {
  const rows = (await sql`
    SELECT
      w.id, w.user_id, w.destination, w.destination_iata, w.origin_iata,
      w.max_price, w.currency, w.frequency_days, w.last_notified_at,
      u.phone, u.phone_number_id
    FROM watchlist w
    JOIN users u ON u.id = w.user_id
    WHERE w.active = TRUE
      AND u.phone_number_id IS NOT NULL
      AND (
        w.last_checked_at IS NULL
        OR w.last_checked_at < NOW() - (w.frequency_days || ' days')::interval
      )
    ORDER BY w.last_checked_at NULLS FIRST
    LIMIT ${limit}
  `) as DueWatchlistRow[];
  return rows;
}

export interface UserWatchlistRow {
  id: number;
  destination: string;
  destination_iata: string | null;
  origin_iata: string | null;
  max_price: number;
  currency: string;
  frequency_days: number;
  last_checked_at: string | null;
  last_notified_at: string | null;
}

export async function getUserWatchlist(
  sql: Sql,
  userId: number,
): Promise<UserWatchlistRow[]> {
  const rows = (await sql`
    SELECT id, destination, destination_iata, origin_iata,
           max_price, currency, frequency_days,
           last_checked_at, last_notified_at
    FROM watchlist
    WHERE user_id = ${userId} AND active = TRUE
    ORDER BY created_at DESC
  `) as UserWatchlistRow[];
  return rows;
}

export async function deleteWatchlistItem(
  sql: Sql,
  id: number,
  userId: number,
): Promise<boolean> {
  const rows = (await sql`
    DELETE FROM watchlist
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING id
  `) as { id: number }[];
  return rows.length > 0;
}

export async function markWatchlistChecked(
  sql: Sql,
  id: number,
  notified: boolean,
): Promise<void> {
  if (notified) {
    await sql`
      UPDATE watchlist
      SET last_checked_at = NOW(), last_notified_at = NOW()
      WHERE id = ${id}
    `;
  } else {
    await sql`
      UPDATE watchlist
      SET last_checked_at = NOW()
      WHERE id = ${id}
    `;
  }
}

export interface OfferEligibleUser {
  id: number;
  phone: string;
  phone_number_id: string | null;
  name: string | null;
  origin: string | null;
  countries: string[];
  cities: string[];
  budget_max: number | null;
}

export async function getOfferEligibleUsers(
  sql: Sql,
  limit = 50,
): Promise<OfferEligibleUser[]> {
  return (await sql`
    SELECT
      u.id, u.phone, u.phone_number_id, u.name,
      p.origin, p.countries, p.cities, p.budget_max
    FROM users u
    JOIN preferences p ON p.user_id = u.id
    WHERE u.phone_number_id IS NOT NULL
      AND u.phone NOT LIKE 'web:%'
      AND (u.last_offer_at IS NULL OR u.last_offer_at < NOW() - INTERVAL '20 hours')
      AND p.origin IS NOT NULL
      AND (
        jsonb_array_length(COALESCE(p.cities, '[]'::jsonb)) > 0
        OR jsonb_array_length(COALESCE(p.countries, '[]'::jsonb)) > 0
      )
      AND EXISTS (
        SELECT 1 FROM messages m
        WHERE m.user_id = u.id
          AND m.created_at > NOW() - INTERVAL '23 hours'
      )
    ORDER BY u.last_offer_at NULLS FIRST
    LIMIT ${limit}
  `) as OfferEligibleUser[];
}

export async function markUserOfferSent(sql: Sql, userId: number): Promise<void> {
  await sql`UPDATE users SET last_offer_at = NOW() WHERE id = ${userId}`;
}

export async function createDataDeletionRequest(
  sql: Sql,
  input: { phone: string; email?: string | null; reason?: string | null },
): Promise<{ id: number }> {
  const rows = (await sql`
    INSERT INTO data_deletion_requests (phone, email, reason)
    VALUES (${input.phone}, ${input.email ?? null}, ${input.reason ?? null})
    RETURNING id
  `) as { id: number }[];
  return rows[0];
}

export interface PendingDeletionRequest {
  id: number;
  phone: string;
  email: string | null;
  reason: string | null;
  created_at: string;
  age_days: number;
}

export async function listPendingDeletionRequests(
  sql: Sql,
  olderThanDays: number,
): Promise<PendingDeletionRequest[]> {
  return (await sql`
    SELECT
      id, phone, email, reason, created_at,
      EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 AS age_days
    FROM data_deletion_requests
    WHERE status = 'pending'
      AND created_at < NOW() - (${olderThanDays} || ' days')::interval
    ORDER BY created_at ASC
  `) as PendingDeletionRequest[];
}

export interface DeletionResult {
  request_id: number;
  phone: string;
  user_deleted: boolean;
  already_processed: boolean;
}

export async function processDeletionRequest(
  sql: Sql,
  requestId: number,
): Promise<DeletionResult | null> {
  const reqRows = (await sql`
    SELECT id, phone, status FROM data_deletion_requests WHERE id = ${requestId}
  `) as { id: number; phone: string; status: string }[];
  if (reqRows.length === 0) return null;
  const req = reqRows[0];
  if (req.status !== "pending") {
    return {
      request_id: req.id,
      phone: req.phone,
      user_deleted: false,
      already_processed: true,
    };
  }
  const rows = (await sql`
    WITH del AS (
      DELETE FROM users
      WHERE phone = (
        SELECT phone FROM data_deletion_requests
        WHERE id = ${requestId} AND status = 'pending'
      )
      RETURNING id
    ),
    upd AS (
      UPDATE data_deletion_requests
      SET status = 'processed', processed_at = NOW()
      WHERE id = ${requestId} AND status = 'pending'
      RETURNING id
    )
    SELECT
      (SELECT COUNT(*) FROM del)::int AS deleted_count,
      (SELECT COUNT(*) FROM upd)::int AS updated_count
  `) as Array<{ deleted_count: number; updated_count: number }>;
  return {
    request_id: req.id,
    phone: req.phone,
    user_deleted: rows[0].deleted_count > 0,
    already_processed: rows[0].updated_count === 0,
  };
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
}

export async function checkRateLimit(
  sql: Sql,
  bucket: string,
  max: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const rows = (await sql`
    INSERT INTO rate_limits (bucket, window_start, count)
    VALUES (${bucket}, NOW(), 1)
    ON CONFLICT (bucket) DO UPDATE
      SET window_start = CASE
            WHEN rate_limits.window_start < NOW() - (${windowSeconds} || ' seconds')::interval
              THEN NOW()
            ELSE rate_limits.window_start
          END,
          count = CASE
            WHEN rate_limits.window_start < NOW() - (${windowSeconds} || ' seconds')::interval
              THEN 1
            ELSE rate_limits.count + 1
          END
    RETURNING count, window_start
  `) as Array<{ count: number; window_start: string }>;
  const count = rows[0]?.count ?? 0;
  const windowStartMs = rows[0]
    ? new Date(rows[0].window_start).getTime()
    : Date.now();
  const expiresAtMs = windowStartMs + windowSeconds * 1000;
  const retryAfter = Math.max(1, Math.ceil((expiresAtMs - Date.now()) / 1000));
  return {
    allowed: count <= max,
    remaining: Math.max(0, max - count),
    retry_after_seconds: retryAfter,
  };
}

export async function recordWebhookOrSkip(
  sql: Sql,
  webhookId: string,
): Promise<boolean> {
  const rows = (await sql`
    INSERT INTO processed_webhooks (webhook_id)
    VALUES (${webhookId})
    ON CONFLICT DO NOTHING
    RETURNING webhook_id
  `) as Array<{ webhook_id: string }>;
  return rows.length === 1;
}

export async function cleanupRateLimitsAndWebhooks(sql: Sql): Promise<void> {
  await sql`DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 hour'`;
  await sql`DELETE FROM processed_webhooks WHERE created_at < NOW() - INTERVAL '30 days'`;
  await sql`DELETE FROM worker_errors WHERE occurred_at < NOW() - INTERVAL '30 days'`;
  await sql`DELETE FROM click_redirects WHERE created_at < NOW() - INTERVAL '90 days' AND click_count = 0`;
  await sql`DELETE FROM price_history WHERE observed_at < NOW() - INTERVAL '90 days'`;
}

// ─── Re-engagement nudges ─────────────────────────────────────────────────────

export interface NudgeCandidate {
  id: number;
  phone: string;
  phone_number_id: string | null;
  name: string | null;
  origin: string | null;
  countries: string[];
  last_message_at: string;
  days_silent: number;
}

export async function findNudgeCandidates(
  sql: Sql,
  args: {
    minSilentDays: number;
    maxSilentDays: number;
    minNudgeGapDays: number;
    limit: number;
  },
): Promise<NudgeCandidate[]> {
  return (await sql`
    SELECT
      u.id, u.phone, u.phone_number_id, u.name,
      p.origin, p.countries,
      MAX(m.created_at) AS last_message_at,
      EXTRACT(EPOCH FROM (NOW() - MAX(m.created_at))) / 86400 AS days_silent
    FROM users u
    JOIN preferences p ON p.user_id = u.id
    JOIN messages m ON m.user_id = u.id
    WHERE u.phone_number_id IS NOT NULL
      AND u.phone NOT LIKE 'web:%'
      AND (u.last_nudge_at IS NULL OR u.last_nudge_at < NOW() - (${args.minNudgeGapDays} || ' days')::interval)
      AND (
        jsonb_array_length(COALESCE(p.countries, '[]'::jsonb)) > 0
        OR p.origin IS NOT NULL
      )
    GROUP BY u.id, u.phone, u.phone_number_id, u.name, p.origin, p.countries
    HAVING MAX(m.created_at) < NOW() - (${args.minSilentDays} || ' days')::interval
       AND MAX(m.created_at) > NOW() - (${args.maxSilentDays} || ' days')::interval
    ORDER BY MAX(m.created_at) ASC
    LIMIT ${args.limit}
  `) as NudgeCandidate[];
}

export async function markUserNudged(sql: Sql, userId: number): Promise<void> {
  await sql`UPDATE users SET last_nudge_at = NOW() WHERE id = ${userId}`;
}

// ─── Referrals ───────────────────────────────────────────────────────────────

function makeReferralCode(): string {
  // 6-char URL-safe alphanumeric, ~57 bits of entropy. Postgres UNIQUE keeps
  // us safe from collisions.
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[b % 62])
    .join("");
}

export async function ensureReferralCode(
  sql: Sql,
  userId: number,
): Promise<string> {
  const existing = (await sql`
    SELECT referral_code FROM users WHERE id = ${userId}
  `) as Array<{ referral_code: string | null }>;
  if (existing[0]?.referral_code) return existing[0].referral_code;
  // Retry a few times in case of UNIQUE collision (vanishingly rare).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeReferralCode();
    try {
      const upd = (await sql`
        UPDATE users
        SET referral_code = ${code}
        WHERE id = ${userId} AND referral_code IS NULL
        RETURNING referral_code
      `) as Array<{ referral_code: string }>;
      if (upd[0]?.referral_code) return upd[0].referral_code;
      // Someone else set it between our SELECT and UPDATE — refetch.
      const re = (await sql`
        SELECT referral_code FROM users WHERE id = ${userId}
      `) as Array<{ referral_code: string | null }>;
      if (re[0]?.referral_code) return re[0].referral_code;
    } catch {
      // unique conflict — try another code
    }
  }
  throw new Error("could not allocate referral_code");
}

export interface ReferralLookup {
  referrer_id: number;
  referrer_name: string | null;
  referrer_code: string;
}

export async function findReferrerByCode(
  sql: Sql,
  code: string,
): Promise<ReferralLookup | null> {
  const rows = (await sql`
    SELECT id, name, referral_code FROM users
    WHERE referral_code = ${code}
    LIMIT 1
  `) as Array<{ id: number; name: string | null; referral_code: string }>;
  if (rows.length === 0) return null;
  return {
    referrer_id: Number(rows[0].id),
    referrer_name: rows[0].name,
    referrer_code: rows[0].referral_code,
  };
}

export async function setReferredBy(
  sql: Sql,
  userId: number,
  referrerId: number,
): Promise<boolean> {
  if (userId === referrerId) return false;
  const rows = (await sql`
    UPDATE users
    SET referred_by_user_id = ${referrerId}
    WHERE id = ${userId} AND referred_by_user_id IS NULL
    RETURNING id
  `) as Array<{ id: number }>;
  return rows.length === 1;
}

export async function countReferralsFor(
  sql: Sql,
  userId: number,
): Promise<number> {
  const rows = (await sql`
    SELECT COUNT(*)::int AS n
    FROM users
    WHERE referred_by_user_id = ${userId}
  `) as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}

// ─── Click tracking ──────────────────────────────────────────────────────────

export type ClickKind = "flight" | "hotel" | "package" | "offer" | "other";

export async function createClickRedirect(
  sql: Sql,
  args: {
    id: string;
    userId: number | null;
    originalUrl: string;
    kind: ClickKind;
  },
): Promise<void> {
  await sql`
    INSERT INTO click_redirects (id, user_id, original_url, kind)
    VALUES (${args.id}, ${args.userId}, ${args.originalUrl}, ${args.kind})
  `;
}

export interface ClickRedirect {
  id: string;
  user_id: number | null;
  original_url: string;
  kind: ClickKind;
  click_count: number;
}

export async function consumeClickRedirect(
  sql: Sql,
  id: string,
): Promise<ClickRedirect | null> {
  const rows = (await sql`
    UPDATE click_redirects
    SET click_count = click_count + 1, last_click_at = NOW()
    WHERE id = ${id}
    RETURNING id, user_id, original_url, kind, click_count
  `) as ClickRedirect[];
  return rows[0] ?? null;
}

// ─── Price history (drop detection) ──────────────────────────────────────────

export type PriceSource = "watchlist_cron" | "tool_search" | "offer_cron";

export async function recordPriceObservation(
  sql: Sql,
  args: {
    originIata: string;
    destinationIata: string;
    priceUsd: number;
    source: PriceSource;
  },
): Promise<void> {
  await sql`
    INSERT INTO price_history (origin_iata, destination_iata, price_usd, source)
    VALUES (${args.originIata}, ${args.destinationIata}, ${args.priceUsd}, ${args.source})
  `;
}

export interface PriceBaseline {
  observations: number;
  avg_price_usd: number;
  min_price_usd: number;
}

export async function getPriceBaseline(
  sql: Sql,
  originIata: string,
  destinationIata: string,
  windowDays: number,
): Promise<PriceBaseline | null> {
  const rows = (await sql`
    SELECT
      COUNT(*)::int AS observations,
      AVG(price_usd)::int AS avg_price_usd,
      MIN(price_usd)::int AS min_price_usd
    FROM price_history
    WHERE origin_iata = ${originIata}
      AND destination_iata = ${destinationIata}
      AND observed_at > NOW() - (${windowDays} || ' days')::interval
  `) as Array<{ observations: number; avg_price_usd: number | null; min_price_usd: number | null }>;
  const r = rows[0];
  if (!r || r.observations === 0 || r.avg_price_usd == null || r.min_price_usd == null) {
    return null;
  }
  return {
    observations: r.observations,
    avg_price_usd: r.avg_price_usd,
    min_price_usd: r.min_price_usd,
  };
}

export async function recordError(
  sql: Sql,
  context: string,
  err: unknown,
  meta?: Record<string, unknown>,
): Promise<void> {
  // Recording errors must NEVER throw — a logging failure would mask the
  // original error and could put the worker into a crash loop.
  try {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : JSON.stringify(err);
    const stack = err instanceof Error ? (err.stack ?? null) : null;
    const metaJson = meta ? JSON.stringify(meta) : null;
    await sql`
      INSERT INTO worker_errors (context, message, stack, meta)
      VALUES (
        ${context.slice(0, 100)},
        ${String(message).slice(0, 4000)},
        ${stack ? stack.slice(0, 8000) : null},
        ${metaJson}::jsonb
      )
    `;
  } catch (logErr) {
    console.error("recordError failed", logErr);
  }
}

export interface WorkerErrorRow {
  id: number;
  occurred_at: string;
  context: string;
  message: string;
  stack: string | null;
  meta: Record<string, unknown> | null;
}

export interface ErrorGroupSummary {
  context: string;
  count: number;
  latest_message: string;
  latest_occurred_at: string;
}

export async function summarizeRecentErrors(
  sql: Sql,
  sinceMinutes: number,
): Promise<ErrorGroupSummary[]> {
  return (await sql`
    SELECT
      context,
      COUNT(*)::int AS count,
      (ARRAY_AGG(message ORDER BY occurred_at DESC))[1] AS latest_message,
      MAX(occurred_at) AS latest_occurred_at
    FROM worker_errors
    WHERE occurred_at > NOW() - (${sinceMinutes} || ' minutes')::interval
    GROUP BY context
    ORDER BY count DESC
  `) as ErrorGroupSummary[];
}

export async function listRecentErrors(
  sql: Sql,
  limit: number,
  contextFilter: string | null,
): Promise<WorkerErrorRow[]> {
  if (contextFilter) {
    return (await sql`
      SELECT id, occurred_at, context, message, stack, meta
      FROM worker_errors
      WHERE context = ${contextFilter}
      ORDER BY occurred_at DESC
      LIMIT ${limit}
    `) as WorkerErrorRow[];
  }
  return (await sql`
    SELECT id, occurred_at, context, message, stack, meta
    FROM worker_errors
    ORDER BY occurred_at DESC
    LIMIT ${limit}
  `) as WorkerErrorRow[];
}

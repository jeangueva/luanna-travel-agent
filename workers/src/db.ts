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
  inactivity_nudge_count: number;
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
      u.id, u.phone, u.phone_number_id, u.name, u.inactivity_nudge_count,
      p.origin, COALESCE(p.countries, '[]'::jsonb) AS countries,
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
    GROUP BY u.id, u.phone, u.phone_number_id, u.name, u.inactivity_nudge_count, p.origin, p.countries
    HAVING MAX(m.created_at) < NOW() - (${args.minSilentDays} || ' days')::interval
       AND MAX(m.created_at) > NOW() - (${args.maxSilentDays} || ' days')::interval
    ORDER BY MAX(m.created_at) ASC
    LIMIT ${args.limit}
  `) as NudgeCandidate[];
}

/**
 * Find users due for a staggered re-engagement nudge.
 * Schedule (since last user message):
 *   - attempt 1 at day  1 (current count = 0)
 *   - attempt 2 at day  3 (current count = 1)
 *   - attempt 3 at day  7 (current count = 2)
 * After 3 attempts without a reply we stop (count >= 3) until the user
 * sends any message, which resets the counter to 0.
 */
export async function findStaggeredNudgeCandidates(
  sql: Sql,
  limit: number,
): Promise<NudgeCandidate[]> {
  return (await sql`
    SELECT
      u.id, u.phone, u.phone_number_id, u.name, u.inactivity_nudge_count,
      p.origin, COALESCE(p.countries, '[]'::jsonb) AS countries,
      MAX(m.created_at) AS last_message_at,
      EXTRACT(EPOCH FROM (NOW() - MAX(m.created_at))) / 86400 AS days_silent
    FROM users u
    LEFT JOIN preferences p ON p.user_id = u.id
    JOIN messages m ON m.user_id = u.id
    WHERE u.phone_number_id IS NOT NULL
      AND u.phone NOT LIKE 'web:%'
      AND u.inactivity_nudge_count < 3
      AND (u.last_nudge_at IS NULL OR u.last_nudge_at < NOW() - INTERVAL '20 hours')
    GROUP BY u.id, u.phone, u.phone_number_id, u.name, u.inactivity_nudge_count, p.origin, p.countries
    HAVING (
      (u.inactivity_nudge_count = 0 AND MAX(m.created_at) < NOW() - INTERVAL '1 day')
      OR (u.inactivity_nudge_count = 1 AND MAX(m.created_at) < NOW() - INTERVAL '3 days')
      OR (u.inactivity_nudge_count = 2 AND MAX(m.created_at) < NOW() - INTERVAL '7 days')
    )
    ORDER BY u.inactivity_nudge_count DESC, MAX(m.created_at) ASC
    LIMIT ${limit}
  `) as NudgeCandidate[];
}

export async function markUserNudged(sql: Sql, userId: number): Promise<void> {
  await sql`
    UPDATE users
    SET last_nudge_at = NOW(),
        inactivity_nudge_count = inactivity_nudge_count + 1
    WHERE id = ${userId}
  `;
}

export async function resetInactivityNudgeCount(
  sql: Sql,
  userId: number,
): Promise<void> {
  // No-op when already zero so we don't burn writes on chatty users.
  await sql`
    UPDATE users SET inactivity_nudge_count = 0
    WHERE id = ${userId} AND inactivity_nudge_count > 0
  `;
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

// ─── Admin dashboard ─────────────────────────────────────────────────────────

export interface DashboardStats {
  today: {
    signups: number;
    messages: number;
    clicks: number;
    errors: number;
    nudges_sent: number;
    offers_sent: number;
  };
  totals: {
    users: number;
    active_alerts: number;
    pending_deletions: number;
    total_clicks_30d: number;
    total_referrals: number;
  };
  trend_7d: Array<{ date: string; signups: number; messages: number }>;
  errors_by_context_24h: Array<{ context: string; count: number }>;
  recent_errors: Array<{
    id: number;
    occurred_at: string;
    context: string;
    message: string;
  }>;
  clicks_by_kind_7d: Array<{ kind: string; count: number }>;
  top_referrers: Array<{
    user_id: number;
    name: string | null;
    phone: string;
    invites: number;
  }>;
  recent_users: Array<{
    id: number;
    name: string | null;
    phone: string;
    created_at: string;
    last_message_at: string | null;
    message_count: number;
  }>;
}

export async function getDashboardStats(sql: Sql): Promise<DashboardStats> {
  // We issue several light queries in parallel — Neon serverless multiplexes
  // these over the connection so total latency is dominated by the slowest.
  const [
    todaySignups,
    todayMessages,
    todayClicks,
    todayErrors,
    todayNudges,
    todayOffers,
    totalUsers,
    activeAlerts,
    pendingDeletions,
    totalClicks30d,
    totalReferrals,
    trend7d,
    errorsByContext,
    recentErrors,
    clicksByKind,
    topReferrers,
    recentUsers,
  ] = await Promise.all([
    sql`SELECT COUNT(*)::int AS n FROM users WHERE created_at >= DATE_TRUNC('day', NOW())`,
    sql`SELECT COUNT(*)::int AS n FROM messages WHERE role = 'user' AND created_at >= DATE_TRUNC('day', NOW())`,
    sql`SELECT COALESCE(SUM(click_count), 0)::int AS n FROM click_redirects WHERE last_click_at >= DATE_TRUNC('day', NOW())`,
    sql`SELECT COUNT(*)::int AS n FROM worker_errors WHERE occurred_at >= DATE_TRUNC('day', NOW())`,
    sql`SELECT COUNT(*)::int AS n FROM users WHERE last_nudge_at >= DATE_TRUNC('day', NOW())`,
    sql`SELECT COUNT(*)::int AS n FROM users WHERE last_offer_at >= DATE_TRUNC('day', NOW())`,
    sql`SELECT COUNT(*)::int AS n FROM users WHERE phone NOT LIKE 'web:%'`,
    sql`SELECT COUNT(*)::int AS n FROM watchlist WHERE active = TRUE`,
    sql`SELECT COUNT(*)::int AS n FROM data_deletion_requests WHERE status = 'pending'`,
    sql`SELECT COALESCE(SUM(click_count), 0)::int AS n FROM click_redirects WHERE created_at >= NOW() - INTERVAL '30 days'`,
    sql`SELECT COUNT(*)::int AS n FROM users WHERE referred_by_user_id IS NOT NULL`,
    sql`
      WITH days AS (
        SELECT generate_series(
          DATE_TRUNC('day', NOW() - INTERVAL '6 days'),
          DATE_TRUNC('day', NOW()),
          INTERVAL '1 day'
        )::date AS day
      )
      SELECT
        d.day::text AS date,
        COUNT(DISTINCT u.id)::int AS signups,
        COUNT(m.id)::int AS messages
      FROM days d
      LEFT JOIN users u ON DATE_TRUNC('day', u.created_at) = d.day
      LEFT JOIN messages m ON DATE_TRUNC('day', m.created_at) = d.day AND m.role = 'user'
      GROUP BY d.day
      ORDER BY d.day
    `,
    sql`
      SELECT context, COUNT(*)::int AS count
      FROM worker_errors
      WHERE occurred_at >= NOW() - INTERVAL '24 hours'
      GROUP BY context
      ORDER BY count DESC
      LIMIT 10
    `,
    sql`
      SELECT id, occurred_at, context, LEFT(message, 200) AS message
      FROM worker_errors
      ORDER BY occurred_at DESC
      LIMIT 20
    `,
    sql`
      SELECT kind, COALESCE(SUM(click_count), 0)::int AS count
      FROM click_redirects
      WHERE last_click_at >= NOW() - INTERVAL '7 days'
      GROUP BY kind
      ORDER BY count DESC
    `,
    sql`
      SELECT u.id AS user_id, u.name, u.phone, COUNT(r.id)::int AS invites
      FROM users u
      JOIN users r ON r.referred_by_user_id = u.id
      GROUP BY u.id, u.name, u.phone
      ORDER BY invites DESC
      LIMIT 5
    `,
    sql`
      SELECT
        u.id, u.name, u.phone, u.created_at,
        MAX(m.created_at) AS last_message_at,
        COUNT(m.id)::int AS message_count
      FROM users u
      LEFT JOIN messages m ON m.user_id = u.id
      WHERE u.phone NOT LIKE 'web:%'
      GROUP BY u.id, u.name, u.phone, u.created_at
      ORDER BY u.created_at DESC
      LIMIT 10
    `,
  ]);

  return {
    today: {
      signups: (todaySignups as Array<{ n: number }>)[0]?.n ?? 0,
      messages: (todayMessages as Array<{ n: number }>)[0]?.n ?? 0,
      clicks: (todayClicks as Array<{ n: number }>)[0]?.n ?? 0,
      errors: (todayErrors as Array<{ n: number }>)[0]?.n ?? 0,
      nudges_sent: (todayNudges as Array<{ n: number }>)[0]?.n ?? 0,
      offers_sent: (todayOffers as Array<{ n: number }>)[0]?.n ?? 0,
    },
    totals: {
      users: (totalUsers as Array<{ n: number }>)[0]?.n ?? 0,
      active_alerts: (activeAlerts as Array<{ n: number }>)[0]?.n ?? 0,
      pending_deletions: (pendingDeletions as Array<{ n: number }>)[0]?.n ?? 0,
      total_clicks_30d: (totalClicks30d as Array<{ n: number }>)[0]?.n ?? 0,
      total_referrals: (totalReferrals as Array<{ n: number }>)[0]?.n ?? 0,
    },
    trend_7d: trend7d as DashboardStats["trend_7d"],
    errors_by_context_24h: errorsByContext as DashboardStats["errors_by_context_24h"],
    recent_errors: (recentErrors as DashboardStats["recent_errors"]).map((e) => ({
      ...e,
      id: Number(e.id),
    })),
    clicks_by_kind_7d: clicksByKind as DashboardStats["clicks_by_kind_7d"],
    top_referrers: (topReferrers as DashboardStats["top_referrers"]).map((r) => ({
      ...r,
      user_id: Number(r.user_id),
    })),
    recent_users: (recentUsers as DashboardStats["recent_users"]).map((u) => ({
      ...u,
      id: Number(u.id),
    })),
  };
}

// ─── Click tracking ──────────────────────────────────────────────────────────

export type ClickKind = "flight" | "hotel" | "package" | "offer" | "watchlist" | "other";

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

export type FeedbackKind = "bug" | "idea" | "praise" | "other";

export interface FeedbackRow {
  id: number;
  user_id: number | null;
  phone: string | null;
  kind: FeedbackKind;
  text: string;
  source: string;
  created_at: string;
}

export async function recordFeedback(
  sql: Sql,
  userId: number | null,
  kind: FeedbackKind,
  text: string,
  source: string,
): Promise<void> {
  try {
    await sql`
      INSERT INTO feedback (user_id, kind, text, source)
      VALUES (${userId}, ${kind}, ${text.slice(0, 4000)}, ${source.slice(0, 30)})
    `;
  } catch (err) {
    console.error("recordFeedback failed", err);
  }
}

export async function listRecentFeedback(
  sql: Sql,
  limit: number,
): Promise<FeedbackRow[]> {
  return (await sql`
    SELECT f.id, f.user_id, u.phone, f.kind, f.text, f.source, f.created_at
    FROM feedback f
    LEFT JOIN users u ON u.id = f.user_id
    ORDER BY f.created_at DESC
    LIMIT ${limit}
  `) as FeedbackRow[];
}

// ─── Magic-link merge (web ↔ WhatsApp) ───────────────────────────────────────

export interface LinkCodeRow {
  code: string;
  web_user_id: number;
  linked_user_id: number | null;
  status: "pending" | "completed" | "expired";
  expires_at: string;
}

function makeLinkCode(): string {
  // 8-char URL-safe alphanumeric, ~47 bits of entropy. Codes are short-lived
  // (15 min) and one-shot, so the collision window is tiny.
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 56])
    .join("");
}

export async function createLinkCode(
  sql: Sql,
  webUserId: number,
): Promise<string> {
  // Retry briefly in case of a UNIQUE collision (vanishingly rare).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeLinkCode();
    try {
      await sql`
        INSERT INTO link_codes (code, web_user_id, expires_at)
        VALUES (${code}, ${webUserId}, NOW() + INTERVAL '15 minutes')
      `;
      return code;
    } catch (err) {
      if (attempt === 4) throw err;
    }
  }
  throw new Error("createLinkCode: exhausted retries");
}

export async function findLinkCode(
  sql: Sql,
  code: string,
): Promise<LinkCodeRow | null> {
  const rows = (await sql`
    SELECT code, web_user_id, linked_user_id, status, expires_at
    FROM link_codes
    WHERE code = ${code}
    LIMIT 1
  `) as LinkCodeRow[];
  return rows[0] ?? null;
}

export async function completeLinkCode(
  sql: Sql,
  code: string,
  linkedUserId: number,
): Promise<void> {
  await sql`
    UPDATE link_codes
    SET status = 'completed', linked_user_id = ${linkedUserId}, completed_at = NOW()
    WHERE code = ${code} AND status = 'pending'
  `;
}

/**
 * Move all data belonging to `webUserId` over to `targetUserId` and delete
 * the web user row. Designed for the magic-link merge: the web user's
 * messages, preferences, watchlist items, click redirects, feedback, and
 * email get folded into the WhatsApp user's record. The WhatsApp user's
 * own values take precedence on conflict; we only copy from the web side
 * when the WhatsApp side is empty.
 */
export async function mergeWebUserInto(
  sql: Sql,
  webUserId: number,
  targetUserId: number,
): Promise<void> {
  if (webUserId === targetUserId) return;
  // Touch each table that has a user_id FK. We do this in a single batched
  // call to Neon to minimize roundtrips; order matters only for the prefs
  // merge below (we read web's prefs before deleting them).
  const webPrefsRows = (await sql`
    SELECT origin, countries, cities, styles, budget_min, budget_max, budget_currency
    FROM preferences WHERE user_id = ${webUserId}
  `) as Array<{
    origin: string | null;
    countries: unknown;
    cities: unknown;
    styles: unknown;
    budget_min: number | null;
    budget_max: number | null;
    budget_currency: string | null;
  }>;
  const webEmail = (await sql`
    SELECT email FROM users WHERE id = ${webUserId} AND email IS NOT NULL
  `) as Array<{ email: string }>;

  // Move messages, watchlist, click_redirects, feedback over by FK update.
  await sql`UPDATE messages SET user_id = ${targetUserId} WHERE user_id = ${webUserId}`;
  await sql`UPDATE watchlist SET user_id = ${targetUserId} WHERE user_id = ${webUserId}`;
  await sql`UPDATE click_redirects SET user_id = ${targetUserId} WHERE user_id = ${webUserId}`;
  await sql`UPDATE feedback SET user_id = ${targetUserId} WHERE user_id = ${webUserId}`;

  // Merge preferences: COALESCE picks the target's existing value first,
  // falling back to the web user's. Then drop the web row so the FK CASCADE
  // doesn't try to remove the merged data when we delete the user.
  if (webPrefsRows.length > 0) {
    const wp = webPrefsRows[0];
    await sql`
      INSERT INTO preferences (
        user_id, origin, countries, cities, styles,
        budget_min, budget_max, budget_currency
      )
      VALUES (
        ${targetUserId},
        ${wp.origin},
        ${JSON.stringify(wp.countries ?? [])}::jsonb,
        ${JSON.stringify(wp.cities ?? [])}::jsonb,
        ${JSON.stringify(wp.styles ?? [])}::jsonb,
        ${wp.budget_min},
        ${wp.budget_max},
        ${wp.budget_currency ?? "USD"}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        origin = COALESCE(preferences.origin, EXCLUDED.origin),
        countries = CASE
          WHEN jsonb_array_length(COALESCE(preferences.countries, '[]'::jsonb)) > 0
            THEN preferences.countries
          ELSE EXCLUDED.countries
        END,
        cities = CASE
          WHEN jsonb_array_length(COALESCE(preferences.cities, '[]'::jsonb)) > 0
            THEN preferences.cities
          ELSE EXCLUDED.cities
        END,
        styles = CASE
          WHEN jsonb_array_length(COALESCE(preferences.styles, '[]'::jsonb)) > 0
            THEN preferences.styles
          ELSE EXCLUDED.styles
        END,
        budget_min = COALESCE(preferences.budget_min, EXCLUDED.budget_min),
        budget_max = COALESCE(preferences.budget_max, EXCLUDED.budget_max)
    `;
    await sql`DELETE FROM preferences WHERE user_id = ${webUserId}`;
  }

  // Carry over email only if the WhatsApp user doesn't have one.
  if (webEmail.length > 0) {
    await sql`
      UPDATE users SET email = ${webEmail[0].email}, email_captured_at = NOW()
      WHERE id = ${targetUserId} AND email IS NULL
    `;
  }

  // Finally, drop the web user. CASCADE handles link_codes pointing here.
  await sql`DELETE FROM users WHERE id = ${webUserId}`;
}

// ─── Gamification: engagement points + partner promo codes ──────────────────
//
// Points are COMPUTED from activity we already record (no new write paths, so
// there's nothing to farm): active days, link clicks, alerts created.
// Levels: 1 Explorador (0+) · 2 Viajero (40+) · 3 Trotamundos (120+).

export interface UserEngagement {
  points: number;
  level: number;
  level_name: string;
  next_level_points: number | null;
  active_days: number;
  clicks: number;
  alerts: number;
}

const LEVELS: Array<{ level: number; name: string; min: number }> = [
  { level: 3, name: "Trotamundos", min: 120 },
  { level: 2, name: "Viajero", min: 40 },
  { level: 1, name: "Explorador", min: 0 },
];

export async function getUserEngagement(
  sql: Sql,
  userId: number,
): Promise<UserEngagement> {
  const [days, clicks, alerts] = await Promise.all([
    sql`SELECT COUNT(DISTINCT DATE(created_at))::int AS n FROM messages WHERE user_id = ${userId} AND role = 'user'`,
    sql`SELECT COALESCE(SUM(click_count), 0)::int AS n FROM click_redirects WHERE user_id = ${userId}`,
    sql`SELECT COUNT(*)::int AS n FROM watchlist WHERE user_id = ${userId}`,
  ]) as Array<Array<{ n: number }>>;
  const active_days = days[0]?.n ?? 0;
  const clickCount = clicks[0]?.n ?? 0;
  const alertCount = alerts[0]?.n ?? 0;
  const points = active_days * 2 + clickCount * 5 + alertCount * 10;
  const tier = LEVELS.find((l) => points >= l.min)!;
  const nextTier = LEVELS.filter((l) => l.min > points).pop() ?? null;
  return {
    points,
    level: tier.level,
    level_name: tier.name,
    next_level_points: nextTier ? nextTier.min : null,
    active_days,
    clicks: clickCount,
    alerts: alertCount,
  };
}

export interface PromoCode {
  id: number;
  code: string;
  description: string;
  min_level: number;
}

/** The promo the user already claimed, if any (one per user). */
export async function getClaimedPromo(
  sql: Sql,
  userId: number,
): Promise<PromoCode | null> {
  const rows = (await sql`
    SELECT id, code, description, min_level FROM promo_codes
    WHERE claimed_by = ${userId} LIMIT 1
  `) as PromoCode[];
  return rows[0] ?? null;
}

/**
 * Claim the best available promo for the user's level (one per user, atomic:
 * the UPDATE only wins the row if it's still unclaimed). Returns null when
 * none available or the user already claimed one.
 */
export async function claimPromoForLevel(
  sql: Sql,
  userId: number,
  level: number,
): Promise<PromoCode | null> {
  const existing = await getClaimedPromo(sql, userId);
  if (existing) return null;
  const rows = (await sql`
    UPDATE promo_codes SET claimed_by = ${userId}, claimed_at = NOW()
    WHERE id = (
      SELECT id FROM promo_codes
      WHERE active = TRUE AND claimed_by IS NULL AND min_level <= ${level}
      ORDER BY min_level DESC, id ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, code, description, min_level
  `) as PromoCode[];
  return rows[0] ?? null;
}

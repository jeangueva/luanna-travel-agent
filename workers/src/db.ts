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
}

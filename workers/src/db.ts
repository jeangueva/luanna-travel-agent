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
  const delRows = (await sql`
    DELETE FROM users WHERE phone = ${req.phone} RETURNING id
  `) as { id: number }[];
  await sql`
    UPDATE data_deletion_requests
    SET status = 'processed', processed_at = NOW()
    WHERE id = ${requestId}
  `;
  return {
    request_id: req.id,
    phone: req.phone,
    user_deleted: delRows.length > 0,
    already_processed: false,
  };
}

import {
  cleanupRateLimitsAndWebhooks,
  getDb,
  getDueWatchlist,
  getOfferEligibleUsers,
  markUserOfferSent,
  markWatchlistChecked,
  recordError,
  summarizeRecentErrors,
  type DueWatchlistRow,
  type OfferEligibleUser,
} from "./db";
import { sendKapsoText } from "./kapso";
import { distinctIdForUser, track } from "./posthog";

export interface CronEnv {
  DATABASE_URL: string;
  KAPSO_API_KEY: string;
  TRAVELPAYOUTS_TOKEN: string;
  TRAVELPAYOUTS_MARKER: string;
  ALERT_WEBHOOK_URL?: string;
  POSTHOG_API_KEY?: string;
  POSTHOG_HOST?: string;
}

// Common destination → IATA map for daily-offer flight search.
// Keys are lowercased + diacritics-stripped. Only cities reachable as IATA
// origin/destination are listed. Extend as more cities show up in user prefs.
const CITY_TO_IATA: Record<string, { iata: string; pretty: string }> = {
  "lima": { iata: "LIM", pretty: "Lima" },
  "cusco": { iata: "CUZ", pretty: "Cusco" },
  "arequipa": { iata: "AQP", pretty: "Arequipa" },
  "madrid": { iata: "MAD", pretty: "Madrid" },
  "barcelona": { iata: "BCN", pretty: "Barcelona" },
  "paris": { iata: "CDG", pretty: "París" },
  "londres": { iata: "LHR", pretty: "Londres" },
  "london": { iata: "LHR", pretty: "Londres" },
  "roma": { iata: "FCO", pretty: "Roma" },
  "rome": { iata: "FCO", pretty: "Roma" },
  "milan": { iata: "MXP", pretty: "Milán" },
  "milán": { iata: "MXP", pretty: "Milán" },
  "amsterdam": { iata: "AMS", pretty: "Amsterdam" },
  "berlin": { iata: "BER", pretty: "Berlín" },
  "berlín": { iata: "BER", pretty: "Berlín" },
  "lisboa": { iata: "LIS", pretty: "Lisboa" },
  "lisbon": { iata: "LIS", pretty: "Lisboa" },
  "buenos aires": { iata: "EZE", pretty: "Buenos Aires" },
  "santiago": { iata: "SCL", pretty: "Santiago" },
  "bogota": { iata: "BOG", pretty: "Bogotá" },
  "bogotá": { iata: "BOG", pretty: "Bogotá" },
  "medellin": { iata: "MDE", pretty: "Medellín" },
  "medellín": { iata: "MDE", pretty: "Medellín" },
  "cartagena": { iata: "CTG", pretty: "Cartagena" },
  "cancun": { iata: "CUN", pretty: "Cancún" },
  "cancún": { iata: "CUN", pretty: "Cancún" },
  "ciudad de mexico": { iata: "MEX", pretty: "CDMX" },
  "cdmx": { iata: "MEX", pretty: "CDMX" },
  "mexico": { iata: "MEX", pretty: "CDMX" },
  "méxico": { iata: "MEX", pretty: "CDMX" },
  "guadalajara": { iata: "GDL", pretty: "Guadalajara" },
  "miami": { iata: "MIA", pretty: "Miami" },
  "nueva york": { iata: "JFK", pretty: "Nueva York" },
  "new york": { iata: "JFK", pretty: "Nueva York" },
  "los angeles": { iata: "LAX", pretty: "Los Ángeles" },
  "los ángeles": { iata: "LAX", pretty: "Los Ángeles" },
  "san francisco": { iata: "SFO", pretty: "San Francisco" },
  "orlando": { iata: "MCO", pretty: "Orlando" },
  "rio de janeiro": { iata: "GIG", pretty: "Rio" },
  "rio": { iata: "GIG", pretty: "Rio" },
  "sao paulo": { iata: "GRU", pretty: "São Paulo" },
  "são paulo": { iata: "GRU", pretty: "São Paulo" },
  "quito": { iata: "UIO", pretty: "Quito" },
  "panama": { iata: "PTY", pretty: "Panamá" },
  "panamá": { iata: "PTY", pretty: "Panamá" },
  "punta cana": { iata: "PUJ", pretty: "Punta Cana" },
  "tokio": { iata: "HND", pretty: "Tokio" },
  "tokyo": { iata: "HND", pretty: "Tokio" },
};

function normalizeCity(city: string): string {
  return city
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function resolveOriginIata(origin: string): string | null {
  // Allow "LIM" / "MAD" pass-through if 3 uppercase letters.
  const trimmed = origin.trim();
  if (/^[A-Z]{3}$/.test(trimmed)) return trimmed;
  const norm = normalizeCity(origin);
  // Match by normalized key — strip accents in CITY_TO_IATA keys too.
  for (const [key, val] of Object.entries(CITY_TO_IATA)) {
    if (normalizeCity(key) === norm) return val.iata;
  }
  return null;
}

interface ResolvedDestination {
  iata: string;
  pretty: string;
  raw: string;
}

function resolveDestination(cities: string[]): ResolvedDestination | null {
  for (const raw of cities) {
    const norm = normalizeCity(raw);
    const hit = CITY_TO_IATA[norm];
    if (hit) {
      return { iata: hit.iata, pretty: hit.pretty, raw };
    }
  }
  return null;
}

interface CheapestFlight {
  price: number;
  airline: string;
  departure_at: string;
  link: string | null;
}

async function findCheapest(
  env: CronEnv,
  origin: string,
  destination: string,
): Promise<CheapestFlight | null> {
  const url = new URL(
    "https://api.travelpayouts.com/aviasales/v3/prices_for_dates",
  );
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  url.searchParams.set("currency", "usd");
  url.searchParams.set("sorting", "price");
  url.searchParams.set("limit", "1");
  url.searchParams.set("unique", "false");

  const res = await fetch(url.toString(), {
    headers: { "X-Access-Token": env.TRAVELPAYOUTS_TOKEN },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    data?: Array<{
      price: number;
      airline: string;
      departure_at: string;
      link?: string;
    }>;
  };
  const flight = json.data?.[0];
  if (!flight) return null;
  return {
    price: flight.price,
    airline: flight.airline,
    departure_at: flight.departure_at,
    link: flight.link
      ? `https://www.aviasales.com${flight.link}${flight.link.includes("?") ? "&" : "?"}marker=${env.TRAVELPAYOUTS_MARKER}`
      : null,
  };
}

function formatNotification(row: DueWatchlistRow, f: CheapestFlight): string {
  const date = f.departure_at.slice(0, 10);
  const lines = [
    `🎉 Bajó el precio a ${row.destination}!`,
    `${row.origin_iata}→${row.destination_iata} desde $${f.price} (tu límite: $${row.max_price})`,
    `${f.airline} · sale ${date}`,
  ];
  if (f.link) lines.push(f.link);
  return lines.join("\n");
}

async function processWatchlistRow(
  env: CronEnv,
  row: DueWatchlistRow,
): Promise<void> {
  const sql = getDb(env.DATABASE_URL);
  if (!row.origin_iata || !row.destination_iata || !row.phone_number_id) {
    await markWatchlistChecked(sql, row.id, false);
    return;
  }

  const cheapest = await findCheapest(env, row.origin_iata, row.destination_iata);

  if (!cheapest || cheapest.price > row.max_price) {
    await markWatchlistChecked(sql, row.id, false);
    return;
  }

  await sendKapsoText({
    apiKey: env.KAPSO_API_KEY,
    phoneNumberId: row.phone_number_id,
    to: row.phone,
    body: formatNotification(row, cheapest),
  });
  await markWatchlistChecked(sql, row.id, true);
}

export async function runWatchlistCron(env: CronEnv): Promise<void> {
  const sql = getDb(env.DATABASE_URL);
  const due = await getDueWatchlist(sql, 50);
  console.log(`watchlist cron: ${due.length} due`);
  for (const row of due) {
    try {
      await processWatchlistRow(env, row);
    } catch (err) {
      console.error(`watchlist row ${row.id} failed`, err);
      await recordError(sql, "cron:watchlist", err, {
        watchlist_id: row.id,
        user_id: row.user_id,
      });
    }
  }
}

function formatOfferMessage(
  user: OfferEligibleUser,
  dest: ResolvedDestination,
  flight: CheapestFlight,
): string {
  const name = user.name ? `, ${user.name}` : "";
  const date = flight.departure_at.slice(0, 10);
  const lines = [
    `☀️ ¡Buenos días${name}! Oferta del día 🔥`,
    `${user.origin}→${dest.iata} a ${dest.pretty} desde $${flight.price}`,
    `${flight.airline} · sale ${date}`,
  ];
  if (flight.link) lines.push(flight.link);
  lines.push("¿Te animas o te busco otra fecha? 😏");
  return lines.join("\n");
}

async function processOfferUser(
  env: CronEnv,
  user: OfferEligibleUser,
): Promise<"sent" | "skipped"> {
  if (!user.phone_number_id || !user.origin) return "skipped";
  const originIata = resolveOriginIata(user.origin);
  if (!originIata) return "skipped";
  const destination = resolveDestination(user.cities);
  if (!destination) return "skipped";
  if (originIata === destination.iata) return "skipped";

  const flight = await findCheapest(env, originIata, destination.iata);
  if (!flight) return "skipped";
  if (user.budget_max && flight.price > user.budget_max) return "skipped";

  await sendKapsoText({
    apiKey: env.KAPSO_API_KEY,
    phoneNumberId: user.phone_number_id,
    to: user.phone,
    body: formatOfferMessage(user, destination, flight),
  });
  const sql = getDb(env.DATABASE_URL);
  await markUserOfferSent(sql, user.id);
  await track(env, {
    event: "daily_offer_sent",
    distinct_id: distinctIdForUser(user.id),
    properties: {
      origin: user.origin,
      destination_iata: destination.iata,
      destination_pretty: destination.pretty,
      price_usd: flight.price,
      airline: flight.airline,
    },
  });
  return "sent";
}

export async function runErrorAlertCron(env: CronEnv): Promise<void> {
  if (!env.ALERT_WEBHOOK_URL) return;
  const sql = getDb(env.DATABASE_URL);
  let groups;
  try {
    groups = await summarizeRecentErrors(sql, 60);
  } catch (err) {
    console.error("alert cron: summarize failed", err);
    return;
  }
  if (groups.length === 0) {
    console.log("alert cron: 0 errors in last 60min, skipping");
    return;
  }
  const total = groups.reduce((acc, g) => acc + g.count, 0);
  const top = groups.slice(0, 5);
  const lines = [
    `🚨 Luanna worker: ${total} error${total === 1 ? "" : "s"} en la última hora`,
    "",
    ...top.map(
      (g) =>
        `• ${g.context} (${g.count}) — ${g.latest_message.slice(0, 120)}`,
    ),
    "",
    "Query: GET https://luanna.app/admin/errors/recent (Bearer ADMIN_API_KEY)",
  ];
  const text = lines.join("\n");
  try {
    const res = await fetch(env.ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Both keys for compat — Slack uses `text`, Discord uses `content`.
      body: JSON.stringify({ text, content: text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`alert webhook ${res.status}`, body.slice(0, 200));
      await recordError(sql, "cron:alert", new Error(`webhook ${res.status}`), {
        status: res.status,
        body_preview: body.slice(0, 200),
      });
    } else {
      console.log(`alert cron: posted digest for ${total} errors`);
    }
  } catch (err) {
    console.error("alert webhook fetch error", err);
    await recordError(sql, "cron:alert", err);
  }
}

export async function runCleanupCron(env: CronEnv): Promise<void> {
  const sql = getDb(env.DATABASE_URL);
  try {
    await cleanupRateLimitsAndWebhooks(sql);
    console.log("cleanup cron: done");
  } catch (err) {
    console.error("cleanup cron failed", err);
    await recordError(sql, "cron:cleanup", err);
  }
}

export async function runDailyOffersCron(env: CronEnv): Promise<void> {
  const sql = getDb(env.DATABASE_URL);
  const eligible = await getOfferEligibleUsers(sql, 50);
  console.log(`daily offers cron: ${eligible.length} eligible`);
  let sent = 0;
  let skipped = 0;
  for (const user of eligible) {
    try {
      const result = await processOfferUser(env, user);
      if (result === "sent") sent++;
      else skipped++;
    } catch (err) {
      console.error(`offers cron user ${user.id} failed`, err);
      skipped++;
      await recordError(sql, "cron:offers", err, { user_id: user.id });
    }
  }
  console.log(`daily offers cron: sent=${sent} skipped=${skipped}`);
}

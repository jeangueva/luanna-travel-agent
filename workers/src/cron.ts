import {
  cleanupRateLimitsAndWebhooks,
  createClickRedirect,
  findNudgeCandidates,
  findStaggeredNudgeCandidates,
  getDb,
  getDueWatchlist,
  getOfferEligibleUsers,
  getPriceBaseline,
  markUserNudged,
  markUserOfferSent,
  markWatchlistChecked,
  recordError,
  recordPriceObservation,
  summarizeRecentErrors,
  type DueWatchlistRow,
  type NudgeCandidate,
  type OfferEligibleUser,
  type Sql,
} from "./db";
import { sendKapsoText, sendKapsoTemplate, isOutside24hWindow } from "./kapso";
import { distinctIdForUser, track } from "./posthog";
import { HOLIDAYS, holidaysWithinDays } from "./holidays";
import { wrapClickUrl } from "./tools";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

export interface CronEnv {
  DATABASE_URL: string;
  KAPSO_API_KEY: string;
  TRAVELPAYOUTS_TOKEN: string;
  TRAVELPAYOUTS_MARKER: string;
  ANTHROPIC_API_KEY?: string;
  LUANNA_MODEL?: string;
  ALERT_WEBHOOK_URL?: string;
  /** Owner's WhatsApp (E.164 no +) — error digests go here when no webhook. */
  ADMIN_ALERT_PHONE?: string;
  /** The bot's Meta phone_number_id, needed to send the admin WhatsApp. */
  KAPSO_PHONE_NUMBER_ID?: string;
  POSTHOG_API_KEY?: string;
  POSTHOG_HOST?: string;
  PUBLIC_BASE_URL?: string;
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
  dates?: { departureAt: string; returnAt?: string },
): Promise<CheapestFlight | null> {
  const url = new URL(
    "https://api.travelpayouts.com/aviasales/v3/prices_for_dates",
  );
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  if (dates?.departureAt) url.searchParams.set("departure_at", dates.departureAt);
  if (dates?.returnAt) {
    url.searchParams.set("return_at", dates.returnAt);
    url.searchParams.set("one_way", "false");
  }
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

function formatDropNotification(
  row: DueWatchlistRow,
  f: CheapestFlight,
  baseline: { avg: number; pct_below: number },
): string {
  const date = f.departure_at.slice(0, 10);
  const lines = [
    `🔥 ¡Bajó el precio! ${row.origin_iata}→${row.destination_iata}`,
    `Desde $${f.price} ahora (promedio reciente $${baseline.avg}, ${baseline.pct_below}% menos)`,
    `${f.airline} · sale ${date}`,
  ];
  if (f.link) lines.push(f.link);
  return lines.join("\n");
}

function formatFirstAlertNotification(
  row: DueWatchlistRow,
  f: CheapestFlight,
): string {
  const date = f.departure_at.slice(0, 10);
  const lines = [
    `✈️ Tu alerta ${row.origin_iata}→${row.destination_iata} está activa`,
    `Precio actual: $${f.price} con ${f.airline} · sale ${date}`,
    `Te aviso si baja en próximos chequeos.`,
  ];
  if (f.link) lines.push(f.link);
  return lines.join("\n");
}

// Send a proactive message free-form. If we're outside the 24-hour window
// (user silent >24h), Meta rejects free-form, so fall back to an approved
// template that re-opens the conversation. The template intentionally omits
// the deep link — once the user taps "Ver opciones"/"Sí, búscame precios" and
// replies, the window reopens and the normal LLM flow sends the real links.
async function sendProactive(
  env: CronEnv,
  args: {
    phoneNumberId: string;
    to: string;
    body: string;
    templateName: string;
    templateParams: Record<string, string>;
  },
): Promise<"text" | "template"> {
  try {
    await sendKapsoText({
      apiKey: env.KAPSO_API_KEY,
      phoneNumberId: args.phoneNumberId,
      to: args.to,
      body: args.body,
    });
    return "text";
  } catch (err) {
    if (!isOutside24hWindow(err)) throw err;
    await sendKapsoTemplate({
      apiKey: env.KAPSO_API_KEY,
      phoneNumberId: args.phoneNumberId,
      to: args.to,
      templateName: args.templateName,
      bodyParams: args.templateParams,
    });
    return "template";
  }
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
  if (!cheapest) {
    await markWatchlistChecked(sql, row.id, false);
    return;
  }

  // Wrap the flight URL through our click redirect so the WhatsApp message
  // shows luanna.app/r/<id> instead of the 200-char aviasales link. The
  // redirect also tracks clicks, which we can't get from the raw URL.
  if (cheapest.link) {
    const baseUrl = env.PUBLIC_BASE_URL ?? "https://luanna.app";
    cheapest.link = await wrapClickUrl(
      { sql, userId: row.user_id, baseUrl },
      "watchlist",
      cheapest.link,
    );
  }

  // Always record the observation for future baseline comparisons.
  try {
    await recordPriceObservation(sql, {
      originIata: row.origin_iata,
      destinationIata: row.destination_iata,
      priceUsd: cheapest.price,
      source: "watchlist_cron",
    });
  } catch (_) { /* never fail on logging */ }

  // Compare against the 30-day baseline. If we have <=2 observations yet,
  // treat it as the "first" alert so the user sees their watchlist working.
  // Otherwise, only notify when the current price is at least 10% below the
  // recent average (the "real drop" semantics).
  const baseline = await getPriceBaseline(
    sql,
    row.origin_iata,
    row.destination_iata,
    30,
  );

  let body: string;
  let shouldSend: boolean;
  if (!baseline || baseline.observations <= 2) {
    body = formatFirstAlertNotification(row, cheapest);
    shouldSend = true;
  } else {
    const pctBelow = Math.round(
      ((baseline.avg_price_usd - cheapest.price) / baseline.avg_price_usd) * 100,
    );
    if (pctBelow >= 10) {
      body = formatDropNotification(row, cheapest, {
        avg: baseline.avg_price_usd,
        pct_below: pctBelow,
      });
      shouldSend = true;
    } else {
      shouldSend = false;
      body = "";
    }
  }

  if (!shouldSend) {
    await markWatchlistChecked(sql, row.id, false);
    return;
  }

  await sendProactive(env, {
    phoneNumberId: row.phone_number_id,
    to: row.phone,
    body,
    templateName: "alerta_precio",
    templateParams: {
      nombre: "viajero",
      ruta: `${row.origin_iata} → ${row.destination || row.destination_iata}`,
      precio: `$${cheapest.price}`,
    },
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

// ─── Weekend getaway mode (M4: proactive planner) ───────────────────────────
// On Fridays the daily offer becomes a real bookable weekend escape: cheapest
// round-trip leaving tomorrow (Saturday) and returning Sunday, from the user's
// saved origin to one of their favorite destinations.

/** Next Saturday and Sunday (UTC) as YYYY-MM-DD. Assumes today is Friday. */
function upcomingWeekendDates(now: Date): { sat: string; sun: string } {
  const day = now.getUTCDay(); // 5 = Friday
  const toSat = (6 - day + 7) % 7 || 7; // days until next Saturday (>=1)
  const sat = new Date(now.getTime() + toSat * 86400000);
  const sun = new Date(sat.getTime() + 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { sat: fmt(sat), sun: fmt(sun) };
}

function formatWeekendMessage(
  user: OfferEligibleUser,
  dest: ResolvedDestination,
  flight: CheapestFlight,
  dates: { sat: string; sun: string },
): string {
  const name = user.name ? `, ${user.name}` : "";
  const lines = [
    `🌴 ¡Escapada de finde${name}!`,
    `Este sábado tienes ${user.origin} → ${dest.pretty} por $${flight.price} ida y vuelta`,
    `${flight.airline} · sale sáb ${dates.sat.slice(8, 10)} · vuelve dom ${dates.sun.slice(8, 10)}`,
  ];
  if (flight.link) lines.push(flight.link);
  lines.push("¿Te animas? También te puedo buscar hotel 🏨");
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

  // Friday → weekend-getaway mode: a real bookable Sat→Sun round trip.
  // Falls back to the regular open-dates offer when the weekend has nothing.
  const now = new Date();
  const isFriday = now.getUTCDay() === 5;
  let weekend: { sat: string; sun: string } | null = null;
  let flight: CheapestFlight | null = null;
  if (isFriday) {
    weekend = upcomingWeekendDates(now);
    flight = await findCheapest(env, originIata, destination.iata, {
      departureAt: weekend.sat,
      returnAt: weekend.sun,
    });
    if (!flight) weekend = null; // nothing for the weekend → regular offer
  }
  if (!flight) flight = await findCheapest(env, originIata, destination.iata);
  if (!flight) return "skipped";
  if (user.budget_max && flight.price > user.budget_max) return "skipped";

  if (flight.link) {
    const baseUrl = env.PUBLIC_BASE_URL ?? "https://luanna.app";
    const sqlForClick = getDb(env.DATABASE_URL);
    flight.link = await wrapClickUrl(
      { sql: sqlForClick, userId: user.id, baseUrl },
      "offer",
      flight.link,
    );
  }

  await sendProactive(env, {
    phoneNumberId: user.phone_number_id,
    to: user.phone,
    body: weekend
      ? formatWeekendMessage(user, destination, flight, weekend)
      : formatOfferMessage(user, destination, flight),
    templateName: "alerta_precio",
    templateParams: {
      nombre: user.name || "viajero",
      ruta: `${user.origin} → ${destination.pretty}`,
      precio: `$${flight.price}`,
    },
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
  const waAdmin = env.ADMIN_ALERT_PHONE && env.KAPSO_PHONE_NUMBER_ID;
  if (!env.ALERT_WEBHOOK_URL && !waAdmin) return;
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

  // Channel 1: generic webhook (Slack `text` / Discord `content`).
  if (env.ALERT_WEBHOOK_URL) {
    try {
      const res = await fetch(env.ALERT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  // Channel 2: WhatsApp to the owner via the bot itself. Caveat: Meta's 24h
  // window applies — if the owner hasn't messaged Luanna in >24h this send
  // fails (logged, not retried). The /admin dashboard remains the backstop.
  if (waAdmin) {
    try {
      await sendKapsoText({
        apiKey: env.KAPSO_API_KEY,
        phoneNumberId: env.KAPSO_PHONE_NUMBER_ID!,
        to: env.ADMIN_ALERT_PHONE!,
        body: text,
      });
      console.log(`alert cron: WhatsApp digest sent for ${total} errors`);
    } catch (err) {
      // Don't recordError here — a failed alert about errors would feed
      // itself into next hour's digest forever.
      console.error("alert whatsapp send failed", err);
    }
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

// ─── Re-engagement cron ───────────────────────────────────────────────────────

const DEFAULT_NUDGE_MODEL = "claude-haiku-4-5";

async function generateNudgeText(
  env: CronEnv,
  user: NudgeCandidate,
): Promise<string> {
  // Fallback if no Anthropic key — small templated nudge.
  if (!env.ANTHROPIC_API_KEY) {
    const dest = user.countries[0] ?? "tu próximo viaje";
    const greet = user.name ? `Hey ${user.name}` : "Hey";
    return `${greet}! 👋 ¿Sigue en pie ${dest}? Si quieres puedo chequearte precios ahora mismo ✈️`;
  }
  const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const model = anthropic(env.LUANNA_MODEL ?? DEFAULT_NUDGE_MODEL);
  const interests = user.countries.slice(0, 4).join(", ") || "viajar";
  const ctx =
    `Usuario: ${user.name ?? "sin nombre"}\n` +
    `Origen: ${user.origin ?? "?"}\n` +
    `Intereses guardados: ${interests}\n` +
    `Días sin escribir: ${Math.round(user.days_silent)}\n`;
  const system =
    "Eres Luanna, agente de viajes por WhatsApp. Genera UN solo mensaje breve (40-180 chars, 1-2 frases, " +
    "1-2 emojis), cálido y no pushy, para que el usuario silencioso vuelva a hablarte. " +
    "Si tienes nombre, úsalo. Si tienes destinos guardados, menciona uno casualmente. " +
    "Nunca prometas precios concretos. Nunca incluyas links. Responde solo el texto del mensaje, sin comillas.";
  try {
    const { text } = await generateText({
      model,
      system,
      prompt: ctx,
    });
    const cleaned = text.replace(/^["']|["']$/g, "").trim();
    if (cleaned.length < 10 || cleaned.length > 280) {
      const dest = user.countries[0] ?? "tu próximo viaje";
      const greet = user.name ? `Hey ${user.name}` : "Hey";
      return `${greet}! 👋 ¿Sigue en pie ${dest}? ✈️`;
    }
    return cleaned;
  } catch (_) {
    const dest = user.countries[0] ?? "tu próximo viaje";
    const greet = user.name ? `Hey ${user.name}` : "Hey";
    return `${greet}! 👋 ¿Sigue en pie ${dest}? ✈️`;
  }
}

async function processNudge(
  env: CronEnv,
  user: NudgeCandidate,
  reason: "silent" | "holiday",
  extra?: string,
): Promise<"sent" | "skipped"> {
  if (!user.phone_number_id) return "skipped";
  const sql = getDb(env.DATABASE_URL);
  const body = extra ? `${extra}\n${await generateNudgeText(env, user)}` : await generateNudgeText(env, user);
  await sendProactive(env, {
    phoneNumberId: user.phone_number_id,
    to: user.phone,
    body,
    templateName: "reengagement_viaje",
    templateParams: {
      nombre: user.name || "viajero",
      destino: user.countries[0] || "tu próximo viaje",
    },
  });
  await markUserNudged(sql, user.id);
  await track(env, {
    event: "nudge_sent",
    distinct_id: distinctIdForUser(user.id),
    properties: {
      reason,
      days_silent: Math.round(user.days_silent),
      has_origin: !!user.origin,
      interests_count: user.countries.length,
    },
  });
  return "sent";
}

export async function runReEngagementCron(env: CronEnv): Promise<void> {
  // First pass: seasonal holiday-driven nudges (broader candidate pool,
  // doesn't require silence). last_nudge_at gate ensures we don't double-push.
  await runSeasonalCron(env);
  const sql = getDb(env.DATABASE_URL);
  // Second pass: staggered silence-based nudges. Each user gets at most
  // 3 nudges (day 1 / day 3 / day 7 of silence). Counter resets on any reply.
  const candidates = await findStaggeredNudgeCandidates(sql, 20);
  console.log(`re-engagement cron: ${candidates.length} candidates`);
  let sent = 0;
  let skipped = 0;
  for (const user of candidates) {
    try {
      const r = await processNudge(env, user, "silent");
      if (r === "sent") sent++;
      else skipped++;
    } catch (err) {
      console.error(`re-engagement user ${user.id} failed`, err);
      skipped++;
      await recordError(sql, "cron:nudge", err, { user_id: user.id });
    }
  }
  console.log(`re-engagement cron: sent=${sent} skipped=${skipped}`);
}

// ─── Seasonal pushes (holidays in user's country) ────────────────────────────

const CITY_TO_COUNTRY: Record<string, string> = {
  "lima": "PE", "cusco": "PE", "arequipa": "PE",
  "buenos aires": "AR",
  "santiago": "CL",
  "bogota": "CO", "bogotá": "CO", "medellin": "CO", "medellín": "CO", "cartagena": "CO",
  "cancun": "MX", "cancún": "MX", "ciudad de mexico": "MX", "cdmx": "MX", "mexico": "MX", "méxico": "MX", "guadalajara": "MX",
  "miami": "US", "nueva york": "US", "new york": "US", "los angeles": "US", "los ángeles": "US", "san francisco": "US", "orlando": "US",
  "madrid": "ES", "barcelona": "ES",
};

function countryFor(originCity: string | null): string | null {
  if (!originCity) return null;
  return CITY_TO_COUNTRY[originCity.trim().toLowerCase()] ?? null;
}

export async function runSeasonalCron(env: CronEnv): Promise<void> {
  const sql = getDb(env.DATABASE_URL);
  const today = new Date().toISOString().slice(0, 10);

  // Only push if a holiday from the user's country falls within 7-21 days.
  // That hits the booking window when prices still respond and the user can
  // act, without spamming weeks in advance.
  const candidates = await findNudgeCandidates(sql, {
    minSilentDays: 0,           // unlike re-engagement, we don't require silence
    maxSilentDays: 365,
    minNudgeGapDays: 14,
    limit: 25,
  });
  console.log(`seasonal cron: ${candidates.length} candidates`);
  let sent = 0;
  let skipped = 0;
  for (const user of candidates) {
    try {
      const country = countryFor(user.origin);
      if (!country) { skipped++; continue; }
      const upcoming = holidaysWithinDays(country, today, 21).filter((h) => {
        const days = Math.round(
          (new Date(h.date).getTime() - new Date(today).getTime()) / 86400000,
        );
        return days >= 7 && days <= 21;
      });
      if (upcoming.length === 0) { skipped++; continue; }
      const h = upcoming[0];
      const dest = user.countries[0] ?? null;
      const teaser = dest
        ? `🇵🇪 Se viene ${h.name} en ${h.date.slice(8, 10)}/${h.date.slice(5, 7)} — fin de semana largo perfecto para ${dest}.`
        : `🇵🇪 Se viene ${h.name} en ${h.date.slice(8, 10)}/${h.date.slice(5, 7)} — buen momento para una escapada corta.`;
      const r = await processNudge(env, user, "holiday", teaser);
      if (r === "sent") sent++;
      else skipped++;
    } catch (err) {
      console.error(`seasonal user ${user.id} failed`, err);
      skipped++;
      await recordError(sql, "cron:seasonal", err, { user_id: user.id });
    }
  }
  console.log(`seasonal cron: sent=${sent} skipped=${skipped}`);
}

import {
  getDb,
  getDueWatchlist,
  markWatchlistChecked,
  type DueWatchlistRow,
} from "./db";
import { sendKapsoText } from "./kapso";

export interface CronEnv {
  DATABASE_URL: string;
  KAPSO_API_KEY: string;
  TRAVELPAYOUTS_TOKEN: string;
  TRAVELPAYOUTS_MARKER: string;
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
    }
  }
}

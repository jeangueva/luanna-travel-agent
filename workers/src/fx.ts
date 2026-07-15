// Local-currency display for prices. Two jobs:
//  1) Map the user's phone country (E.164 prefix) to their local currency —
//     showing soles to a user in Bogotá was wrong, and hardcoding PEN=3.75
//     forever was wrong twice.
//  2) Fetch live USD→X rates (open.er-api.com, free/no key, daily refresh)
//     with an in-isolate cache and static fallbacks so a dead FX API can
//     never break a reply. All figures are display-only approximations.
import { fetchWithTimeout } from "./http";

export interface LocalFx {
  /** ISO 4217, e.g. "PEN" */
  code: string;
  /** Display prefix, e.g. "S/", "MX$", "€" */
  symbol: string;
  /** Units of local currency per 1 USD. */
  rate: number;
}

interface CurrencyDef {
  code: string;
  symbol: string;
  /** Static fallback rate, used when the FX API is unreachable. */
  fallback: number;
}

// Calling code → currency. Countries that transact in USD (US, Ecuador,
// Panamá, Venezuela de facto) are omitted: their users see USD only.
const CC_CURRENCY: Record<string, CurrencyDef> = {
  "51": { code: "PEN", symbol: "S/", fallback: 3.75 },
  "52": { code: "MXN", symbol: "MX$", fallback: 18.5 },
  "57": { code: "COP", symbol: "COP$", fallback: 4100 },
  "56": { code: "CLP", symbol: "CLP$", fallback: 950 },
  "54": { code: "ARS", symbol: "AR$", fallback: 1300 },
  "55": { code: "BRL", symbol: "R$", fallback: 5.4 },
  "591": { code: "BOB", symbol: "Bs", fallback: 6.9 },
  "598": { code: "UYU", symbol: "$U", fallback: 40 },
  "595": { code: "PYG", symbol: "₲", fallback: 7500 },
  "506": { code: "CRC", symbol: "₡", fallback: 520 },
  "502": { code: "GTQ", symbol: "Q", fallback: 7.8 },
  "34": { code: "EUR", symbol: "€", fallback: 0.92 },
};

// Longest prefix first so 591/595/598 win over 5x.
const PREFIXES = Object.keys(CC_CURRENCY).sort((a, b) => b.length - a.length);

function currencyForPhone(phone: string): CurrencyDef | null {
  const digits = phone.replace(/[^0-9]/g, "");
  for (const p of PREFIXES) {
    if (digits.startsWith(p)) return CC_CURRENCY[p];
  }
  return null;
}

// In-isolate rates cache. Isolates persist across requests, so most turns hit
// this instead of the network. 6h TTL: FX display precision doesn't need more.
let ratesCache: { rates: Record<string, number>; fetchedAt: number } | null =
  null;
const RATES_TTL_MS = 6 * 3600 * 1000;

async function getRates(): Promise<Record<string, number> | null> {
  if (ratesCache && Date.now() - ratesCache.fetchedAt < RATES_TTL_MS) {
    return ratesCache.rates;
  }
  try {
    const res = await fetchWithTimeout(
      "https://open.er-api.com/v6/latest/USD",
      {},
      { dep: "fx:rates", timeoutMs: 4000 },
    );
    if (!res.ok) return ratesCache?.rates ?? null;
    const j = (await res.json()) as {
      result?: string;
      rates?: Record<string, number>;
    };
    if (j.result !== "success" || !j.rates) return ratesCache?.rates ?? null;
    ratesCache = { rates: j.rates, fetchedAt: Date.now() };
    return j.rates;
  } catch {
    // Stale cache beats no cache; static fallback beats both being absent.
    return ratesCache?.rates ?? null;
  }
}

/**
 * Resolve the local-currency context for a user phone (E.164, with or without
 * +). Returns null for USD-transacting countries and unknown prefixes — the
 * caller then shows USD only. Never throws; falls back to static rates.
 */
export async function resolveLocalFx(
  phone: string | undefined | null,
): Promise<LocalFx | null> {
  if (!phone) return null;
  const def = currencyForPhone(phone);
  if (!def) return null;
  const rates = await getRates();
  const live = rates?.[def.code];
  const rate =
    typeof live === "number" && Number.isFinite(live) && live > 0
      ? live
      : def.fallback;
  return { code: def.code, symbol: def.symbol, rate };
}

/** Display-only conversion, rounded to whole units. */
export function usdToLocal(usd: number, fx: LocalFx): number {
  return Math.round(usd * fx.rate);
}

// Test hook: reset the module cache between test cases.
export function __resetFxCache(): void {
  ratesCache = null;
}

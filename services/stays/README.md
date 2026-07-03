# Stays service (Airbnb + Booking.com)

Standalone Python microservice that returns lodging listings for a city + dates,
scraped from Airbnb and Booking.com. Used while the Travelpayouts Hotels Data
API is gated (needs 50k MAU). The Cloudflare Worker calls this over HTTP via
the `search_stays` tool.

## Why a separate service
Crawl4AI + Playwright need a real browser + Python runtime — they can't run in a
Cloudflare Worker (V8 isolate). This deploys separately (Cloud Run / any
container host) and the Worker calls it.

## Architecture
```
Worker  --POST /search-->  FastAPI  -->  Crawl4AI (Playwright, stealth) x2 concurrent
                                          ├─ airbnb.com  (schema: test-ids)
                                          └─ booking.com (schema: data-testid)
                                     -->  residential proxy (env)
                                     -->  merged stays[], cheapest first
```

## Reality check (read before relying on this)
- Scraping Airbnb/Booking is against their ToS and earns no commission. This is
  a deliberate, owner-authorized choice. See the main project discussion.
- **Residential rotating proxies are mandatory.** Datacenter IPs (Cloud Run,
  most VPS) get blocked/challenged fast. Without proxies this returns little or
  nothing.
- Both sites change markup + anti-bot regularly. Expect to tune selectors.
  Booking's `data-testid` attributes are more stable than Airbnb's.
- Every request scrapes 2 pages through the proxy (~1-3 MB each) — that's the
  cost driver. Trim `SOURCES` or cache upstream if the GB bill hurts.
- Always keep the Worker's fallback (TP vacation-rental link) so users are never
  left without lodging when a scrape fails.

## Where to buy proxies (residential, rotating)
You need a **rotating residential** plan, paid per GB. Sign up, create a proxy
"gateway" user, and you get one endpoint like `http://user:pass@host:port` —
that's your `PROXY_URL`. Every request exits from a different home IP.

| Provider | ~Price | Notes |
|----------|--------|-------|
| Decodo (ex-Smartproxy) | ~$3-6/GB | Good starter, pay-as-you-go, `gate.decodo.com:7000` |
| IPRoyal | ~$4-7/GB | Cheap, non-expiring traffic, `geo.iproyal.com:12321` |
| Webshare | ~$3-5/GB | Cheapest tiers, quality varies |
| Bright Data | ~$8-15/GB | Best pool/quality, KYC onboarding, enterprise-ish |
| Oxylabs | ~$8-12/GB | Same tier as Bright Data |

Recommendation: start with **Decodo or IPRoyal** (~$10-20 buys enough GB to
validate). Prefer geo-targeting to a LATAM/US exit if prices come back in the
wrong currency. Move to Bright Data only if block rates hurt.

## Prerequisites you provide
1. A residential proxy endpoint (`PROXY_URL`, above).
2. A host for the service (Cloud Run recommended) → gives `STAYS_SERVICE_URL`.
3. A shared secret (`STAYS_API_KEY`) so only the Worker can call it.

## Local run
```bash
cd services/stays
cp .env.example .env   # fill PROXY_URL, STAYS_API_KEY
pip install -r requirements.txt
python -m playwright install chromium
uvicorn app:app --port 8080
```
Smoke test:
```bash
curl -s localhost:8080/health
curl -s -X POST localhost:8080/search -H 'X-API-Key: change-me' \
  -H 'Content-Type: application/json' \
  -d '{"city":"Cusco","checkin":"2026-08-10","checkout":"2026-08-15","adults":2}' | jq
```

## Deploy (Cloud Run)
```bash
gcloud run deploy luanna-stays \
  --source . --region us-central1 --allow-unauthenticated \
  --memory 2Gi --timeout 120 \
  --set-env-vars "STAYS_API_KEY=...,PROXY_URL=...,SOURCES=airbnb,booking"
```
(2 GiB because two concurrent Chromium pages; 512 MiB default OOMs.)

Then on the Worker:
```bash
cd workers
npx wrangler secret put STAYS_SERVICE_URL   # https://luanna-stays-....run.app
npx wrangler secret put STAYS_API_KEY       # same value as the service
```
and flip `STAYS_PROVIDER = "scrape"` in `wrangler.toml` + deploy.

## Contract
`POST /search`  (header `X-API-Key: <STAYS_API_KEY>`)
```json
{ "city": "Cusco", "checkin": "2026-08-10", "checkout": "2026-08-15",
  "adults": 2, "sources": ["airbnb", "booking"] }
```
`sources` optional — defaults to env `SOURCES`.
→
```json
{ "stays": [
  { "name": "...", "price_total_usd": 320, "price_per_night_usd": 64,
    "rating": 4.9, "rating_scale": 5, "reviews": 128,
    "url": "https://www.airbnb.com/rooms/...", "image": "https://...",
    "kind": "entire_home", "source": "airbnb" },
  { "name": "...", "price_total_usd": 350, "price_per_night_usd": 70,
    "rating": 8.7, "rating_scale": 10, "reviews": 1234,
    "url": "https://www.booking.com/hotel/...", "image": "https://...",
    "kind": "property", "source": "booking" }
], "source": "airbnb+booking" }
```
`rating_scale` matters: Airbnb rates 0-5, Booking 0-10 — don't compare raw.

## Next phase (TP Hotels Data API)
Once Luanna hits 50k MAU, Travelpayouts unlocks the Hotels Data API — switch
`HOTELS_PROVIDER` in the Worker and retire this scraper (or keep it for
Airbnb-only entire homes, which TP hotels don't cover).

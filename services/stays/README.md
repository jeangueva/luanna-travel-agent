# Stays service (Airbnb / vacation rentals)

Standalone Python microservice that returns lodging listings for a city + dates.
Used while the Travelpayouts Hotels Data API is gated (needs 50k MAU). The
Cloudflare Worker calls this over HTTP via the `search_stays` tool.

## Why a separate service
Crawl4AI + Playwright need a real browser + Python runtime — they can't run in a
Cloudflare Worker (V8 isolate). This deploys separately (Cloud Run / any
container host) and the Worker calls it.

## Architecture
```
Worker  --POST /search-->  FastAPI  -->  Crawl4AI (Playwright, stealth)
                                     -->  residential proxy (env)
                                     -->  schema extraction -> JSON stays[]
```

## Reality check (read before relying on this)
- Scraping Airbnb is against their ToS and earns no commission. This is a
  deliberate, owner-authorized choice. See the main project discussion.
- **Residential rotating proxies are mandatory.** Datacenter IPs (Cloud Run,
  most VPS) get blocked/challenged by Airbnb fast. Without proxies this returns
  little or nothing. Bring your own provider (Bright Data / Oxylabs / etc.).
- Airbnb changes markup + anti-bot regularly. Expect to tune selectors/schema.
- Always keep the Worker's fallback (TP vacation-rental link) so users are never
  left without lodging when a scrape fails.

## Prerequisites you provide
1. A residential proxy endpoint (`PROXY_URL`, e.g.
   `http://user:pass@gate.provider.com:7000`).
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

## Deploy (Cloud Run)
```bash
gcloud run deploy luanna-stays \
  --source . --region us-central1 --allow-unauthenticated \
  --set-env-vars "STAYS_API_KEY=...,PROXY_URL=..."
```
Then set `STAYS_SERVICE_URL` + `STAYS_API_KEY` on the Worker (wrangler secret /
vars) and flip `STAYS_PROVIDER=airbnb`.

## Contract
`POST /search`  (header `X-API-Key: <STAYS_API_KEY>`)
```json
{ "city": "Cusco", "checkin": "2026-08-10", "checkout": "2026-08-15", "adults": 2 }
```
→
```json
{ "stays": [
  { "name": "...", "price_total_usd": 320, "price_per_night_usd": 64,
    "rating": 4.9, "reviews": 128, "url": "https://www.airbnb.com/rooms/...",
    "image": "https://...", "kind": "entire_home" }
], "source": "airbnb" }
```

"""Stays microservice: returns Airbnb lodging for a city + dates.

Runs Crawl4AI (Playwright + stealth) behind a residential proxy. See README for
the reality check — residential proxies are mandatory or Airbnb blocks it, and
selectors below need tuning against live pages. Keep the Worker's fallback on.
"""
from __future__ import annotations

import os
import re
import json
import urllib.parse
from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig
from crawl4ai.extraction_strategy import JsonCssExtractionStrategy

STAYS_API_KEY = os.environ.get("STAYS_API_KEY", "")
PROXY_URL = os.environ.get("PROXY_URL", "")
MAX_RESULTS = int(os.environ.get("MAX_RESULTS", "8"))

app = FastAPI(title="luanna-stays")


class SearchReq(BaseModel):
    city: str
    checkin: str            # YYYY-MM-DD
    checkout: str           # YYYY-MM-DD
    adults: int = 2


class Stay(BaseModel):
    name: Optional[str] = None
    price_total_usd: Optional[float] = None
    price_per_night_usd: Optional[float] = None
    rating: Optional[float] = None
    reviews: Optional[int] = None
    url: Optional[str] = None
    image: Optional[str] = None
    kind: Optional[str] = None


# Airbnb listing cards. These selectors are best-effort and WILL drift — Airbnb
# obfuscates class names, so we anchor on stable-ish test ids / itemprops and
# tune against live HTML. LLM extraction is an alternative if these rot.
_SCHEMA = {
    "name": "airbnb_listings",
    "baseSelector": "[itemprop='itemListElement'], [data-testid='card-container']",
    "fields": [
        {"name": "name", "selector": "[data-testid='listing-card-title'], meta[itemprop='name']", "type": "text"},
        {"name": "price_text", "selector": "[data-testid='price-availability-row'], span[aria-hidden='true']", "type": "text"},
        {"name": "rating_text", "selector": "[aria-label*='out of 5'], span.r4a59j5", "type": "text"},
        {"name": "href", "selector": "a[href*='/rooms/']", "type": "attribute", "attribute": "href"},
        {"name": "image", "selector": "img", "type": "attribute", "attribute": "src"},
    ],
}

_NUM = re.compile(r"[\d,.]+")


def _first_number(text: Optional[str]) -> Optional[float]:
    if not text:
        return None
    m = _NUM.search(text.replace(",", ""))
    return float(m.group()) if m else None


def _proxy_config() -> Optional[dict]:
    """Parse PROXY_URL into Playwright's proxy shape. Authenticated residential
    proxies (user:pass@host:port from IPRoyal/Decodo/etc.) MUST pass username +
    password as separate fields — embedding them in the server string fails."""
    if not PROXY_URL:
        return None
    p = urllib.parse.urlparse(PROXY_URL)
    if not p.hostname:
        return None
    scheme = p.scheme or "http"
    port = f":{p.port}" if p.port else ""
    cfg = {"server": f"{scheme}://{p.hostname}{port}"}
    if p.username:
        cfg["username"] = urllib.parse.unquote(p.username)
    if p.password:
        cfg["password"] = urllib.parse.unquote(p.password)
    return cfg


def _nights(checkin: str, checkout: str) -> int:
    from datetime import date
    try:
        a = date.fromisoformat(checkin)
        b = date.fromisoformat(checkout)
        return max((b - a).days, 1)
    except ValueError:
        return 1


def _search_url(req: SearchReq) -> str:
    city = urllib.parse.quote(req.city)
    q = urllib.parse.urlencode(
        {"checkin": req.checkin, "checkout": req.checkout, "adults": req.adults}
    )
    return f"https://www.airbnb.com/s/{city}/homes?{q}"


def _to_stay(raw: dict, nights: int) -> Stay:
    total = _first_number(raw.get("price_text"))
    per_night = round(total / nights, 2) if total else None
    href = raw.get("href") or ""
    url = ("https://www.airbnb.com" + href) if href.startswith("/") else (href or None)
    rating_txt = raw.get("rating_text") or ""
    rating = _first_number(rating_txt)
    rev_m = re.search(r"(\d+)\s*review", rating_txt)
    return Stay(
        name=(raw.get("name") or None),
        price_total_usd=total,
        price_per_night_usd=per_night,
        rating=rating if (rating and rating <= 5) else None,
        reviews=int(rev_m.group(1)) if rev_m else None,
        url=url,
        image=(raw.get("image") or None),
        kind="entire_home",
    )


async def scrape_airbnb(req: SearchReq) -> list[Stay]:
    browser = BrowserConfig(
        headless=True,
        proxy_config=_proxy_config(),   # residential proxy — required in practice
        # A realistic UA + viewport reduces (not eliminates) bot flags.
        user_agent=(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/122.0 Safari/537.36"
        ),
    )
    run = CrawlerRunConfig(
        extraction_strategy=JsonCssExtractionStrategy(_SCHEMA),
        # Let the SPA hydrate + scroll so lazy cards load, then settle.
        wait_for="css:[data-testid='card-container']",
        js_code=["window.scrollTo(0, document.body.scrollHeight);"],
        page_timeout=45000,
        magic=True,           # crawl4ai anti-bot helpers (stealth-ish)
    )
    async with AsyncWebCrawler(config=browser) as crawler:
        result = await crawler.arun(url=_search_url(req), config=run)
    if not result.success or not result.extracted_content:
        return []
    try:
        rows = json.loads(result.extracted_content)
    except (json.JSONDecodeError, TypeError):
        return []
    nights = _nights(req.checkin, req.checkout)
    stays = [_to_stay(r, nights) for r in rows if isinstance(r, dict)]
    # Keep ones we could price, cheapest first.
    stays = [s for s in stays if s.price_total_usd]
    stays.sort(key=lambda s: s.price_total_usd or 1e9)
    return stays[:MAX_RESULTS]


@app.get("/health")
async def health():
    return {"ok": True, "proxy": bool(PROXY_URL)}


@app.post("/search")
async def search(req: SearchReq, x_api_key: str = Header(default="")):
    if not STAYS_API_KEY or x_api_key != STAYS_API_KEY:
        raise HTTPException(status_code=401, detail="unauthorized")
    try:
        stays = await scrape_airbnb(req)
    except Exception as e:  # never 500 the caller — it has a fallback link
        return {"stays": [], "source": "airbnb", "error": str(e)[:200]}
    return {"stays": [s.model_dump() for s in stays], "source": "airbnb"}

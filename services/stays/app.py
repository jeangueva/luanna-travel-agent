"""Stays microservice: returns Airbnb + Booking.com lodging for a city + dates.

Runs Crawl4AI (Playwright + stealth) behind a residential proxy. See README for
the reality check — residential proxies are mandatory or both sites block it,
and selectors below need tuning against live pages. Keep the Worker's fallback on.
"""
from __future__ import annotations

import os
import re
import json
import asyncio
import urllib.parse
from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig
from crawl4ai.extraction_strategy import JsonCssExtractionStrategy

STAYS_API_KEY = os.environ.get("STAYS_API_KEY", "")
PROXY_URL = os.environ.get("PROXY_URL", "")
MAX_RESULTS = int(os.environ.get("MAX_RESULTS", "8"))
# Which sites to scrape per request (comma-separated). Each source costs proxy
# bandwidth, so trim this if the proxy budget hurts.
SOURCES = [
    s.strip()
    for s in os.environ.get("SOURCES", "airbnb,booking").split(",")
    if s.strip()
]

app = FastAPI(title="luanna-stays")


class SearchReq(BaseModel):
    city: str
    checkin: str            # YYYY-MM-DD
    checkout: str           # YYYY-MM-DD
    adults: int = 2
    sources: Optional[list[str]] = None   # override env SOURCES per request


class Stay(BaseModel):
    name: Optional[str] = None
    price_total_usd: Optional[float] = None
    price_per_night_usd: Optional[float] = None
    rating: Optional[float] = None
    rating_scale: Optional[int] = None    # 5 = Airbnb, 10 = Booking
    reviews: Optional[int] = None
    url: Optional[str] = None
    image: Optional[str] = None
    kind: Optional[str] = None
    source: Optional[str] = None


# Airbnb listing cards. These selectors are best-effort and WILL drift — Airbnb
# obfuscates class names, so we anchor on stable-ish test ids / itemprops and
# tune against live HTML. LLM extraction is an alternative if these rot.
_AIRBNB_SCHEMA = {
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

# Booking.com property cards. Booking keeps data-testid attributes fairly
# stable across redesigns — anchor everything on those.
_BOOKING_SCHEMA = {
    "name": "booking_listings",
    "baseSelector": "[data-testid='property-card']",
    "fields": [
        {"name": "name", "selector": "[data-testid='title']", "type": "text"},
        {"name": "price_text", "selector": "[data-testid='price-and-discounted-price']", "type": "text"},
        {"name": "rating_text", "selector": "[data-testid='review-score']", "type": "text"},
        {"name": "href", "selector": "a[data-testid='title-link'], a[data-testid='property-card-desktop-single-image']", "type": "attribute", "attribute": "href"},
        {"name": "image", "selector": "img[data-testid='image'], img", "type": "attribute", "attribute": "src"},
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


def _airbnb_url(req: SearchReq) -> str:
    city = urllib.parse.quote(req.city)
    q = urllib.parse.urlencode(
        {"checkin": req.checkin, "checkout": req.checkout, "adults": req.adults}
    )
    return f"https://www.airbnb.com/s/{city}/homes?{q}"


def _booking_url(req: SearchReq) -> str:
    q = urllib.parse.urlencode(
        {
            "ss": req.city,
            "checkin": req.checkin,
            "checkout": req.checkout,
            "group_adults": req.adults,
            "no_rooms": 1,
            "group_children": 0,
            "selected_currency": "USD",
        }
    )
    return f"https://www.booking.com/searchresults.html?{q}"


def _airbnb_stay(raw: dict, nights: int) -> Stay:
    total = _first_number(raw.get("price_text"))
    per_night = round(total / nights, 2) if total else None
    href = raw.get("href") or ""
    url = ("https://www.airbnb.com" + href) if href.startswith("/") else (href or None)
    rating_txt = raw.get("rating_text") or ""
    rating = _first_number(rating_txt)
    rev_m = re.search(r"(\d[\d,]*)\s*review", rating_txt)
    return Stay(
        name=(raw.get("name") or None),
        price_total_usd=total,
        price_per_night_usd=per_night,
        rating=rating if (rating and rating <= 5) else None,
        rating_scale=5,
        reviews=int(rev_m.group(1).replace(",", "")) if rev_m else None,
        url=url,
        image=(raw.get("image") or None),
        kind="entire_home",
        source="airbnb",
    )


def _booking_stay(raw: dict, nights: int) -> Stay:
    # Booking shows the TOTAL for the stay when dates are in the URL
    # (selected_currency=USD → "US$1,234").
    total = _first_number(raw.get("price_text"))
    per_night = round(total / nights, 2) if total else None
    href = raw.get("href") or ""
    url = ("https://www.booking.com" + href) if href.startswith("/") else (href or None)
    # rating_text like "Scored 8.7 8.7 Fabulous 1,234 reviews" — 0-10 scale.
    rating_txt = raw.get("rating_text") or ""
    rating = _first_number(rating_txt)
    rev_m = re.search(r"(\d[\d,]*)\s*review", rating_txt)
    return Stay(
        name=(raw.get("name") or None),
        price_total_usd=total,
        price_per_night_usd=per_night,
        rating=rating if (rating and rating <= 10) else None,
        rating_scale=10,
        reviews=int(rev_m.group(1).replace(",", "")) if rev_m else None,
        url=url,
        image=(raw.get("image") or None),
        kind="property",
        source="booking",
    )


_SOURCE_CFG = {
    "airbnb": {
        "url": _airbnb_url,
        "schema": _AIRBNB_SCHEMA,
        "wait_for": "css:[data-testid='card-container']",
        "to_stay": _airbnb_stay,
    },
    "booking": {
        "url": _booking_url,
        "schema": _BOOKING_SCHEMA,
        "wait_for": "css:[data-testid='property-card']",
        "to_stay": _booking_stay,
    },
}


async def scrape_source(source: str, req: SearchReq) -> list[Stay]:
    cfg = _SOURCE_CFG[source]
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
        extraction_strategy=JsonCssExtractionStrategy(cfg["schema"]),
        # Let the SPA hydrate + scroll so lazy cards load, then settle.
        wait_for=cfg["wait_for"],
        js_code=["window.scrollTo(0, document.body.scrollHeight);"],
        page_timeout=45000,
        magic=True,           # crawl4ai anti-bot helpers (stealth-ish)
    )
    async with AsyncWebCrawler(config=browser) as crawler:
        result = await crawler.arun(url=cfg["url"](req), config=run)
    if not result.success or not result.extracted_content:
        return []
    try:
        rows = json.loads(result.extracted_content)
    except (json.JSONDecodeError, TypeError):
        return []
    nights = _nights(req.checkin, req.checkout)
    stays = [cfg["to_stay"](r, nights) for r in rows if isinstance(r, dict)]
    # Keep ones we could price, cheapest first.
    stays = [s for s in stays if s.price_total_usd]
    stays.sort(key=lambda s: s.price_total_usd or 1e9)
    return stays[:MAX_RESULTS]


@app.get("/health")
async def health():
    return {"ok": True, "proxy": bool(PROXY_URL), "sources": SOURCES}


@app.post("/search")
async def search(req: SearchReq, x_api_key: str = Header(default="")):
    if not STAYS_API_KEY or x_api_key != STAYS_API_KEY:
        raise HTTPException(status_code=401, detail="unauthorized")
    sources = [s for s in (req.sources or SOURCES) if s in _SOURCE_CFG]
    if not sources:
        return {"stays": [], "source": "", "error": "no valid sources"}

    results = await asyncio.gather(
        *(scrape_source(s, req) for s in sources), return_exceptions=True
    )
    stays: list[Stay] = []
    errors: dict[str, str] = {}
    for src, res in zip(sources, results):
        if isinstance(res, BaseException):
            errors[src] = str(res)[:200]
        else:
            stays.extend(res)
    # Merge cheapest-first across sources; the Worker slices the top few.
    stays.sort(key=lambda s: s.price_total_usd or 1e9)
    out = {
        "stays": [s.model_dump() for s in stays[:MAX_RESULTS]],
        "source": "+".join(sources),
    }
    if errors:
        out["errors"] = errors
    return out

"""
Phase 4: Hotel Search
- search_accommodation: Async Travelpayouts hotels API
"""

import httpx
import os
from agent.state import AgentState
from agent.cache import get_cached_results, cache_search_results

TRAVELPAYOUTS_TOKEN = os.getenv("TRAVELPAYOUTS_TOKEN")
TRAVELPAYOUTS_API = "https://api.travelpayouts.com"


async def search_accommodation_node(state: AgentState) -> AgentState:
    """Search hotels using Travelpayouts API (async)."""
    destination = state.get("destination", "")
    checkin_date = state.get("dates", {}).get("departure")
    nights = state.get("nights", 5)

    if not checkin_date or not destination:
        state["hotels"] = []
        return state

    # Check cache first
    cached = await get_cached_results(destination, "hotels")
    if cached:
        state["hotels"] = cached
        return state

    # Call Travelpayouts API
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                f"{TRAVELPAYOUTS_API}/v2/hotels/",
                params={
                    "city": destination,
                    "check_in": checkin_date,
                    "nights": nights,
                    "token": TRAVELPAYOUTS_TOKEN,
                    "limit": 5,
                },
            )

            if response.status_code == 200:
                data = response.json()
                hotels = data.get("results", [])

                # Cache results
                await cache_search_results(destination, "hotels", hotels)

                state["hotels"] = hotels
            else:
                state["hotels"] = []

    except Exception as e:
        print(f"Error searching hotels: {e}")
        state["hotels"] = []

    return state

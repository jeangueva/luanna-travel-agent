"""
Phase 3: Flight Search
- search_mobility: Async Travelpayouts flights API
"""

import httpx
import os
from agent.state import AgentState
from agent.cache import get_cached_results, cache_search_results

TRAVELPAYOUTS_TOKEN = os.getenv("TRAVELPAYOUTS_TOKEN")
TRAVELPAYOUTS_API = "https://api.travelpayouts.com"


async def search_mobility_node(state: AgentState) -> AgentState:
    """Search flights using Travelpayouts API (async)."""
    origin = state.get("origin", "MAD")  # Default to Madrid
    destination = state.get("destination", "")
    departure_date = state.get("dates", {}).get("departure")

    if not departure_date or not destination:
        state["flights"] = []
        return state

    # Check cache first
    cached = await get_cached_results(destination, "flights")
    if cached:
        state["flights"] = cached
        return state

    # Call Travelpayouts API
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                f"{TRAVELPAYOUTS_API}/v2/search/",
                params={
                    "origin": origin,
                    "destination": destination[:3].upper(),  # IATA code
                    "depart_date": departure_date,
                    "token": TRAVELPAYOUTS_TOKEN,
                    "limit": 5,
                },
            )

            if response.status_code == 200:
                data = response.json()
                flights = data.get("data", [])

                # Cache results
                await cache_search_results(destination, "flights", flights)

                state["flights"] = flights
            else:
                state["flights"] = []

    except Exception as e:
        print(f"Error searching flights: {e}")
        state["flights"] = []

    return state

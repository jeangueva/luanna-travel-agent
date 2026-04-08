"""
Phase 6: Enrichment
- pre_enrich_insights: Prepare vlogs and context (stub for MVP)
- enrich_parallel: Parallel enrichment (restaurants, arrival info, etc.)
- search_restaurants: Google Places API
"""

import asyncio
import httpx
from agent.state import AgentState


async def pre_enrich_insights_node(state: AgentState) -> AgentState:
    """Pre-enrichment with vlog insights (stub - will use Supabase embeddings later)."""
    destination = state.get("destination", "")

    # Stub: In production, this would query Supabase pgvector for matching vlogs
    vlog_tips = [
        f"💡 Tips de viajeros para {destination}:",
        "- Visita durante la mañana para evitar multitudes",
        "- Prueba la comida local en mercados, no en turísticos",
        "- El transporte público es barato y eficiente",
    ]

    state["insights"] = vlog_tips
    return state


async def enrich_parallel_node(state: AgentState) -> AgentState:
    """Run all enrichment tasks in parallel."""

    async def _search_restaurants():
        return await search_restaurants_node(state.copy())

    async def _get_arrival_info():
        # Stub: Get arrival airport info
        return {"airport": "International", "transport": "Taxi/Bus available"}

    async def _get_viator_stubs():
        # Stub: Tours and activities
        return []

    # Run all in parallel
    try:
        results = await asyncio.gather(
            _search_restaurants(),
            _get_arrival_info(),
            _get_viator_stubs(),
            return_exceptions=True
        )

        restaurants_state = results[0] if not isinstance(results[0], Exception) else {}
        arrival_info = results[1] if not isinstance(results[1], Exception) else {}
        viator_stubs = results[2] if not isinstance(results[2], Exception) else []

        state["restaurants"] = restaurants_state.get("restaurants", [])
        state["arrival_info"] = arrival_info
        state["viator_stubs"] = viator_stubs

    except Exception as e:
        print(f"Error in enrichment: {e}")
        state["restaurants"] = []
        state["arrival_info"] = {}

    return state


async def search_restaurants_node(state: AgentState) -> AgentState:
    """Search restaurants using Google Places API (stub for MVP)."""
    destination = state.get("destination", "")

    # Stub: In production, would call Google Places Nearby
    restaurants = [
        {"name": f"Restaurant 1 in {destination}", "rating": 4.5, "type": "Local"},
        {"name": f"Restaurant 2 in {destination}", "rating": 4.7, "type": "Fine Dining"},
        {"name": f"Restaurant 3 in {destination}", "rating": 4.3, "type": "Casual"},
    ]

    state["restaurants"] = restaurants
    return state

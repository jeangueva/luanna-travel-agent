"""
Phase 4: Parallel Search Orchestrator
- parallel_search: Uses asyncio.gather to run flights + hotels + insights in parallel
"""

import asyncio
from agent.state import AgentState
from agent.nodes.mobility import search_mobility_node
from agent.nodes.accommodation import search_accommodation_node


async def parallel_search_node(state: AgentState) -> AgentState:
    """Execute flights, hotels, and insights searches in parallel using asyncio.gather."""

    # Define parallel tasks
    async def _search_flights():
        return await search_mobility_node(state.copy())

    async def _search_hotels():
        return await search_accommodation_node(state.copy())

    async def _enrich_insights():
        # Stub: Pre-enrichment with vlogs (will be populated with Supabase later)
        return []

    # Run all 3 tasks in parallel
    try:
        results = await asyncio.gather(
            _search_flights(),
            _search_hotels(),
            _enrich_insights(),
            return_exceptions=True
        )

        # Extract results
        flights_state = results[0] if not isinstance(results[0], Exception) else {}
        hotels_state = results[1] if not isinstance(results[1], Exception) else {}
        insights = results[2] if not isinstance(results[2], Exception) else []

        # Merge into state
        state["flights"] = flights_state.get("flights", [])
        state["hotels"] = hotels_state.get("hotels", [])
        state["insights"] = insights if isinstance(insights, list) else []

    except Exception as e:
        print(f"Error in parallel search: {e}")
        state["flights"] = []
        state["hotels"] = []
        state["insights"] = []

    return state

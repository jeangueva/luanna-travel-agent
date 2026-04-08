"""
Phase 5: Itinerary Building
- build_itinerary: Use Sonnet to synthesize complete itinerary
- validate_itinerary: Quality gate with rebuild logic
"""

from agent.state import AgentState
from agent.brain import build_itinerary_sonnet


async def build_itinerary_node(state: AgentState) -> AgentState:
    """Build complete itinerary using Claude Sonnet."""
    itinerary = await build_itinerary_sonnet(state)
    state["itinerary"] = itinerary
    state["rebuild_count"] = state.get("rebuild_count", 0)
    return state


async def validate_itinerary_node(state: AgentState) -> AgentState:
    """Validate itinerary quality."""
    itinerary = state.get("itinerary", "")

    # Simple quality checks
    checks = {
        "has_prices": "$" in itinerary,
        "has_times": ":" in itinerary,
        "has_activities": len(itinerary) > 500,
        "has_structure": "Día" in itinerary or "Day" in itinerary,
    }

    passed_checks = sum(checks.values())
    state["itinerary_valid"] = passed_checks >= 3

    # If invalid and haven't rebuilt too many times, mark for rebuild
    if not state["itinerary_valid"] and state.get("rebuild_count", 0) < 2:
        state["rebuild_count"] = state.get("rebuild_count", 0) + 1
        # Will be re-run by edge logic
    elif state.get("rebuild_count", 0) >= 2:
        # Give up and use best attempt
        state["itinerary_valid"] = True

    return state

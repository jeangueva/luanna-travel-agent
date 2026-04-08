"""
Phase 1B: Extract preferences and refinements
- extract_preferences: Haiku extraction of travel details
- extract_refinement_delta: Identify changes
"""

from agent.state import AgentState
from agent.brain import extract_preferences_haiku


async def extract_preferences_node(state: AgentState) -> AgentState:
    """Extract travel preferences using Haiku."""
    prefs = await extract_preferences_haiku(state["user_message"])

    state["destination"] = prefs.get("destination") or state.get("destination")
    state["origin"] = prefs.get("origin") or state.get("origin")
    state["dates"] = prefs.get("dates", {}) or state.get("dates", {})
    state["nights"] = prefs.get("nights") or state.get("nights")
    state["budget"] = prefs.get("budget") or state.get("budget")
    state["travelers"] = prefs.get("travelers", 1)
    state["style"] = prefs.get("style") or state.get("style")

    # Check if we need clarification
    if not state.get("destination"):
        state["needs_clarification"] = True

    return state


async def extract_refinement_delta_node(state: AgentState) -> AgentState:
    """Identify what changed in refinement request."""
    # Simple heuristic: check which fields appear in the message
    msg = state["user_message"].lower()
    delta = {}

    if "fecha" in msg or "date" in msg or "día" in msg:
        delta["dates"] = True
    if "presupuesto" in msg or "budget" in msg or "precio" in msg:
        delta["budget"] = True
    if "estilo" in msg or "style" in msg or "tipo" in msg:
        delta["style"] = True
    if "viajeros" in msg or "personas" in msg or "travelers" in msg:
        delta["travelers"] = True

    state["what_changed"] = delta

    # Decide what to re-run
    if "dates" in delta:
        state["nodes_to_rerun"] = ["search_mobility", "search_accommodation"]
    elif "budget" in delta:
        state["nodes_to_rerun"] = ["build_itinerary"]
    else:
        state["nodes_to_rerun"] = ["build_itinerary"]

    return state

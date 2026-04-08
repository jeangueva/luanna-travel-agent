"""
Phase 2: City Planning
- plan_cities: Determine single or multi-city itinerary
"""

from agent.state import AgentState
from agent.brain import classify_intent_haiku


async def plan_cities_node(state: AgentState) -> AgentState:
    """Plan cities for the trip."""
    destination = state.get("destination", "")

    # Check if multi-city query
    if any(word in destination.lower() for word in ["and", "y", "plus", "+", ","]):
        state["is_multi_city"] = True
        # Parse cities (simple split by delimiters)
        cities = [c.strip() for c in destination.replace(" and ", ",").replace(" y ", ",").split(",")]
        state["cities"] = cities
    else:
        state["is_multi_city"] = False
        state["cities"] = [destination]

    return state

"""
Response Generation
- generate_response: Final conversational response to user
"""

from agent.state import AgentState
from agent.brain import generate_response_haiku


async def generate_response_node(state: AgentState) -> AgentState:
    """Generate final response to send to user."""
    # Build context for response generation
    context = f"""
Destination: {state.get('destination')}
Dates: {state.get('dates')}
Itinerary: {state.get('itinerary', 'En construcción')[:200]}...
Restaurants: {', '.join([r.get('name', 'N/A') for r in state.get('restaurants', [])[:2]])}
"""

    response = await generate_response_haiku(state, context)
    state["response"] = response

    return state

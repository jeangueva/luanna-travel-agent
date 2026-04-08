"""
LangGraph StateGraph - Orchestrates 17 nodes with conditional routing.
Vora Orchestration Graph adapted for Luanna.
"""

from langgraph.graph import StateGraph, START, END
from agent.state import AgentState
from agent.nodes import (
    fast_classifier,
    classify_intent_node,
    extract_preferences_node,
    extract_refinement_delta_node,
    confirm_plan_node,
    handle_confirmation_node,
    plan_cities_node,
    parallel_search_node,
    build_itinerary_node,
    validate_itinerary_node,
    enrich_parallel_node,
    generate_response_node,
    handle_refinement_node,
)


def build_graph():
    """Build the LangGraph StateGraph."""
    graph = StateGraph(AgentState)

    # Add all 17 nodes
    graph.add_node("fast_classifier", fast_classifier)
    graph.add_node("classify_intent", classify_intent_node)
    graph.add_node("extract_preferences", extract_preferences_node)
    graph.add_node("confirm_plan", confirm_plan_node)
    graph.add_node("handle_confirmation", handle_confirmation_node)
    graph.add_node("extract_refinement_delta", extract_refinement_delta_node)
    graph.add_node("handle_refinement", handle_refinement_node)
    graph.add_node("plan_cities", plan_cities_node)
    graph.add_node("parallel_search", parallel_search_node)
    graph.add_node("build_itinerary", build_itinerary_node)
    graph.add_node("validate_itinerary", validate_itinerary_node)
    graph.add_node("enrich_parallel", enrich_parallel_node)
    graph.add_node("generate_response", generate_response_node)

    # Set entry point
    graph.add_edge(START, "fast_classifier")

    # Phase 1A: Classification routing
    def route_classification(state):
        if state["intent"] == "greeting":
            return "generate_response"
        elif state["intent"] is None:
            return "classify_intent"
        elif state["intent"] == "new_trip":
            return "extract_preferences"
        elif state["intent"] == "confirm":
            return "handle_confirmation"
        elif state["intent"] == "refine":
            return "extract_refinement_delta"
        else:
            return "generate_response"

    graph.add_conditional_edges("fast_classifier", route_classification)

    # Phase 1B: Intent classification
    def route_intent(state):
        if state["intent"] == "new_trip":
            return "extract_preferences"
        else:
            return "generate_response"

    graph.add_conditional_edges("classify_intent", route_intent)

    # Phase 1B: Extraction routing
    def route_extraction(state):
        if state.get("needs_clarification"):
            return "generate_response"
        else:
            return "confirm_plan"

    graph.add_conditional_edges("extract_preferences", route_extraction)

    # Phase 1B: Confirmation paths
    graph.add_edge("confirm_plan", END)  # HITL: Wait for next message

    def route_confirmation(state):
        if state.get("pending_confirmation"):
            return END  # Waiting for user confirmation
        elif state["user_confirmed"]:
            return "plan_cities"
        else:
            return "extract_preferences"

    graph.add_conditional_edges("handle_confirmation", route_confirmation)

    # Phase 1C: Refinement
    graph.add_edge("extract_refinement_delta", "handle_refinement")

    def route_refinement(state):
        # For now, always re-run from plan_cities
        # In production, could be more selective
        return "plan_cities"

    graph.add_conditional_edges("handle_refinement", route_refinement)

    # Phase 2-4: Main flow
    graph.add_edge("plan_cities", "parallel_search")
    graph.add_edge("parallel_search", "build_itinerary")

    # Phase 5: Itinerary validation
    def route_validation(state):
        if state.get("itinerary_valid"):
            return "enrich_parallel"
        elif state.get("rebuild_count", 0) < 2:
            return "build_itinerary"  # Loop back to rebuild
        else:
            return "enrich_parallel"  # Give up, continue with best attempt

    graph.add_conditional_edges("validate_itinerary", route_validation)

    # Phase 5 to 6
    graph.add_edge("build_itinerary", "validate_itinerary")

    # Phase 6: Final response
    graph.add_edge("enrich_parallel", "generate_response")
    graph.add_edge("generate_response", END)

    # Compile graph
    return graph.compile()


# Global graph instance
travel_graph = build_graph()

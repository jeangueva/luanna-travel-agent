"""
Phase 1C: Refinement Handling
- handle_refinement: Decide which nodes to re-execute
"""

from agent.state import AgentState


async def handle_refinement_node(state: AgentState) -> AgentState:
    """Handle refinement by re-executing necessary nodes."""
    nodes_to_rerun = state.get("nodes_to_rerun", [])

    # This node doesn't execute the nodes itself;
    # that's handled by the graph edges.
    # Just mark that we need to revisit certain phases.

    state["phase"] = "refinement_processing"

    return state

"""
Shared state for LangGraph - AgentState TypedDict.
All 17 nodes read/write to this state.
"""

from typing import TypedDict, Optional, List, Literal


class AgentState(TypedDict):
    """Complete state for travel planning agent."""

    # Input
    user_id: str
    phone_number: str
    user_message: str

    # Phase 1A - Classification
    intent: Optional[Literal["new_trip", "confirm", "refine", "question", "greeting"]]

    # Phase 1B - Extraction
    destination: Optional[str]
    origin: Optional[str]
    dates: dict  # {"departure": "2025-06-15", "return": "2025-06-22"}
    nights: Optional[int]
    budget: Optional[Literal["economy", "mid", "luxury"]]
    travelers: int
    style: Optional[Literal["adventure", "relax", "culture", "food"]]

    # Phase 1B - HITL
    pending_confirmation: bool
    plan_summary: str
    user_confirmed: bool
    needs_clarification: bool

    # Phase 1C - Refinement
    what_changed: dict
    nodes_to_rerun: List[str]

    # Phase 2 - City Planning
    is_multi_city: bool
    cities: List[str]

    # Phase 3/4 - Search Results (populated in parallel)
    flights: List[dict]
    hotels: List[dict]
    insights: List[dict]

    # Phase 5 - Itinerary
    itinerary: str
    rebuild_count: int
    itinerary_valid: bool

    # Phase 6 - Enrichment
    restaurants: List[dict]
    arrival_info: dict

    # Control Flow
    phase: str
    error: Optional[str]

    # Conversation
    conversation_history: List[dict]
    favorites: List[dict]
    response: str
    latency_ms: int

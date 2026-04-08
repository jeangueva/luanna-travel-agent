"""
Phase 1A-B: Classification and Intent Detection
- fast_classifier: Rules-based, no LLM
- classify_intent: Haiku for ambiguous intents
"""

import re
from agent.state import AgentState
from agent.brain import classify_intent_haiku


def fast_classifier(state: AgentState) -> AgentState:
    """Fast rule-based classifier (no LLM)."""
    msg = state["user_message"].lower()

    # Greeting patterns
    if re.search(r"(hola|hi|hey|buenos días|buenas noches|good morning)", msg):
        state["intent"] = "greeting"
        return state

    # Confirmation patterns
    if re.search(r"(sí|si|claro|ok|confirma|confirmá|yes|agree)", msg):
        state["intent"] = "confirm"
        return state

    # New trip patterns
    if re.search(r"(quiero ir|viajar a|vuelo a|búsca vuelo|quiero viajar|ir a|trip to)", msg):
        state["intent"] = "new_trip"
        return state

    # Refinement patterns
    if re.search(r"(cambia|modifica|modifica|mejor|cambio|prefiero|other option)", msg):
        state["intent"] = "refine"
        return state

    # No clear intent - pass to Claude
    state["intent"] = None
    return state


async def classify_intent_node(state: AgentState) -> AgentState:
    """Classify ambiguous intents using Haiku."""
    if state["intent"] is not None:
        return state

    context = f"Conversation history: {state.get('conversation_history', [])[-3:]}"
    intent_text = await classify_intent_haiku(state["user_message"], context)

    # Map Claude response to valid intents
    if "nuevo" in intent_text or "trip" in intent_text or "travel" in intent_text:
        state["intent"] = "new_trip"
    elif "refin" in intent_text or "cambio" in intent_text or "modifi" in intent_text:
        state["intent"] = "refine"
    elif "pregunta" in intent_text or "question" in intent_text or "explore" in intent_text:
        state["intent"] = "question"
    else:
        state["intent"] = "question"

    return state

"""
Phase 1B-C: HITL Confirmation
- confirm_plan: Present plan to user and pause
- handle_confirmation: Evaluate user response
"""

import json
from agent.state import AgentState
from agent.cache import save_pending_plan, get_pending_plan, delete_pending_plan


async def confirm_plan_node(state: AgentState) -> AgentState:
    """Present plan summary and save to Redis (HITL)."""
    # Format plan as WhatsApp card
    plan_summary = f"""
✈️ **Tu Viaje a {state.get('destination', 'desconocido')}**

📅 Fechas: {state.get('dates', {}).get('departure', '?')} - {state.get('dates', {}).get('return', '?')}
👥 Viajeros: {state.get('travelers', 1)}
💰 Presupuesto: {state.get('budget', 'flexible').capitalize()}
🎯 Estilo: {state.get('style', 'mixed').capitalize()}

Vuelos sugeridos (desde ${state.get('flights', [{}])[0].get('price', '?')}):
{chr(10).join([f"• ${f.get('price', 'N/A')}: {f.get('airline', 'N/A')}" for f in state.get('flights', [])[:2]])}

Hoteles sugeridos (desde ${state.get('hotels', [{}])[0].get('price', '?')}/noche):
{chr(10).join([f"• {h.get('name', 'Hotel')}: ${h.get('price', 'N/A')}" for h in state.get('hotels', [])[:2]])}

¿Confirmamos este plan?
✅ Sí, adelante
❌ No, cambio algo
✏️ Modifica {state.get('style', 'preferencias')}
"""

    state["plan_summary"] = plan_summary

    # Save to Redis for HITL
    plan_data = {
        "destination": state.get("destination"),
        "dates": state.get("dates"),
        "flights": state.get("flights", [])[:3],
        "hotels": state.get("hotels", [])[:3],
        "created_at": str(__import__("datetime").datetime.now()),
    }
    await save_pending_plan(state["user_id"], plan_data)

    state["pending_confirmation"] = True
    state["response"] = plan_summary  # Send this to user

    return state


async def handle_confirmation_node(state: AgentState) -> AgentState:
    """Evaluate user's confirmation response."""
    if not state.get("pending_confirmation"):
        return state

    msg = state["user_message"].lower()
    pending_plan = await get_pending_plan(state["user_id"])

    if not pending_plan:
        state["pending_confirmation"] = False
        state["response"] = "❌ Plan expirado. Comencemos de nuevo."
        return state

    # Parse response
    if "sí" in msg or "si" in msg or "yes" in msg or "adelante" in msg or "confirma" in msg:
        state["user_confirmed"] = True
        await delete_pending_plan(state["user_id"])
        state["pending_confirmation"] = False
        state["response"] = "✅ ¡Perfecto! Construyendo tu itinerario..."

    elif "no" in msg or "cambio" in msg or "modifica" in msg or "otro" in msg:
        state["user_confirmed"] = False
        await delete_pending_plan(state["user_id"])
        state["pending_confirmation"] = False
        state["response"] = "Entendido. ¿Qué te gustaría cambiar?"

    else:
        state["response"] = "No entendí. ¿Confirmamos el plan? (Sí/No/Modifica)"

    return state

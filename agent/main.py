"""
Luanna FastAPI + LangGraph Server
- Webhook handler for Meta Cloud API
- Invokes 17-node LangGraph for processing
- Token optimization with Headroom + Toonify
"""

import os
import json
import logging
import time
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import PlainTextResponse, JSONResponse, FileResponse

from agent.memory import init_db, find_or_create_user, get_or_create_user_token
from agent.graph import travel_graph
from agent.state import AgentState
from agent.providers import proveedor
from agent.preferences import router as preferences_router

BASE_URL = os.getenv("BASE_URL", "https://luanna-travel-agent-production.up.railway.app")
PREFERENCE_TRIGGERS = {"preferencias", "configurar", "mis ciudades", "mis paises", "mis países", "settings", "perfil", "editar"}

ROOT_DIR = Path(__file__).resolve().parent.parent

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(title="Luanna Travel Agent", version="1.0.0")
app.include_router(preferences_router)


@app.on_event("startup")
async def startup():
    """Initialize on app startup."""
    init_db()
    logger.info("🚀 Luanna started with 17-node LangGraph")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return JSONResponse({
        "status": "ok",
        "service": "Luanna Travel Agent (Vora MoA)",
    })


@app.get("/")
async def landing():
    """Marketing landing page."""
    return FileResponse(ROOT_DIR / "index.html")


@app.get("/privacy")
async def privacy_policy():
    """Privacy policy page (required by Meta)."""
    return FileResponse(ROOT_DIR / "privacy.html")


@app.get("/terms")
async def terms_of_service():
    """Terms of service page."""
    return FileResponse(ROOT_DIR / "terms.html")


@app.get("/webhook")
async def verify_webhook(request: Request):
    """Webhook verification for Meta Cloud API."""
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    if not token or not proveedor.verificar_token(token):
        logger.warning("Invalid webhook token")
        raise HTTPException(status_code=403, detail="Invalid token")

    logger.info("Webhook verified")
    return PlainTextResponse(challenge)


@app.post("/webhook")
async def handle_webhook(request: Request):
    """
    Main webhook handler - invokes 17-node LangGraph.
    Implements Vora orchestration graph with token optimization.
    """
    start_time = time.time()

    try:
        # Parse webhook
        request_data = await request.json()
        logger.info(f"Webhook received")

        # Parse message
        mensaje = proveedor.parsear_webhook(request_data)
        if not mensaje:
            logger.warning("Could not parse message")
            return JSONResponse({"status": "no_message"})

        phone_number = mensaje.phone_number
        user_message = mensaje.message
        user_name = mensaje.name

        logger.info(f"Message from {phone_number}: {user_message[:50]}")

        # Shortcut: if user asks for preferences, send webview link and exit
        if user_message.strip().lower() in PREFERENCE_TRIGGERS:
            _, token = get_or_create_user_token(phone_number)
            link = f"{BASE_URL}/preferences/{token}"
            reply = f"Configura tus preferencias acá 👇\n{link}"
            await proveedor.enviar_mensaje(phone_number, reply)
            return JSONResponse({"status": "ok", "action": "preferences_link"})

        # Get or create user
        user = find_or_create_user(phone_number, user_name)
        user_id = user.id

        # Prepare initial state for LangGraph
        initial_state: AgentState = {
            "user_id": user_id,
            "phone_number": phone_number,
            "user_message": user_message,
            "intent": None,
            "destination": None,
            "origin": None,
            "dates": {},
            "nights": None,
            "budget": None,
            "travelers": 1,
            "style": None,
            "pending_confirmation": False,
            "plan_summary": "",
            "user_confirmed": False,
            "needs_clarification": False,
            "what_changed": {},
            "nodes_to_rerun": [],
            "is_multi_city": False,
            "cities": [],
            "flights": [],
            "hotels": [],
            "insights": [],
            "itinerary": "",
            "rebuild_count": 0,
            "itinerary_valid": False,
            "restaurants": [],
            "arrival_info": {},
            "phase": "start",
            "error": None,
            "conversation_history": [],
            "favorites": [],
            "response": "",
            "latency_ms": 0,
        }

        # ===== TOKEN OPTIMIZATION: Headroom Stub =====
        # In production: Headroom proxy automatically compresses tool outputs
        # For MVP: Stub (no compression yet, ready for Headroom proxy integration)
        logger.info("Token optimization: Headroom proxy ready (set ANTHROPIC_BASE_URL=http://localhost:8787)")

        # ===== INVOKE 17-NODE LANGGRAPH =====
        logger.info("Invoking 17-node LangGraph...")

        result_state = await travel_graph.ainvoke(
            initial_state,
            config={"recursion_limit": 50}
        )

        response_text = result_state.get("response", "No response generated")

        # ===== TOKEN OPTIMIZATION: Toonify Stub =====
        # In production: Compress structured data (knowledge base, catalogs)
        # For MVP: Response is already text-optimized
        logger.info("Token optimization: Toonify ready for structured data compression")

        # Calculate latency
        latency_ms = int((time.time() - start_time) * 1000)
        result_state["latency_ms"] = latency_ms
        logger.info(f"Graph execution: {latency_ms}ms")

        # Send response via WhatsApp provider
        success = await proveedor.enviar_mensaje(phone_number, response_text)

        if success:
            logger.info(f"Response sent to {phone_number} ({latency_ms}ms)")
            return JSONResponse({
                "status": "ok",
                "latency_ms": latency_ms,
                "intent": result_state.get("intent"),
            })
        else:
            logger.error(f"Failed to send message to {phone_number}")
            return JSONResponse({"status": "error"}, status_code=500)

    except Exception as e:
        logger.error(f"Webhook error: {e}", exc_info=True)
        return JSONResponse({"status": "error", "detail": str(e)}, status_code=500)


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

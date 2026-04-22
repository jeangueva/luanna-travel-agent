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
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import PlainTextResponse, JSONResponse, HTMLResponse

from agent.memory import init_db, find_or_create_user, get_or_create_user_token
from agent.graph import travel_graph
from agent.state import AgentState
from agent.providers import proveedor
from agent.preferences import router as preferences_router

BASE_URL = os.getenv("BASE_URL", "https://luanna-travel-agent-production.up.railway.app")
PREFERENCE_TRIGGERS = {"preferencias", "configurar", "mis ciudades", "mis paises", "mis países", "settings", "perfil", "editar"}

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


@app.get("/privacy", response_class=HTMLResponse)
async def privacy_policy():
    """Privacy policy page (required by Meta)."""
    return """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Política de Privacidad — Luanna</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #333; line-height: 1.6; }
h1 { color: #191c1f; border-bottom: 2px solid #494fdf; padding-bottom: 10px; }
h2 { color: #494fdf; margin-top: 30px; }
ul { margin-left: 20px; }
.updated { color: #8d969e; font-size: 14px; margin-bottom: 30px; }
</style>
</head>
<body>
<h1>Política de Privacidad — Luanna</h1>
<p class="updated">Última actualización: 21 de abril de 2026</p>

<h2>1. Información que Recopilamos</h2>
<p>Luanna es un chatbot de WhatsApp para recomendaciones de viajes. Recopilamos únicamente la información necesaria para brindarte el servicio:</p>
<ul>
<li><strong>Número de WhatsApp:</strong> Para identificarte y enviarte mensajes.</li>
<li><strong>Nombre:</strong> Si lo compartes con nosotros.</li>
<li><strong>Historial de conversación:</strong> Últimos mensajes intercambiados para dar respuestas contextualizadas.</li>
<li><strong>Preferencias de viaje:</strong> Destinos favoritos, fechas, presupuesto que nos indiques.</li>
<li><strong>Búsquedas realizadas:</strong> Para mejorar recomendaciones futuras.</li>
</ul>

<h2>2. Cómo Usamos tu Información</h2>
<ul>
<li>Responder tus consultas sobre vuelos, hoteles y paquetes turísticos.</li>
<li>Personalizar recomendaciones según tus preferencias.</li>
<li>Mejorar nuestros servicios mediante análisis agregado.</li>
<li>Enviarte ofertas relevantes (solo si lo autorizas).</li>
</ul>

<h2>3. Servicios de Terceros</h2>
<p>Para funcionar, Luanna utiliza los siguientes servicios:</p>
<ul>
<li><strong>Meta (WhatsApp):</strong> Plataforma de mensajería.</li>
<li><strong>Anthropic (Claude):</strong> Procesamiento de lenguaje natural. Los mensajes se envían para generar respuestas.</li>
<li><strong>Travelpayouts:</strong> Búsqueda de vuelos y hoteles.</li>
</ul>
<p>Cada servicio tiene su propia política de privacidad que aplica cuando usan tus datos.</p>

<h2>4. Almacenamiento y Seguridad</h2>
<ul>
<li>Tus datos se almacenan de forma segura en servidores encriptados.</li>
<li>Solo nuestro sistema automatizado accede a tu información para procesarla.</li>
<li>No vendemos ni compartimos tus datos con terceros con fines comerciales.</li>
</ul>

<h2>5. Tus Derechos</h2>
<p>Puedes en cualquier momento:</p>
<ul>
<li>Solicitar copia de tus datos enviándonos un mensaje.</li>
<li>Solicitar eliminación de tu información.</li>
<li>Cancelar la suscripción enviando "STOP" o "BAJA".</li>
</ul>

<h2>6. Retención de Datos</h2>
<p>Conservamos tus datos mientras uses el servicio. Si no interactúas con Luanna por 12 meses, tus datos se eliminan automáticamente.</p>

<h2>7. Menores de Edad</h2>
<p>Luanna no está dirigido a menores de 18 años. No recopilamos intencionalmente datos de menores.</p>

<h2>8. Cambios a esta Política</h2>
<p>Podemos actualizar esta política. Notificaremos cambios significativos por WhatsApp.</p>

<h2>9. Contacto</h2>
<p>Para ejercer tus derechos o preguntas sobre privacidad:</p>
<ul>
<li>Email: jeangueva@gmail.com</li>
<li>WhatsApp: Envía un mensaje a Luanna con "privacidad"</li>
</ul>

<p style="margin-top: 40px; text-align: center; color: #8d969e; font-size: 14px;">
© 2026 Luanna Travel Agent · Política de Privacidad
</p>
</body>
</html>"""


@app.get("/terms", response_class=HTMLResponse)
async def terms_of_service():
    """Terms of service page."""
    return """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Términos de Servicio — Luanna</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #333; line-height: 1.6; }
h1 { color: #191c1f; border-bottom: 2px solid #494fdf; padding-bottom: 10px; }
h2 { color: #494fdf; margin-top: 30px; }
ul { margin-left: 20px; }
.updated { color: #8d969e; font-size: 14px; margin-bottom: 30px; }
</style>
</head>
<body>
<h1>Términos de Servicio — Luanna</h1>
<p class="updated">Última actualización: 21 de abril de 2026</p>

<h2>1. Descripción del Servicio</h2>
<p>Luanna es un asistente de viajes por WhatsApp que ofrece recomendaciones de vuelos, hoteles y paquetes turísticos.</p>

<h2>2. Uso Aceptable</h2>
<p>Al usar Luanna aceptas:</p>
<ul>
<li>No usar el servicio para fines ilegales.</li>
<li>No enviar spam o contenido inapropiado.</li>
<li>Proporcionar información veraz.</li>
</ul>

<h2>3. Limitación de Responsabilidad</h2>
<p>Las recomendaciones de Luanna son informativas. Los precios y disponibilidad son provistos por terceros (Travelpayouts) y pueden cambiar. Luanna no es responsable de errores en datos de terceros.</p>

<h2>4. Enlaces de Afiliados</h2>
<p>Luanna puede incluir enlaces de afiliados (Travelpayouts). Recibimos comisión sin costo adicional para ti.</p>

<h2>5. Modificaciones</h2>
<p>Podemos modificar estos términos en cualquier momento.</p>

<h2>6. Contacto</h2>
<p>Email: jeangueva@gmail.com</p>

<p style="margin-top: 40px; text-align: center; color: #8d969e; font-size: 14px;">
© 2026 Luanna Travel Agent
</p>
</body>
</html>"""


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

"""
Claude AI brains - AsyncAnthropic clients for all nodes.
Fast nodes: Claude Haiku 4.5
Complex synthesis: Claude Sonnet 4.6
"""

import os
from anthropic import AsyncAnthropic

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

# Initialize async clients
brain_haiku = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
brain_sonnet = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

MODEL_HAIKU = "claude-3-5-haiku-20241022"
MODEL_SONNET = "claude-3-5-sonnet-20241022"


async def classify_intent_haiku(user_message: str, context: str = "") -> str:
    """Classify user intent using Haiku (fast)."""
    response = await brain_haiku.messages.create(
        model=MODEL_HAIKU,
        max_tokens=50,
        system="You are a travel intent classifier. Classify in one word: new_trip, refine, question, explore",
        messages=[{"role": "user", "content": f"{context}\n\nMessage: {user_message}"}],
    )
    return response.content[0].text.strip().lower()


async def extract_preferences_haiku(user_message: str) -> dict:
    """Extract travel preferences using Haiku (fast)."""
    response = await brain_haiku.messages.create(
        model=MODEL_HAIKU,
        max_tokens=500,
        system="""Extract travel preferences as JSON:
{
  "destination": "city or country",
  "origin": "departure city or null",
  "dates": {"departure": "YYYY-MM-DD", "return": "YYYY-MM-DD or null"},
  "nights": number or null,
  "budget": "economy|mid|luxury|null",
  "travelers": number,
  "style": "adventure|relax|culture|food|null"
}""",
        messages=[{"role": "user", "content": user_message}],
    )
    text = response.content[0].text.strip()
    try:
        import json
        return json.loads(text)
    except:
        return {}


LUANNA_VOICE = """Eres Luanna, asistente de viajes por WhatsApp.

TONO:
- Conciso: 1-2 frases por mensaje. Nada de palabreo.
- Coloquial: usa "tú", no "usted". Como hablar con un amigo.
- Directo: preguntas al grano, sin rodeos.
- Sin saludos de corporativo ("Estimado...", "Apreciado usuario").

FORMATO:
- Frases cortas.
- Emojis solo si aportan (máx 1-2 por mensaje).
- Sin markdown pesado (ni ##, ni **, ni listas largas).
- Usa saltos de línea para separar ideas.

EJEMPLOS BUENOS:
"¿Cuándo viajas? 📅"
"Lima → CDMX desde $280. ¿Te muestro hoteles?"
"Te armé un plan de 5 días. Presupuesto: $900 🌴"

EJEMPLOS MALOS (evitar):
"Hola estimado usuario, me encantaría ayudarte..."
"Para poder brindarte la mejor experiencia..."
"A continuación te presento una lista detallada de..."
"""


async def generate_response_haiku(state: dict, context: str = "") -> str:
    """Generate conversational response using Haiku (fast)."""
    response = await brain_haiku.messages.create(
        model=MODEL_HAIKU,
        max_tokens=200,
        system=LUANNA_VOICE,
        messages=[{"role": "user", "content": f"{context}\n\nUsuario: {state.get('user_message', '')}"}],
    )
    return response.content[0].text.strip()


async def build_itinerary_sonnet(state: dict) -> str:
    """Build complete itinerary using Sonnet (complex synthesis)."""
    flights_summary = "\n".join([f"- ${f.get('price', 'N/A')}: {f.get('airline', 'N/A')}" for f in state.get("flights", [])[:3]])
    hotels_summary = "\n".join([f"- {h.get('name', 'Hotel')}: ${h.get('price', 'N/A')}/night" for h in state.get("hotels", [])[:3]])

    prompt = f"""Build a {state.get('nights', 5)}-night itinerary for {state.get('destination')} with {state.get('style', 'mixed')} style.

Available flights:
{flights_summary}

Available hotels:
{hotels_summary}

Travelers: {state.get('travelers', 1)}
Budget: {state.get('budget', 'mid')}

Create a detailed day-by-day itinerary with times, activities, estimated costs, and tips."""

    response = await brain_sonnet.messages.create(
        model=MODEL_SONNET,
        max_tokens=1200,
        system="""Armas itinerarios de viaje para WhatsApp.

TONO: conciso y coloquial. Nada de palabreo.
FORMATO: día por día, bullets cortos, sin markdown pesado.
LÍMITES: Max 5-6 líneas por día. Solo lo esencial.

Ejemplo:
Día 1 🛬
• Llegada + check-in
• Cena en Polanco ($25)

Día 2 🏛️
• Zócalo y Catedral (AM)
• Xochimilco tarde ($30)
""",
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text.strip()

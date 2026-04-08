"""
Simple test - Chat with Claude without database.
"""

import os
import json
from dotenv import load_dotenv
from anthropic import Anthropic

load_dotenv()

def test_claude_integration():
    """Test Claude API integration."""

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("❌ ANTHROPIC_API_KEY no está configurada en .env")
        return

    print("\n" + "="*60)
    print("🚀 Luanna Travel Agent - Simple Claude Test")
    print("="*60)
    print("Testing Claude AI integration (no database)\n")

    client = Anthropic(api_key=api_key)

    # System prompt
    system_prompt = """Eres Luanna, un asistente amable de viajes por WhatsApp.
Tu misión es ayudar a encontrar vuelos, hoteles y paquetes baratos.

REGLAS:
1. Responde SIEMPRE en español
2. Cuando el usuario quiera buscar, responde con JSON:
   {"action":"search_flights","origin":"MAD","destination":"BCN","date":"2025-06-15"}
3. Para otras preguntas, responde en texto natural
4. Usa emojis: ✈️ vuelos, 🏨 hoteles, 📦 paquetes, 💰 ofertas"""

    messages = []

    print("💬 Chat with Luanna (type 'exit' to quit)\n")

    while True:
        try:
            user_input = input("You: ").strip()

            if user_input.lower() == "exit":
                print("\n👋 Goodbye!")
                break

            if not user_input:
                continue

            # Add user message
            messages.append({
                "role": "user",
                "content": user_input
            })

            # Get Claude response
            print("Luanna: ", end="", flush=True)

            response = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=512,
                system=system_prompt,
                messages=messages
            )

            assistant_message = response.content[0].text
            print(assistant_message)

            # Add assistant response to history
            messages.append({
                "role": "assistant",
                "content": assistant_message
            })

            # Check if response is JSON action
            if assistant_message.strip().startswith("{"):
                try:
                    action = json.loads(assistant_message)
                    print(f"\n📋 Action detected: {action.get('action')}")
                except:
                    pass

            print()

        except KeyboardInterrupt:
            print("\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}\n")


if __name__ == "__main__":
    test_claude_integration()

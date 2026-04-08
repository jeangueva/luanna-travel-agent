"""
Minimal test - Chat with Claude (no dependencies except anthropic).
"""

import os
import json

# Get API key from environment
api_key = os.getenv("ANTHROPIC_API_KEY")

if not api_key:
    print("❌ ANTHROPIC_API_KEY not set")
    print("Set it with: export ANTHROPIC_API_KEY=sk-ant-...")
    exit(1)

try:
    from anthropic import Anthropic
except ImportError:
    print("❌ anthropic module not found. Install with: pip3 install anthropic")
    exit(1)

print("\n" + "="*60)
print("🚀 Luanna Travel Agent - Minimal Claude Test")
print("="*60 + "\n")

client = Anthropic(api_key=api_key)

system_prompt = """Eres Luanna, asistente de viajes por WhatsApp.
Responde SIEMPRE en español.
Cuando quieran buscar vuelos, responde con JSON:
{"action":"search_flights","origin":"MAD","destination":"BCN","date":"2025-06-15"}
Para otras preguntas, responde en texto. Usa emojis: ✈️ 🏨 📦 💰"""

messages = []

print("Type 'exit' to quit\n")

while True:
    user_input = input("You: ").strip()

    if user_input.lower() == "exit":
        print("👋 Goodbye!")
        break

    if not user_input:
        continue

    messages.append({"role": "user", "content": user_input})

    try:
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=512,
            system=system_prompt,
            messages=messages
        )

        assistant_message = response.content[0].text
        print(f"Luanna: {assistant_message}\n")

        messages.append({"role": "assistant", "content": assistant_message})

    except Exception as e:
        print(f"❌ Error: {e}\n")

#!/usr/bin/env python3
"""
Test webhook for Luanna - simulates Meta Cloud API message.
Run: python3 test_webhook.py
"""

import requests
import json
import sys

# Configuration
WEBHOOK_URL = "http://localhost:8000/webhook"
VERIFY_TOKEN = "luanna_webhook_token"

# Simulate Meta Cloud API message format
def create_meta_webhook_body(message_text: str, phone_number: str = "5551234567890"):
    """Create a valid Meta Cloud API webhook payload."""
    return {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "messages": [
                                {
                                    "from": phone_number,
                                    "type": "text",
                                    "text": {"body": message_text},
                                    "id": "wamid.test123",
                                    "timestamp": "1234567890",
                                }
                            ],
                            "contacts": [
                                {
                                    "profile": {"name": "Test User"},
                                    "wa_id": phone_number,
                                }
                            ],
                        }
                    }
                ]
            }
        ],
    }


def test_health():
    """Test health endpoint."""
    print("Testing health endpoint...")
    try:
        response = requests.get(f"{WEBHOOK_URL.replace('/webhook', '')}/health", timeout=5)
        if response.status_code == 200:
            print("✅ Health check passed")
            print(f"   Response: {response.json()}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Cannot connect to server: {e}")
        print("   Make sure to run: uvicorn agent.main:app --reload")
        return False


def test_webhook(message_text: str):
    """Test webhook with a message."""
    print(f"\n📨 Sending message: '{message_text}'")

    payload = create_meta_webhook_body(message_text)

    try:
        response = requests.post(
            WEBHOOK_URL,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )

        print(f"Status code: {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print(f"✅ Success!")
            print(f"   Response: {json.dumps(result, indent=2)}")
            return True
        else:
            print(f"❌ Error: {response.status_code}")
            print(f"   Response: {response.text}")
            return False

    except requests.exceptions.Timeout:
        print("❌ Request timeout (>30s)")
        print("   Luanna is taking too long (goal is <60s)")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def main():
    """Run tests."""
    print("=" * 60)
    print("🚀 Luanna Travel Agent - Webhook Test")
    print("=" * 60)
    print()

    # Test 1: Health
    if not test_health():
        sys.exit(1)

    # Test 2-5: Various messages
    test_messages = [
        "Hola",                          # Greeting
        "Quiero ir a Barcelona en junio",  # New trip
        "5 noches, presupuesto bajo",    # Extraction
        "Sí, adelante",                  # Confirmation
    ]

    for msg in test_messages:
        if not test_webhook(msg):
            print("   (continuing with next test)")

    print()
    print("=" * 60)
    print("✅ Webhook tests complete!")
    print()
    print("📊 Monitor latency in LangSmith:")
    print("   export LANGCHAIN_TRACING_V2=true")
    print("   export LANGCHAIN_API_KEY=sk-...")
    print("   https://smith.langchain.com/")
    print("=" * 60)


if __name__ == "__main__":
    main()

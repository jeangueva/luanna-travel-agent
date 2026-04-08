"""
Whapi.cloud provider adapter.
Implements ProveedorWhatsApp for Whapi.cloud service.
"""

import os
import httpx
from typing import Dict, Optional
from .base import ProveedorWhatsApp, MensajeEntrante

WHAPI_TOKEN = os.getenv("WHAPI_TOKEN")
WHAPI_WEBHOOK_VERIFY_TOKEN = os.getenv("WHAPI_WEBHOOK_VERIFY_TOKEN")
WHAPI_API_BASE = "https://api.whapi.cloud"


class ProveedorWhapi(ProveedorWhatsApp):
    """Whapi.cloud provider implementation."""

    def parsear_webhook(self, request_data: Dict) -> Optional[MensajeEntrante]:
        """
        Parse Whapi webhook format.
        Whapi sends: {"messages": [{"from_phone_number": "...", "text": {"body": "..."}}]}
        """
        try:
            messages = request_data.get("messages", [])

            if not messages:
                return None

            # Process first message
            msg = messages[0]

            # Extract phone number (remove 'whatsapp:' prefix if present)
            phone_number = msg.get("from_phone_number", "")
            if phone_number.startswith("whatsapp:"):
                phone_number = phone_number.replace("whatsapp:", "")

            # Extract message text
            if msg.get("type") == "text":
                message = msg.get("text", {}).get("body", "")
            else:
                return None

            # Extract sender name
            name = msg.get("from_name", None)

            return MensajeEntrante(phone_number=phone_number, message=message, name=name)

        except Exception as e:
            print(f"Error parsing Whapi webhook: {e}")
            return None

    async def enviar_mensaje(self, phone_number: str, message: str) -> bool:
        """Send text message via Whapi."""
        try:
            # Ensure phone number has proper format
            if not phone_number.startswith("+"):
                phone_number = f"+{phone_number}"

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{WHAPI_API_BASE}/messages/text",
                    json={
                        "to": phone_number,
                        "body": message,
                    },
                    headers={
                        "Authorization": f"Bearer {WHAPI_TOKEN}",
                        "Content-Type": "application/json",
                    },
                    timeout=10.0,
                )

                return response.status_code in [200, 201]

        except Exception as e:
            print(f"Error sending Whapi message: {e}")
            return False

    def verificar_token(self, token: str) -> bool:
        """Verify webhook token from Whapi."""
        return token == WHAPI_WEBHOOK_VERIFY_TOKEN

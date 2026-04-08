"""
Meta Cloud API provider adapter.
Implements ProveedorWhatsApp for Meta's official WhatsApp Cloud API.
"""

import os
import httpx
import hashlib
import hmac
from typing import Dict, Optional
from .base import ProveedorWhatsApp, MensajeEntrante

META_ACCESS_TOKEN = os.getenv("META_ACCESS_TOKEN")
META_PHONE_NUMBER_ID = os.getenv("META_PHONE_NUMBER_ID")
META_WEBHOOK_VERIFY_TOKEN = os.getenv("META_WEBHOOK_VERIFY_TOKEN")
META_BUSINESS_ACCOUNT_ID = os.getenv("META_BUSINESS_ACCOUNT_ID")
META_API_VERSION = "v20.0"
META_API_BASE = f"https://graph.instagram.com/{META_API_VERSION}"


class ProveedorMeta(ProveedorWhatsApp):
    """Meta Cloud API (official WhatsApp) provider implementation."""

    def parsear_webhook(self, request_data: Dict) -> Optional[MensajeEntrante]:
        """
        Parse Meta webhook format.
        Meta sends: {
            "object": "whatsapp_business_account",
            "entry": [{
                "changes": [{
                    "value": {
                        "messages": [{
                            "from": "1234567890",
                            "text": {"body": "..."}
                        }],
                        "contacts": [{"profile": {"name": "User Name"}}]
                    }
                }]
            }]
        }
        """
        try:
            # Validate webhook structure
            if request_data.get("object") != "whatsapp_business_account":
                return None

            # Extract message from nested structure
            entries = request_data.get("entry", [])
            if not entries:
                return None

            changes = entries[0].get("changes", [])
            if not changes:
                return None

            value = changes[0].get("value", {})
            messages = value.get("messages", [])
            if not messages:
                return None

            msg = messages[0]

            # Extract phone number (Meta returns just the number, no prefix)
            phone_number = msg.get("from", "")
            if not phone_number.startswith("+"):
                phone_number = f"+{phone_number}"

            # Extract message text
            if msg.get("type") == "text":
                message = msg.get("text", {}).get("body", "")
            else:
                return None

            # Extract sender name
            contacts = value.get("contacts", [])
            name = None
            if contacts:
                name = contacts[0].get("profile", {}).get("name")

            return MensajeEntrante(phone_number=phone_number, message=message, name=name)

        except Exception as e:
            print(f"Error parsing Meta webhook: {e}")
            return None

    async def enviar_mensaje(self, phone_number: str, message: str) -> bool:
        """Send text message via Meta Cloud API."""
        try:
            # Ensure phone number format (Meta accepts with or without +)
            phone_number = phone_number.lstrip("+")

            url = f"{META_API_BASE}/{META_PHONE_NUMBER_ID}/messages"

            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": phone_number,
                "type": "text",
                "text": {
                    "preview_url": False,
                    "body": message,
                },
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {META_ACCESS_TOKEN}",
                        "Content-Type": "application/json",
                    },
                    timeout=10.0,
                )

                if response.status_code in [200, 201]:
                    return True
                else:
                    print(f"Meta API error: {response.status_code} - {response.text}")
                    return False

        except Exception as e:
            print(f"Error sending Meta message: {e}")
            return False

    def verificar_token(self, token: str) -> bool:
        """Verify webhook token from Meta."""
        return token == META_WEBHOOK_VERIFY_TOKEN

    def verificar_firma_webhook(self, x_hub_signature: str, request_body: str) -> bool:
        """
        Verify webhook signature for security.
        Meta includes x-hub-signature header with HMAC SHA256 signature.
        """
        try:
            # Extract signature from header (format: sha256=xxxxx)
            if not x_hub_signature:
                return False

            signature_method, signature_hash = x_hub_signature.split("=")

            if signature_method != "sha256":
                return False

            # Recalculate signature using app secret
            app_secret = os.getenv("META_APP_SECRET", "")
            if not app_secret:
                print("Warning: META_APP_SECRET not set. Skipping signature verification.")
                return True

            expected_hash = hmac.new(
                app_secret.encode(),
                request_body.encode(),
                hashlib.sha256,
            ).hexdigest()

            return signature_hash == expected_hash

        except Exception as e:
            print(f"Error verifying webhook signature: {e}")
            return False

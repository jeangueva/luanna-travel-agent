"""
Base class for WhatsApp providers.
Defines common interface for different WhatsApp service providers.
"""

from abc import ABC, abstractmethod
from typing import Dict, Optional


class MensajeEntrante:
    """Normalized incoming message from any provider."""

    def __init__(self, phone_number: str, message: str, name: str = None):
        self.phone_number = phone_number
        self.message = message
        self.name = name or f"User_{phone_number[-4:]}"


class ProveedorWhatsApp(ABC):
    """Abstract base class for WhatsApp providers."""

    @abstractmethod
    def parsear_webhook(self, request_data: Dict) -> Optional[MensajeEntrante]:
        """Parse incoming webhook and extract message."""
        pass

    @abstractmethod
    async def enviar_mensaje(self, phone_number: str, message: str) -> bool:
        """Send message to user."""
        pass

    @abstractmethod
    def verificar_token(self, token: str) -> bool:
        """Verify webhook token for security."""
        pass

"""
Provider factory - Selects WhatsApp provider based on environment.
"""

import os
from .base import ProveedorWhatsApp
from .meta import ProveedorMeta
from .whapi import ProveedorWhapi


def obtener_proveedor() -> ProveedorWhatsApp:
    """
    Factory function to get the appropriate WhatsApp provider.
    Supports: meta (official), whapi, twilio
    """
    provider_name = os.getenv("WHATSAPP_PROVIDER", "meta").lower()

    if provider_name == "meta":
        return ProveedorMeta()
    elif provider_name == "whapi":
        return ProveedorWhapi()
    else:
        raise ValueError(f"Unsupported provider: {provider_name}")


# Default provider
proveedor = obtener_proveedor()

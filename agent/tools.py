"""
Business logic layer: Travelpayouts integration + utility functions.
"""

import os
import requests
from typing import List, Dict, Optional

TRAVELPAYOUTS_API_BASE = "https://api.travelpayouts.com"
TRAVELPAYOUTS_TOKEN = os.getenv("TRAVELPAYOUTS_TOKEN", "")
TRAVELPAYOUTS_MARKER = os.getenv("TRAVELPAYOUTS_MARKER", "luanna")


def search_flights(origin: str, destination: str, date: str) -> List[Dict]:
    """
    Search flights using Travelpayouts API.

    Args:
        origin: IATA code (e.g., "MAD")
        destination: IATA code (e.g., "BCN")
        date: Date in YYYY-MM-DD format

    Returns:
        List of flight options
    """
    try:
        response = requests.get(
            f"{TRAVELPAYOUTS_API_BASE}/v2/search/",
            params={
                "origin": origin,
                "destination": destination,
                "depart_date": date,
                "token": TRAVELPAYOUTS_TOKEN,
                "limit": 5,
            },
            timeout=10,
        )

        if response.status_code == 200:
            data = response.json()
            return data.get("data", [])
        else:
            print(f"Travelpayouts API error: {response.status_code}")
            return []

    except requests.exceptions.RequestException as e:
        print(f"Error searching flights: {e}")
        return []


def search_hotels(destination: str, checkin: str, nights: int) -> List[Dict]:
    """
    Search hotels using Travelpayouts API.

    Args:
        destination: City name or code
        checkin: Date in YYYY-MM-DD format
        nights: Number of nights

    Returns:
        List of hotel options
    """
    try:
        response = requests.get(
            f"{TRAVELPAYOUTS_API_BASE}/v2/hotels/",
            params={
                "city": destination,
                "check_in": checkin,
                "nights": nights,
                "token": TRAVELPAYOUTS_TOKEN,
                "limit": 5,
            },
            timeout=10,
        )

        if response.status_code == 200:
            data = response.json()
            return data.get("results", [])
        else:
            print(f"Travelpayouts API error: {response.status_code}")
            return []

    except requests.exceptions.RequestException as e:
        print(f"Error searching hotels: {e}")
        return []


def generate_affiliate_link(search_type: str, params: Dict = None) -> str:
    """
    Generate Travelpayouts affiliate link.
    """
    base_url = "https://www.travelpayouts.com"
    marker = TRAVELPAYOUTS_MARKER or "luanna"

    return f"{base_url}/?utm_source=luanna&utm_medium=whatsapp&utm_campaign={marker}"


def format_flight_results(results: List[Dict]) -> str:
    """Format flight results for WhatsApp."""
    if not results:
        return "❌ No encontré vuelos disponibles. Intenta con otras fechas o destinos."

    message = "✈️ Vuelos encontrados:\n\n"
    for idx, flight in enumerate(results[:3], 1):
        price = flight.get("price", "N/A")
        duration = flight.get("duration", "N/A")
        airline = flight.get("airline", "N/A")
        message += f"{idx}. ${price} - {airline} - {duration}h\n"

    link = generate_affiliate_link("flight")
    message += f"\n🔗 Ver todas las opciones: {link}"
    return message


def format_hotel_results(results: List[Dict]) -> str:
    """Format hotel results for WhatsApp."""
    if not results:
        return "❌ No encontré hoteles disponibles. Intenta con otras fechas."

    message = "🏨 Hoteles encontrados:\n\n"
    for idx, hotel in enumerate(results[:3], 1):
        name = hotel.get("name", "Hotel")
        price = hotel.get("price", "N/A")
        rating = hotel.get("rating", "N/A")
        message += f"{idx}. {name} - ${price}/noche ⭐{rating}\n"

    link = generate_affiliate_link("hotel")
    message += f"\n🔗 Ver todas las opciones: {link}"
    return message


def format_package_results(results: List[Dict] = None) -> str:
    """Format package results for WhatsApp."""
    link = generate_affiliate_link("package")
    message = "📦 Paquetes encontrados:\n\n"
    message += "Combina vuelos + hoteles y ahorra más.\n"
    message += f"\n🔗 Ver paquetes: {link}"
    return message


def format_welcome_message() -> str:
    """Welcome message for new users."""
    return (
        "Hola 👋 Soy Luanna, tu asistente de viajes por WhatsApp.\n\n"
        "Puedo ayudarte a encontrar:\n"
        "✈️ Vuelos baratos\n"
        "🏨 Hoteles a mejores precios\n"
        "📦 Paquetes de viaje\n\n"
        "¿A dónde quieres viajar?"
    )


def format_confirmation(action: str, data: str = "") -> str:
    """Confirmation message for actions."""
    if action == "save_destination":
        return f"✅ He guardado '{data}' como tu destino favorito. Ahora te podré enviar ofertas especiales cuando las encuentre."
    return "✅ Entendido."


def format_error_message() -> str:
    """Error message."""
    return "❌ Algo salió mal. Por favor intenta de nuevo."

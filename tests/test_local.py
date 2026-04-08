"""
Local testing - Interactive chat with Luanna in terminal.
No WhatsApp, no internet required. Perfect for testing locally.
"""

import sys
import json
from uuid import uuid4

# Add parent directory to path
sys.path.insert(0, str(__file__).rsplit('/', 2)[0])

from agent import memory, brain, tools
from agent.memory import (
    init_db,
    find_or_create_user,
    get_conversation_history,
    save_conversation,
    get_favorite_destinations,
)


def print_welcome():
    """Print welcome message."""
    print("\n" + "="*60)
    print("🚀 Luanna Travel Agent - Local Testing")
    print("="*60)
    print("Type 'exit' to quit\n")


def process_local_message(user_id: str, user_message: str) -> str:
    """Process a message in local testing context."""
    # Get user's favorites
    favorites = get_favorite_destinations(user_id)
    favorites_list = [
        {"destination": f.destination, "iata_code": f.iata_code}
        for f in favorites
    ]

    # Get conversation history
    conversation_history = get_conversation_history(user_id, limit=10)
    history_for_claude = [
        {"role": msg.role, "content": msg.content} for msg in conversation_history
    ]

    # Get Claude's response
    claude_response, is_json_action = brain.process_message(
        user_message=user_message,
        conversation_history=history_for_claude,
        favorites=favorites_list,
    )

    # Process response
    response_to_user = claude_response

    if is_json_action:
        try:
            action = json.loads(claude_response)
            action_type = action.get("action")

            if action_type == "search_flights":
                origin = action.get("origin")
                destination = action.get("destination")
                date = action.get("date")
                results = tools.search_flights(origin, destination, date)
                response_to_user = tools.format_flight_results(results)

            elif action_type == "search_hotels":
                destination = action.get("destination")
                checkin = action.get("checkin")
                nights = action.get("nights", 1)
                results = tools.search_hotels(destination, checkin, nights)
                response_to_user = tools.format_hotel_results(results)

            elif action_type == "search_packages":
                destination = action.get("destination")
                response_to_user = tools.format_package_results()

            elif action_type == "save_destination":
                destination = action.get("destination")
                iata = action.get("iata")
                memory.save_favorite_destination(user_id, destination, iata)
                response_to_user = tools.format_confirmation("save_destination", destination)

            else:
                response_to_user = tools.format_error_message()

        except json.JSONDecodeError:
            response_to_user = tools.format_error_message()

    # Save to conversation history
    save_conversation(user_id, "user", user_message)
    save_conversation(user_id, "assistant", response_to_user)

    return response_to_user


def main():
    """Main testing loop."""
    # Initialize database
    init_db()

    # Create test user
    test_user = find_or_create_user("+5551234567890", "Test User")
    user_id = test_user.id

    print_welcome()
    print(f"👤 User: {test_user.whatsapp_id}")
    print(f"💬 Chat session started. Type messages and press Enter.\n")

    # Welcome message
    welcome = tools.format_welcome_message()
    print(f"Luanna: {welcome}\n")

    # Chat loop
    while True:
        try:
            user_input = input("You: ").strip()

            if user_input.lower() == "exit":
                print("\n👋 Goodbye!")
                break

            if not user_input:
                continue

            # Process message
            response = process_local_message(user_id, user_input)
            print(f"\nLuanna: {response}\n")

        except KeyboardInterrupt:
            print("\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}\n")


if __name__ == "__main__":
    main()

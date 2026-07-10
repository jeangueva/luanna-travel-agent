// Quick-reply suggestions, derived DETERMINISTICALLY from which tools ran in
// the turn (never from the LLM — must work identically on MiniMax). One source
// of truth for both channels: WhatsApp renders them as native reply buttons
// (max 3, title ≤ 20 chars), the web chat as tappable chips. A tap comes back
// as the button id; mapTapToMessage turns it into the natural-language user
// message the LLM actually understands.

export interface Suggestion {
  /** Stable id, arrives back in the button_reply webhook. */
  id: string;
  /** Button/chip label. WhatsApp hard limit: 20 chars including emoji. */
  title: string;
  /** What the tap means, phrased as a user message for the LLM. */
  message: string;
}

const CATALOG: Record<string, Suggestion> = {
  qr_alert: {
    id: "qr_alert",
    title: "🔔 Crear alerta",
    message: "Crea una alerta de precio para esa ruta y avísame cuando baje",
  },
  qr_hotels: {
    id: "qr_hotels",
    title: "🏨 Ver hoteles",
    message: "Búscame hoteles en ese destino para esas fechas",
  },
  qr_flights: {
    id: "qr_flights",
    title: "✈️ Buscar vuelos",
    message: "Búscame vuelos a ese destino",
  },
  qr_itinerary: {
    id: "qr_itinerary",
    title: "📄 Itinerario",
    message: "Sí, ármame el itinerario completo del viaje",
  },
};

// Per-tool follow-ups, most specific last-ran tool wins. start_itinerary
// suppresses everything: the reply is "lo estoy armando ⏳" and the real link
// arrives in a separate push, so a button row in between reads as noise.
const FOLLOW_UPS: Record<string, string[]> = {
  search_flights: ["qr_alert", "qr_hotels", "qr_itinerary"],
  search_hotels: ["qr_flights", "qr_alert", "qr_itinerary"],
  search_stays: ["qr_flights", "qr_alert", "qr_itinerary"],
  get_package_link: ["qr_alert", "qr_itinerary"],
  suggest_itinerary: ["qr_itinerary", "qr_flights", "qr_alert"],
  trip_prep: ["qr_flights", "qr_itinerary"],
  add_watchlist: ["qr_flights", "qr_hotels"],
};

const SUPPRESSORS = new Set(["start_itinerary"]);

/**
 * Derive the follow-up suggestions for a turn from the tools that ran, in
 * call order. Returns [] when no search-ish tool ran (plain chat turns get no
 * buttons — a button row on every message is spam, not UX).
 */
export function deriveSuggestions(toolNames: string[]): Suggestion[] {
  if (toolNames.some((t) => SUPPRESSORS.has(t))) return [];
  // Last tool with a follow-up mapping decides the row.
  for (let i = toolNames.length - 1; i >= 0; i--) {
    const ids = FOLLOW_UPS[toolNames[i]];
    if (ids) return ids.map((id) => CATALOG[id]).filter(Boolean).slice(0, 3);
  }
  return [];
}

/**
 * Translate a tapped button back into the user message the LLM should see.
 * Unknown ids (future buttons, stale sessions) fall back to the visible title
 * so the turn still makes sense to the model.
 */
export function mapTapToMessage(id: string, title: string): string {
  return CATALOG[id]?.message ?? title;
}

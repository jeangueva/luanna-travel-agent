// Structured trip itinerary: the single source of truth that both the web
// view (/trip/:slug) and the PDF export render from. Shape unions Planny's
// per-place fields (name, category, photo, ordered map pin) with the richer
// reference PDF (rating, time, tips, hotel, per-day weather/difficulty header).
// The LLM emits one object matching ItinerarySchema; we validate on write so a
// malformed generation never reaches the renderer.
import { z } from "zod";

export const ItineraryPlaceSchema = z.object({
  name: z.string().min(1),
  // Planny shows a category chip per place ("Monument", "Museo", "Mirador").
  category: z.string().optional(),
  // Reference PDF rates each place 1-5 (rendered as [+++++]). No min/max here:
  // Anthropic structured output rejects integer min/max — the renderer clamps.
  rating: z.number().int().optional().describe("Calificación 1-5"),
  // Free-text dwell time, e.g. "2-3 horas", "45-60 min".
  time: z.string().optional(),
  description: z.string().optional(),
  tips: z.array(z.string()).default([]),
  // Google Maps query; if omitted the renderer falls back to `name`.
  maps_query: z.string().optional(),
  // Filled later by the Wikimedia enrichment step (M4); the LLM leaves it null.
  photo: z.string().url().nullable().optional(),
});
export type ItineraryPlace = z.infer<typeof ItineraryPlaceSchema>;

export const ItineraryDaySchema = z.object({
  number: z.number().int().describe("Número de día, empieza en 1"),
  title: z.string().min(1),
  // The PDF's per-day line: transit + weather + difficulty, e.g.
  // "Aeropuerto → Centro · 11-19°C · Nivel 2/5 - Fácil".
  header: z.string().optional(),
  places: z.array(ItineraryPlaceSchema).default([]),
  meals: z.string().optional(),
  hotel: z.string().optional(),
  notes: z.array(z.string()).default([]),
});
export type ItineraryDay = z.infer<typeof ItineraryDaySchema>;

export const ItineraryPartSchema = z.object({
  // Optional grouping for multi-region trips ("PARTE 1 - ESCOCIA"). A simple
  // single-city plan uses one untitled part.
  title: z.string().optional(),
  subtitle: z.string().optional(),
  days: z.array(ItineraryDaySchema).min(1),
});
export type ItineraryPart = z.infer<typeof ItineraryPartSchema>;

const KeyValueSchema = z.object({ label: z.string(), value: z.string() });

export const ItinerarySchema = z.object({
  title: z.string().min(1), // "9 Días en París"
  subtitle: z.string().optional(),
  destination: z.string().min(1),
  dates_label: z.string().optional(), // "Agosto - Septiembre 2025"
  total_days: z.number().int().describe("Total de días del viaje (1-60)"),
  route_label: z.string().optional(), // "Edimburgo → Highlands → Skye → Londres"
  // Planny's optional chips: fotografia | viaje_pausado | comida | aventura | economico.
  style: z.array(z.string()).default([]),
  // Executive-summary rows (destinos, grupo, hoteles, coche, clima, presupuesto…).
  summary: z.array(KeyValueSchema).default([]),
  parts: z.array(ItineraryPartSchema).min(1),
  budget: z
    .object({
      intro: z.string().optional(),
      rows: z.array(KeyValueSchema).default([]),
      total: z.string().optional(),
    })
    .optional(),
  notes: z.array(z.string()).default([]),
});
export type Itinerary = z.infer<typeof ItinerarySchema>;

// Flatten every place across all parts/days in visit order. Drives the numbered
// "MAPA COMPLETO - N LUGARES EN ORDEN" page and the map pins.
export interface OrderedPlace {
  n: number;
  name: string;
  maps_query: string;
  day: number;
}
export function orderedPlaces(it: Itinerary): OrderedPlace[] {
  const out: OrderedPlace[] = [];
  let n = 0;
  for (const part of it.parts) {
    for (const day of part.days) {
      for (const place of day.places) {
        n += 1;
        out.push({
          n,
          name: place.name,
          maps_query: place.maps_query ?? place.name,
          day: day.number,
        });
      }
    }
  }
  return out;
}

export function googleMapsUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

// A multi-stop Google Maps directions URL across every place, in order — backs
// the "ABRIR MAPA EN GOOGLE MAPS" link from the reference PDF.
export function googleMapsTripUrl(places: OrderedPlace[]): string {
  if (places.length === 0) return "https://www.google.com/maps";
  const waypoints = places.map((p) => encodeURIComponent(p.maps_query)).join("/");
  return `https://www.google.com/maps/dir/${waypoints}`;
}

// URL-safe public slug (~47 bits). Mirrors the link-code generator; trips are
// long-lived and unguessable rather than one-shot.
export function makeTripSlug(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 56])
    .join("");
}

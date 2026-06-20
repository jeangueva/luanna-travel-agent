// Best-effort place photos from Wikipedia (free, no key). One API call per
// place via the pageimages generator: search the place name, take the first
// result that has a thumbnail. Spanish Wikipedia first, English as fallback.
// Everything here is best-effort — a miss just leaves the place without a photo.
import type { Itinerary } from "./itinerary";

interface WikiQueryResponse {
  query?: {
    pages?: Record<
      string,
      { index?: number; thumbnail?: { source?: string } }
    >;
  };
}

async function fetchPhotoFromWiki(
  lang: string,
  query: string,
  signal: AbortSignal,
): Promise<string | null> {
  const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", query);
  url.searchParams.set("gsrlimit", "3");
  url.searchParams.set("prop", "pageimages");
  url.searchParams.set("piprop", "thumbnail");
  url.searchParams.set("pithumbsize", "800");
  url.searchParams.set("origin", "*");
  const res = await fetch(url.toString(), {
    signal,
    headers: { "User-Agent": "LuannaTravelBot/1.0 (https://luanna.app)" },
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as WikiQueryResponse | null;
  const pages = data?.query?.pages;
  if (!pages) return null;
  // Pick the lowest search index that actually has a thumbnail.
  const sorted = Object.values(pages).sort(
    (a, b) => (a.index ?? 999) - (b.index ?? 999),
  );
  for (const p of sorted) {
    const src = p.thumbnail?.source;
    if (src) return src;
  }
  return null;
}

export async function fetchPlacePhoto(
  placeName: string,
  destination: string,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  // Bias the query toward the destination so "Old Man" → "Old Man of Storr".
  const query = `${placeName} ${destination}`.trim();
  try {
    return (
      (await fetchPhotoFromWiki("es", query, controller.signal).catch(
        () => null,
      )) ??
      (await fetchPhotoFromWiki("en", query, controller.signal).catch(
        () => null,
      ))
    );
  } finally {
    clearTimeout(timer);
  }
}

// Fill `photo` on every place that lacks one, mutating the itinerary in place.
// Bounded: capped place count + limited concurrency + overall deadline, so a
// slow Wikipedia never stalls a render. Returns true if anything changed.
export async function enrichItineraryPhotos(
  it: Itinerary,
  opts: { maxPlaces?: number; concurrency?: number; deadlineMs?: number } = {},
): Promise<boolean> {
  const maxPlaces = opts.maxPlaces ?? 40;
  const concurrency = opts.concurrency ?? 6;
  const deadlineMs = opts.deadlineMs ?? 9000;

  // Collect distinct places still missing a photo, in visit order.
  const targets: Array<{ name: string; setters: Array<(u: string) => void> }> =
    [];
  const byName = new Map<string, number>();
  for (const part of it.parts) {
    for (const day of part.days) {
      for (const place of day.places) {
        if (place.photo) continue;
        const key = place.name.toLowerCase();
        let idx = byName.get(key);
        if (idx === undefined) {
          if (targets.length >= maxPlaces) continue;
          idx = targets.length;
          byName.set(key, idx);
          targets.push({ name: place.name, setters: [] });
        }
        targets[idx].setters.push((u) => {
          place.photo = u;
        });
      }
    }
  }
  if (targets.length === 0) return false;

  let changed = false;
  const deadline = Date.now() + deadlineMs;
  let cursor = 0;
  async function worker() {
    while (cursor < targets.length && Date.now() < deadline) {
      const t = targets[cursor++];
      const url = await fetchPlacePhoto(t.name, it.destination).catch(
        () => null,
      );
      if (url) {
        for (const set of t.setters) set(url);
        changed = true;
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, targets.length) }, worker),
  );
  return changed;
}

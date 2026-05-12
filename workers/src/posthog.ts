// Thin PostHog ingest wrapper. No SDK dependency — uses the public capture
// endpoint over fetch so it works inside Workers without extra Node shims.
//
// Setup: `wrangler secret put POSTHOG_API_KEY` with your project's public
// "PROJECT_API_KEY" from app.posthog.com. Optionally set POSTHOG_HOST if
// using the EU data center (default is us.i.posthog.com).
//
// When POSTHOG_API_KEY is unset every track call is a silent no-op, so it's
// safe to deploy this code before the secret is configured.

export interface PosthogEnv {
  POSTHOG_API_KEY?: string;
  POSTHOG_HOST?: string;
}

const DEFAULT_HOST = "https://us.i.posthog.com";

export interface TrackEvent {
  event: string;
  distinct_id: string;
  properties?: Record<string, unknown>;
}

function host(env: PosthogEnv): string {
  const raw = env.POSTHOG_HOST?.trim();
  if (!raw) return DEFAULT_HOST;
  return raw.replace(/\/+$/, "");
}

export async function track(
  env: PosthogEnv,
  event: TrackEvent,
): Promise<void> {
  if (!env.POSTHOG_API_KEY) return;
  try {
    const res = await fetch(`${host(env)}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: env.POSTHOG_API_KEY,
        event: event.event,
        distinct_id: event.distinct_id,
        properties: event.properties ?? {},
        timestamp: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      console.error(
        `posthog capture failed ${res.status}`,
        (await res.text().catch(() => "")).slice(0, 200),
      );
    }
  } catch (err) {
    // Never let analytics break a request.
    console.error("posthog capture error", err);
  }
}

export async function trackBatch(
  env: PosthogEnv,
  events: TrackEvent[],
): Promise<void> {
  if (!env.POSTHOG_API_KEY || events.length === 0) return;
  try {
    const res = await fetch(`${host(env)}/batch/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: env.POSTHOG_API_KEY,
        batch: events.map((e) => ({
          event: e.event,
          distinct_id: e.distinct_id,
          properties: e.properties ?? {},
          timestamp: new Date().toISOString(),
        })),
      }),
    });
    if (!res.ok) {
      console.error(
        `posthog batch failed ${res.status}`,
        (await res.text().catch(() => "")).slice(0, 200),
      );
    }
  } catch (err) {
    console.error("posthog batch error", err);
  }
}

export function distinctIdForUser(userId: number): string {
  return `user_${userId}`;
}

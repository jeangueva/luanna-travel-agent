// Shared timeout + latency instrumentation for every OUTBOUND call to an
// external dependency (Travelpayouts, Kapso, Hotellook, …). Two jobs:
//
//   1. BOUND every request. A raw `fetch()` in a Worker has no timeout — a slow
//      upstream hangs until the whole invocation is killed, so the user gets
//      silence (or, on the WhatsApp path, the 26s reply-timeout fallback). One
//      stalled dependency must never consume the whole turn's budget.
//
//   2. NAME the culprit. Every call logs `upstream dep=<x> ms=<n> status=<s>`,
//      so when a turn times out the logs show exactly which dependency was slow
//      instead of leaving us guessing.
//
// On timeout we throw a tagged `UpstreamTimeoutError`; callers on a degradable
// path (e.g. one window of a flight fan-out) catch it and return empty so the
// rest of the results still flow.

export class UpstreamTimeoutError extends Error {
  constructor(
    public readonly dep: string,
    public readonly ms: number,
  ) {
    super(`${dep} timed out after ${ms}ms`);
    this.name = "UpstreamTimeoutError";
  }
}

export interface FetchTimeoutOpts {
  /** Stable dependency label for logs, e.g. "travelpayouts:flights". */
  dep: string;
  /** Hard ceiling for this single request. */
  timeoutMs: number;
}

/**
 * `fetch` with a hard per-request timeout and one structured latency log line.
 * Throws {@link UpstreamTimeoutError} on timeout, the original error otherwise.
 */
export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit,
  opts: FetchTimeoutOpts,
): Promise<Response> {
  const { dep, timeoutMs } = opts;
  const started = Date.now();
  try {
    const res = await fetch(input, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
    console.log(
      `upstream dep=${dep} ms=${Date.now() - started} status=${res.status}`,
    );
    return res;
  } catch (err) {
    const ms = Date.now() - started;
    // AbortSignal.timeout fires a DOMException named "TimeoutError".
    const timedOut = err instanceof DOMException && err.name === "TimeoutError";
    console.log(
      `upstream dep=${dep} ms=${ms} status=${timedOut ? "timeout" : "error"}`,
    );
    if (timedOut) throw new UpstreamTimeoutError(dep, timeoutMs);
    throw err;
  }
}

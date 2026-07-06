// Repair fabricated click-tracking links. Cheap models sometimes transcribe the
// opaque random /r/<id> codes wrong (or echo a stale one from chat history),
// producing luanna.app/r/<id> URLs that silently redirect to the homepage. We
// extract the REAL /r/ URLs the tools actually created this turn (from the
// tool-call results) and, when the count matches, replace the in-text /r/
// links positionally. Both the search tools and the model order results
// cheapest-first, so position aligns price↔link. Any remaining id that wasn't
// created this turn is verified against click_redirects — links echoed from
// history stay if they exist, and fabricated codes are stripped. A missing
// link is recoverable; a link to the homepage reads as a broken product.
import { filterExistingClickIds, type Sql } from "./db";

const R_URL_RE = /https?:\/\/[^\s"'<>)]+\/r\/[A-Za-z0-9_-]{4,32}/g;
const R_URL_CAPTURE_RE = /(https?:\/\/[^\s"'<>)]+\/r\/)([A-Za-z0-9_-]{4,32})/g;

export async function repairTrackedLinks(
  sql: Sql,
  text: string,
  steps: unknown,
): Promise<string> {
  if (!text.includes("/r/")) return text;
  const blob = JSON.stringify(steps ?? "");
  const realUrls: string[] = [];
  const seen = new Set<string>();
  for (const m of blob.matchAll(R_URL_RE)) {
    if (!seen.has(m[0])) {
      seen.add(m[0]);
      realUrls.push(m[0]);
    }
  }
  const realIds = new Set(realUrls.map((u) => u.split("/r/")[1]));

  const textMatches = [...text.matchAll(R_URL_CAPTURE_RE)];
  if (textMatches.length === 0) return text;
  if (textMatches.every((m) => realIds.has(m[2]))) return text; // all valid

  // Counts match → positionally remap (search + model both order results
  // cheapest-first, so price↔link alignment holds).
  if (realUrls.length > 0 && textMatches.length === realUrls.length) {
    let i = 0;
    return text.replace(R_URL_CAPTURE_RE, () => realUrls[i++] ?? "");
  }

  // Can't remap by position. Ids not created this turn may still be real
  // (echoed from an earlier turn's tool result) — check the DB in one query
  // and keep those; strip the rest. On a DB error strip unknowns: a missing
  // link beats a dead one.
  const unknownIds = [
    ...new Set(textMatches.map((m) => m[2]).filter((id) => !realIds.has(id))),
  ];
  const existing = await filterExistingClickIds(sql, unknownIds).catch(
    () => new Set<string>(),
  );
  return text.replace(R_URL_CAPTURE_RE, (full, _prefix, id) =>
    realIds.has(id) || existing.has(id) ? full : "",
  );
}

// ── Streaming link guard ─────────────────────────────────────────────────────
// The web chat streams LLM tokens straight to the browser, so the post-hoc
// repairTrackedLinks/sanitizeReply pass (which runs at persist time) never
// protected what the user actually SAW. This TransformStream closes that gap:
// it holds back only the tail of the buffer while a URL might still be
// growing, and when a URL completes it applies the same rules as the batch
// path — foreign hosts stripped, /r/ ids validated against this turn's tool
// links (fed live via addRealUrl from onStepFinish), unknown ids repaired to
// an unused real link, DB-checked, or stripped. Everything else flushes
// through immediately, so perceived streaming latency is unchanged.

const URL_TOKEN_RE = /https?:\/\/[^\s"'<>)\]]+/g;
// A trailing fragment that could still become (more of) a URL. `h`, `ht`,
// `htt`… must also be held back, since "https://…" may arrive split anywhere.
const PARTIAL_URL_TAIL_RE = /(?:https?:\/\/[^\s"'<>)\]]*|https?:\/?|https?|http|htt|ht|h)$/i;
// Split a luanna /r/ URL into prefix + id + trailing junk (models sometimes
// glue an emoji or period right onto the link — the junk must not hide the id).
const R_URL_PARTS_RE = /^(.*\/r\/)([A-Za-z0-9_-]{4,32})(.*)$/;

export function createLinkGuardStream(
  sql: Sql,
  baseUrl: string,
): {
  stream: TransformStream<string, string>;
  addRealUrl: (url: string) => void;
} {
  const allowedHost = new URL(baseUrl).host;
  const realUrls: string[] = [];
  const usedIds = new Set<string>();
  let buffer = "";

  const addRealUrl = (url: string) => {
    if (!realUrls.includes(url)) realUrls.push(url);
  };

  const resolveUrl = async (url: string): Promise<string> => {
    let host: string;
    try {
      host = new URL(url).host;
    } catch {
      return "";
    }
    if (host !== allowedHost) return ""; // same policy as sanitizeReply
    const parts = url.match(R_URL_PARTS_RE);
    if (!parts) return url; // non-/r/ luanna URL (e.g. /trip/, /webview/)
    const [, prefix, id, rest] = parts;
    const realIds = new Set(
      realUrls.map((u) => u.split("/r/")[1]).filter(Boolean),
    );
    if (realIds.has(id)) {
      usedIds.add(id);
      return url;
    }
    // Unknown id. Prefer swapping in a real link the model hasn't shown yet —
    // the streaming analogue of the positional remap (both sides emit
    // cheapest-first, so order lines up). Trailing junk (emoji/punctuation)
    // survives the swap.
    const unused = realUrls.find((u) => {
      const rid = u.split("/r/")[1];
      return rid && !usedIds.has(rid);
    });
    if (unused) {
      usedIds.add(unused.split("/r/")[1]);
      return unused + rest;
    }
    // Nothing from this turn → maybe a valid echo of an earlier turn.
    const existing = await filterExistingClickIds(sql, [id]).catch(
      () => new Set<string>(),
    );
    if (existing.has(id)) {
      usedIds.add(id);
      return prefix + id + rest;
    }
    return ""; // fabricated → strip
  };

  // Rewrite every COMPLETE URL in `chunk` (no partial tail — caller guarantees).
  const rewrite = async (chunk: string): Promise<string> => {
    if (!chunk) return chunk;
    URL_TOKEN_RE.lastIndex = 0;
    let out = "";
    let last = 0;
    for (const m of chunk.matchAll(URL_TOKEN_RE)) {
      out += chunk.slice(last, m.index);
      out += await resolveUrl(m[0]);
      last = m.index! + m[0].length;
    }
    return out + chunk.slice(last);
  };

  const stream = new TransformStream<string, string>({
    async transform(chunk, controller) {
      buffer += chunk;
      // Hold back only a possibly-growing URL at the very tail.
      const tail = buffer.match(PARTIAL_URL_TAIL_RE);
      const safeEnd = tail ? tail.index! : buffer.length;
      const safe = buffer.slice(0, safeEnd);
      buffer = buffer.slice(safeEnd);
      if (safe) {
        const emitted = await rewrite(safe);
        if (emitted) controller.enqueue(emitted);
      }
    },
    async flush(controller) {
      if (buffer) {
        const emitted = await rewrite(buffer);
        if (emitted) controller.enqueue(emitted);
      }
    },
  });

  return { stream, addRealUrl };
}

// Pull every /r/ short link out of an arbitrary step payload (tool results).
export function extractRealUrls(steps: unknown): string[] {
  const blob = JSON.stringify(steps ?? "");
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of blob.matchAll(R_URL_RE)) {
    if (!seen.has(m[0])) {
      seen.add(m[0]);
      out.push(m[0]);
    }
  }
  return out;
}

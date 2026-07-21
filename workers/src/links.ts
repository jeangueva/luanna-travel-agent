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

// Narrow arbitrary AI-SDK steps down to ONLY the tool results before matching
// URLs. Stringifying whole steps is poisonous: they embed the request payload
// (system prompt + chat HISTORY), so a dead /r/ id echoed from an old message
// would count as "created this turn" and sail through the guard — exactly the
// CpbWiH ghost-link bug.
function toolResultsBlob(steps: unknown): string {
  if (!Array.isArray(steps)) return "";
  const parts: unknown[] = [];
  for (const step of steps as Array<Record<string, unknown>>) {
    if (!step || typeof step !== "object") continue;
    if (step.toolResults) parts.push(step.toolResults);
    else if (Array.isArray(step.content)) {
      parts.push(
        (step.content as Array<{ type?: string }>).filter(
          (c) => c?.type === "tool-result",
        ),
      );
    }
  }
  try {
    return JSON.stringify(parts);
  } catch {
    return "";
  }
}

export async function repairTrackedLinks(
  sql: Sql,
  text: string,
  steps: unknown,
): Promise<string> {
  const blob = toolResultsBlob(steps);
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
  // The model sometimes promises links ("Ver en Airbnb: / Ver en Booking:")
  // and then writes every label with nothing after it — a genuinely
  // different failure than a fabricated/stale code, since there's nothing in
  // the text to repair. If a tool created real links this turn and NONE of
  // them made it into the reply, append ALL of them (not just one — tools
  // like search_stays/get_package_link routinely create 2-3 links at once,
  // and backfilling only the first still leaves the other labeled slots
  // pointing at nothing).
  if (textMatches.length === 0) {
    if (realUrls.length === 0) return text;
    const sep = /[.!?…\s]$/.test(text) ? " " : "\n\n";
    return text + sep + realUrls.join("\n");
  }
  if (textMatches.every((m) => realIds.has(m[2]))) return text; // all valid

  // Counts match → positionally remap (search + model both order results
  // cheapest-first, so price↔link alignment holds).
  if (realUrls.length > 0 && textMatches.length === realUrls.length) {
    let i = 0;
    return text.replace(R_URL_CAPTURE_RE, () => realUrls[i++] ?? "");
  }

  // Can't remap by position. Prefer swapping each unknown id for a fresh link
  // the model hasn't shown yet — both sides emit cheapest-first, so order
  // lines up (same policy as the streaming guard below). The tool ran this
  // turn, so the text describes THIS turn's results; an id echoed from
  // history would point at an old search even when it still resolves. Only
  // once fresh links run out do we fall back to the DB check (valid echo of
  // an earlier turn) and strip whatever remains. On a DB error strip
  // unknowns: a missing link beats a dead one.
  const usedRealIds = new Set(
    textMatches.map((m) => m[2]).filter((id) => realIds.has(id)),
  );
  const unusedReal = realUrls.filter((u) => !usedRealIds.has(u.split("/r/")[1]));
  const unknownIds = [
    ...new Set(textMatches.map((m) => m[2]).filter((id) => !realIds.has(id))),
  ];
  const existing = await filterExistingClickIds(sql, unknownIds).catch(
    () => new Set<string>(),
  );
  let swap = 0;
  return text.replace(R_URL_CAPTURE_RE, (full, _prefix, id) => {
    if (realIds.has(id)) return full;
    if (swap < unusedReal.length) return unusedReal[swap++];
    return existing.has(id) ? full : "";
  });
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
      // Same "model promised links and never wrote them" gap as the batch
      // repair (see repairTrackedLinks): real links existed this turn but
      // zero ids ever resolved into the visible stream. Append ALL of them —
      // a tool can create 2-3 links at once (search_stays, get_package_link),
      // and backfilling only the first leaves the rest of the promise broken.
      if (usedIds.size === 0 && realUrls.length > 0) {
        controller.enqueue("\n\n" + realUrls.join("\n"));
      }
    },
  });

  return { stream, addRealUrl };
}

// Replace /r/ short links in a HISTORY message with an inert placeholder
// before the text reaches the LLM. Prompt rules alone don't stop the model
// from echoing an old code (observed with MiniMax-M3: it re-printed a whole
// flight answer, dead link included, without calling the tool). A code the
// model never sees is a code it can't copy — so the only way for it to show
// a link is to run the search tool this turn, which is exactly the product
// guarantee: every link points at THIS recommendation's live result.
const R_URL_FULL_RE = /https?:\/\/[^\s"'<>)\]]+\/r\/[A-Za-z0-9_-]{4,32}/g;
export const EXPIRED_LINK_PLACEHOLDER = "[link vencido — busca de nuevo]";
export function scrubHistoryLinks(text: string): string {
  if (!text.includes("/r/")) return text;
  return text.replace(R_URL_FULL_RE, EXPIRED_LINK_PLACEHOLDER);
}

// Pull every /r/ short link out of a step's TOOL RESULTS (never the whole
// step — see toolResultsBlob for why).
export function extractRealUrls(step: unknown): string[] {
  const blob = toolResultsBlob([step]);
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

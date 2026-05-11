export const PREFS_ARRAY_MAX = 50;
export const PREFS_STRING_MAX = 60;
export const PREFS_ORIGIN_MAX = 50;
export const PREFS_BUDGET_MAX = 1_000_000;
export const CHAT_MESSAGE_MAX = 4000;

export function cleanStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .slice(0, PREFS_ARRAY_MAX)
    .map((s) => s.trim().slice(0, PREFS_STRING_MAX));
}

export function clampBudget(input: unknown): number | null {
  if (typeof input !== "number" || !Number.isFinite(input) || input < 0) {
    return null;
  }
  return Math.min(PREFS_BUDGET_MAX, Math.floor(input));
}

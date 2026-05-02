function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return base64UrlEncode(new Uint8Array(sig));
}

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const TOKEN_TTL_SECONDS = 7 * 24 * 3600;

export async function createWebviewToken(
  userId: number,
  secret: string,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = `${userId}.${exp}`;
  const sig = await hmac(payload, secret);
  return `${payload}.${sig}`;
}

export async function verifyWebviewToken(
  token: string,
  secret: string,
): Promise<number | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userIdStr, expStr, sig] = parts;
  const userId = Number(userIdStr);
  const exp = Number(expStr);
  if (!Number.isFinite(userId) || !Number.isFinite(exp)) return null;
  if (exp * 1000 < Date.now()) return null;
  const expectedSig = await hmac(`${userIdStr}.${expStr}`, secret);
  if (!constantTimeEq(sig, expectedSig)) return null;
  return userId;
}

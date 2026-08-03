import crypto from "crypto";

/**
 * Passwords in odg_employee are stored in mixed formats:
 *   - plaintext            (legacy majority)
 *   - scrypt$<salt>$<key>  (base64 salt + base64 derived key, Node crypto.scrypt defaults)
 *
 * verifyPassword compares a user-supplied password against the stored value,
 * transparently handling both formats.
 */
export function verifyPassword(input: string, stored: string | null | undefined): boolean {
  if (stored == null) return false;
  const s = String(stored);
  if (s.startsWith("scrypt$")) return verifyScrypt(input, s);
  return timingSafeEqualStr(input, s);
}

function verifyScrypt(input: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3) return false;
  const [, saltB64, hashB64] = parts;
  try {
    const salt = Buffer.from(normalizeB64(saltB64), "base64");
    const expected = Buffer.from(normalizeB64(hashB64), "base64");
    if (salt.length === 0 || expected.length === 0) return false;
    // Node crypto.scryptSync defaults: N=16384, r=8, p=1
    const derived = crypto.scryptSync(input, salt, expected.length, { N: 16384, r: 8, p: 1 });
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** Accept both standard and url-safe base64, with or without padding. */
function normalizeB64(s: string): string {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  return t + "=".repeat((4 - (t.length % 4)) % 4);
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

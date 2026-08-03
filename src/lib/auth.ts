import { SignJWT, jwtVerify } from "jose";

// Tokens are valid this long; must match the session cookie lifetime.
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === "pos_secret") {
    // Refuse to run with a missing or default secret — forged tokens otherwise.
    throw new Error("JWT_SECRET must be set to a strong value in the environment");
  }
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: { code: string; username: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
  return payload as { code: string; username: string };
}

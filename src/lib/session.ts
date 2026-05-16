import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

export const SESSION_COOKIE = "pos_token";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export type Session = { code: string; username: string };

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await verifyToken(token);
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

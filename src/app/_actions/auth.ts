"use server";

import { cookies } from "next/headers";
import { runQuery } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { EMPLOYEE_USER_SELECT, normalizeEmployeeUser, type EmployeeUser } from "@/lib/employee-user";
import { SESSION_COOKIE, SESSION_MAX_AGE, getSession } from "@/lib/session";

export type LoginResult = { ok: boolean; user?: EmployeeUser; error?: string };

// In-memory throttle: 5 failed attempts per username per 10 minutes.
const FAILED_WINDOW_MS = 10 * 60 * 1000;
const FAILED_MAX = 5;
const failedLogins = new Map<string, number[]>();

function isThrottled(username: string): boolean {
  const now = Date.now();
  const attempts = (failedLogins.get(username) || []).filter((t) => now - t < FAILED_WINDOW_MS);
  failedLogins.set(username, attempts);
  return attempts.length >= FAILED_MAX;
}

function recordFailure(username: string): void {
  const attempts = failedLogins.get(username) || [];
  attempts.push(Date.now());
  failedLogins.set(username, attempts);
}

export async function loginAction(usernameRaw: string, passwordRaw: string): Promise<LoginResult> {
  const username = String(usernameRaw || "").trim();
  const password = String(passwordRaw || "");
  if (!username || !password) return { ok: false, error: "Missing credentials" };
  if (isThrottled(username)) {
    return { ok: false, error: "Too many attempts — try again in a few minutes" };
  }

  try {
    const employee = (await runQuery(
      `${EMPLOYEE_USER_SELECT.replace("SELECT", "SELECT password AS __password,")}
         WHERE employee_code = $1
           AND COALESCE(employment_status, 'ACTIVE') = 'ACTIVE'`,
      [username],
      "one"
    )) as Record<string, unknown> | null;

    if (!employee || !verifyPassword(password, employee?.__password as string | null)) {
      // Same message and log detail for unknown user vs wrong password —
      // anything richer enables account enumeration and credential probing.
      recordFailure(username);
      console.warn(`loginAction: failed login attempt for "${username}"`);
      return { ok: false, error: "Invalid credentials" };
    }
    failedLogins.delete(username);

    const user = normalizeEmployeeUser(employee);
    const token = await signToken({ code: user.code, username: user.name_1 });

    (await cookies()).set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    return { ok: true, user };
  } catch (exc) {
    console.error("loginAction error:", exc);
    return { ok: false, error: "Internal server error" };
  }
}

export async function logoutAction(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getCurrentUserAction(): Promise<EmployeeUser | null> {
  const session = await getSession();
  if (!session?.code) return null;
  try {
    const employee = (await runQuery(
      `${EMPLOYEE_USER_SELECT}
         WHERE employee_code = $1
           AND COALESCE(employment_status, 'ACTIVE') = 'ACTIVE'`,
      [session.code],
      "one"
    )) as Record<string, unknown> | null;
    return employee ? normalizeEmployeeUser(employee) : null;
  } catch (exc) {
    console.error("getCurrentUserAction error:", exc);
    return null;
  }
}

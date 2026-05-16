"use server";

import { cookies } from "next/headers";
import { runQuery } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { EMPLOYEE_USER_SELECT, normalizeEmployeeUser, type EmployeeUser } from "@/lib/employee-user";
import { SESSION_COOKIE, SESSION_MAX_AGE, getSession } from "@/lib/session";

export type LoginResult = { ok: boolean; user?: EmployeeUser; error?: string };

export async function loginAction(usernameRaw: string, passwordRaw: string): Promise<LoginResult> {
  const username = String(usernameRaw || "").trim();
  const password = String(passwordRaw || "");
  if (!username || !password) return { ok: false, error: "Missing credentials" };

  try {
    const employee = (await runQuery(
      `${EMPLOYEE_USER_SELECT}
         WHERE employee_code = $1
           AND password = $2
           AND COALESCE(employment_status, 'ACTIVE') = 'ACTIVE'`,
      [username, password],
      "one"
    )) as Record<string, unknown> | null;

    if (!employee) return { ok: false, error: "Invalid credentials" };

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

import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/db";

// In-memory throttle: 10 lookups per IP per minute — this endpoint is
// unauthenticated and would otherwise allow enumerating the member table.
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 10;
const attempts = new Map<string, number[]>();

function isThrottled(key: string): boolean {
  const now = Date.now();
  const list = (attempts.get(key) || []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  attempts.set(key, list);
  if (attempts.size > 10000) attempts.clear();
  return list.length > MAX_PER_WINDOW;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isThrottled(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const data = await request.json().catch(() => ({}));
  const code = String(data.code || "").trim();
  const phone = String(data.phone || "").trim();
  if (!code && !phone) return NextResponse.json({ error: "Missing member code or phone" }, { status: 400 });
  // Require a minimally-specific identifier — blocks trivial short-string sweeps.
  if ((code && code.length < 4) || (!code && phone.length < 6)) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  let sql = `SELECT a.code, a.name_1, a.telephone, a.point_balance::int, b.discount_item
    FROM ar_customer a LEFT JOIN ar_customer_detail b ON b.ar_code = a.code WHERE reg_group = 'member'`;
  const params: unknown[] = [];
  if (code && phone) { sql += " AND a.code = $1 AND a.telephone = $2"; params.push(code, phone); }
  else if (code) { sql += " AND a.code = $1"; params.push(code); }
  else { sql += " AND a.telephone = $1"; params.push(phone); }
  sql += " LIMIT 1";
  try {
    const row = await runQuery(sql, params, "one");
    if (!row) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    return NextResponse.json({ member: row });
  } catch (exc) {
    console.error("Error member login:", exc);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

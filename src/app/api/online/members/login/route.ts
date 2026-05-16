import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/db";

export async function POST(request: NextRequest) {
  const data = await request.json().catch(() => ({}));
  const code = (data.code || "").trim();
  const phone = (data.phone || "").trim();
  if (!code && !phone) return NextResponse.json({ error: "Missing member code or phone" }, { status: 400 });
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

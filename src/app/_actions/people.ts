"use server";

import { runQuery } from "@/lib/db";

type Row = Record<string, unknown>;

export async function searchCustomersAction(query = ""): Promise<Row[]> {
  let sql = `
    SELECT a.code, a.name_1, a.telephone, a.point_balance::int, b.discount_item
    FROM ar_customer a
    LEFT JOIN ar_customer_detail b ON b.ar_code = a.code
    WHERE reg_group = 'member'
  `;
  const params: unknown[] = [];
  const q = (query || "").trim();
  if (q) {
    const like = `%${q.toLowerCase()}%`;
    sql += ` AND (lower(a.name_1) LIKE $1 OR a.code LIKE $2 OR a.telephone LIKE $3)`;
    params.push(like, like, like);
  }
  sql += " ORDER BY a.name_1 LIMIT 10";
  return (await runQuery(sql, params)) as Row[];
}

export async function searchStaffAction(query = ""): Promise<Row[]> {
  let sql = "SELECT code, name_1 FROM erp_user WHERE side = '200'";
  const params: unknown[] = [];
  const q = (query || "").trim();
  if (q) {
    sql += " AND (lower(code) LIKE $1 OR lower(name_1) LIKE $2)";
    const like = `%${q.toLowerCase()}%`;
    params.push(like, like);
  }
  sql += " ORDER BY name_1 LIMIT 20";
  return (await runQuery(sql, params)) as Row[];
}

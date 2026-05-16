"use server";

import { runQuery } from "@/lib/db";
import { ensureOnlineOrdersTable } from "@/lib/tables";

type Row = Record<string, unknown>;

export async function getOnlineOrdersAction(status = "pending", query = ""): Promise<Row[]> {
  await ensureOnlineOrdersTable();
  let sql = "SELECT order_no, status, customer_name, customer_phone, total, created_at FROM pos_online_orders WHERE 1=1";
  const params: unknown[] = [];
  let idx = 1;
  const trimmedStatus = (status || "").trim().toLowerCase();
  const trimmedQuery = (query || "").trim();
  if (trimmedStatus) { sql += ` AND status = $${idx++}`; params.push(trimmedStatus); }
  if (trimmedQuery) {
    const like = `%${trimmedQuery.toLowerCase()}%`;
    sql += ` AND (lower(order_no) LIKE $${idx} OR lower(customer_name) LIKE $${idx + 1} OR customer_phone LIKE $${idx + 2})`;
    params.push(like, like, like);
  }
  sql += " ORDER BY created_at DESC LIMIT 200";
  return (await runQuery(sql, params)) as Row[];
}

export async function getOnlineOrderAction(orderNo: string): Promise<Row | null> {
  await ensureOnlineOrdersTable();
  return (await runQuery("SELECT * FROM pos_online_orders WHERE order_no = $1", [orderNo], "one")) as Row | null;
}

export async function updateOnlineOrderStatusAction(orderNo: string, statusRaw: string): Promise<Row> {
  const status = (statusRaw || "").trim().toLowerCase();
  if (!["pending", "ready", "picked", "cancelled"].includes(status)) {
    throw new Error("Invalid status");
  }
  await ensureOnlineOrdersTable();
  const row = (await runQuery(
    "UPDATE pos_online_orders SET status=$1, updated_at=NOW() WHERE order_no=$2 RETURNING order_no, status, updated_at",
    [status, orderNo], "one"
  )) as Row | null;
  if (!row) throw new Error("Order not found");
  return row;
}

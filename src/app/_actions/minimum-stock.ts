"use server";

import { runQuery } from "@/lib/db";
import { ensureMinimumStockTable, ensureLineRecipientsTable } from "@/lib/tables";
import { sendLineMessage } from "@/lib/line";
import { formatQty } from "@/lib/utils";

type Row = Record<string, unknown>;

export async function listMinimumStockAction(
  query = "",
  options: { lowOnly?: boolean; includeInactive?: boolean; wh_code?: string; location_code?: string } = {}
): Promise<Row[]> {
  await ensureMinimumStockTable();
  const params: unknown[] = [];
  const whereClauses: string[] = [];
  let idx = 1;
  if (!options.includeInactive) whereClauses.push("m.active = TRUE");
  const whCode = (options.wh_code || "").trim();
  const locationCode = (options.location_code || "").trim();
  const trimmedQuery = (query || "").trim();
  if (whCode) { whereClauses.push(`m.wh_code = $${idx++}`); params.push(whCode); }
  if (locationCode) { whereClauses.push(`m.location_code = $${idx++}`); params.push(locationCode); }
  if (trimmedQuery) {
    const like = `%${trimmedQuery}%`;
    whereClauses.push(`(m.ic_code ILIKE $${idx} OR ic.name_1 ILIKE $${idx + 1})`);
    params.push(like, like);
    idx += 2;
  }
  if (options.lowOnly) whereClauses.push("COALESCE(s.balance_qty, 0) <= m.min_qty");
  const whereSql = whereClauses.length ? "WHERE " + whereClauses.join(" AND ") : "";
  return (await runQuery(`
    SELECT m.id, m.ic_code, m.wh_code, m.location_code, m.min_qty, m.note, m.active, m.updated_at,
      ic.name_1 AS item_name, s.balance_qty
    FROM pos_minimum_stock m
    LEFT JOIN ic_inventory ic ON ic.code = m.ic_code
    LEFT JOIN LATERAL (
      SELECT balance_qty FROM sml_ic_function_stock_balance_warehouse_location(
        '2099-12-31'::date, btrim(m.ic_code)::varchar, btrim(m.wh_code)::varchar, btrim(m.location_code)::varchar
      ) LIMIT 1
    ) s ON TRUE
    ${whereSql}
    ORDER BY (COALESCE(s.balance_qty, 0) <= m.min_qty) DESC, m.updated_at DESC, m.ic_code ASC;
  `, params)) as Row[];
}

export async function upsertMinimumStockAction(payload: Row): Promise<Row> {
  await ensureMinimumStockTable();
  const icCode = String(payload.ic_code || "").trim();
  if (!icCode) throw new Error("ic_code is required");
  const whCode = String(payload.wh_code || "1105").trim();
  const locationCode = String(payload.location_code || "110501").trim();
  if (!whCode || !locationCode) throw new Error("wh_code and location_code are required");
  let minQty = Number(payload.min_qty ?? 0);
  if (!isFinite(minQty) || minQty < 0) minQty = 0;
  const note = String(payload.note || "").trim();
  const active = payload.active !== false;
  return (await runQuery(
    `INSERT INTO pos_minimum_stock (ic_code, wh_code, location_code, min_qty, note, active, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (ic_code, wh_code, location_code)
     DO UPDATE SET min_qty = EXCLUDED.min_qty, note = EXCLUDED.note, active = EXCLUDED.active, updated_at = NOW()
     RETURNING id, ic_code, wh_code, location_code, min_qty, note, active, updated_at`,
    [icCode, whCode, locationCode, minQty, note, active],
    "one"
  )) as Row;
}

export async function deleteMinimumStockAction(id: number | string): Promise<{ success: true; id: unknown; ic_code: unknown }> {
  await ensureMinimumStockTable();
  const row = (await runQuery(
    "DELETE FROM pos_minimum_stock WHERE id = $1 RETURNING id, ic_code",
    [parseInt(String(id))],
    "one"
  )) as Row | null;
  if (!row) throw new Error("Item not found");
  return { success: true, id: row.id, ic_code: row.ic_code };
}

export async function notifyMinimumStockAction(payload: Row): Promise<{ success: true; items: number; sent: number }> {
  await ensureMinimumStockTable();
  await ensureLineRecipientsTable();
  const whCode = String(payload.wh_code || "").trim();
  const locationCode = String(payload.location_code || "").trim();
  if (!whCode || !locationCode) throw new Error("wh_code and location_code are required");
  const items = (await runQuery(
    `SELECT m.ic_code, m.min_qty, ic.name_1 AS item_name, s.balance_qty
       FROM pos_minimum_stock m
       LEFT JOIN ic_inventory ic ON ic.code = m.ic_code
       LEFT JOIN LATERAL (
         SELECT balance_qty FROM sml_ic_function_stock_balance_warehouse_location(
           '2099-12-31'::date, btrim(m.ic_code)::varchar, btrim(m.wh_code)::varchar, btrim(m.location_code)::varchar
         ) LIMIT 1
       ) s ON TRUE
      WHERE m.active = TRUE AND m.wh_code = $1 AND m.location_code = $2
        AND COALESCE(s.balance_qty, 0) <= m.min_qty
      ORDER BY m.min_qty DESC, m.ic_code ASC`,
    [whCode, locationCode]
  )) as Row[];
  if (!items.length) return { success: true, items: 0, sent: 0 };
  const recipients = (await runQuery(
    "SELECT line_user_id FROM pos_line_recipients WHERE active = TRUE"
  )) as { line_user_id?: string }[];
  if (!recipients.length) throw new Error("No active LINE recipients");
  const lines = ["ແຈ້ງເຕືອນ Minimum Stock", `ສາງ: ${whCode}/${locationCode}`, "ລາຍການ:"];
  for (const item of items.slice(0, 20)) {
    const name = (item.item_name as string) || (item.ic_code as string) || "-";
    lines.push(`- ${name} (${item.ic_code}) ${formatQty(item.balance_qty ?? 0)}/${formatQty(item.min_qty ?? 0)}`);
  }
  const message = lines.join("\n");
  let sent = 0;
  for (const rec of recipients) {
    if (!rec.line_user_id) continue;
    await sendLineMessage(rec.line_user_id, message);
    sent++;
  }
  return { success: true, items: items.length, sent };
}

"use server";

import { runQuery } from "@/lib/db";
import { ensureDailyClosureTable } from "@/lib/tables";

type Row = Record<string, unknown>;

type DailySummary = {
  total_all: number; total_cash: number; total_transfer: number; count_bills: number;
};

async function queryTodayUnsent(): Promise<{ summary: DailySummary; bills: Row[] }> {
  const sentRows = (await runQuery(
    `SELECT DISTINCT (elem->>'order_id') AS doc_no
       FROM pos_daily_closure, LATERAL jsonb_array_elements(COALESCE(payload->'bills','[]'::jsonb)) elem
      WHERE created_at::date = CURRENT_DATE`
  )) as { doc_no?: string }[];
  const sentDocNos = sentRows.filter((r) => r.doc_no).map((r) => r.doc_no!);
  let notInClause = "";
  const params: unknown[] = [];
  if (sentDocNos.length) {
    notInClause = `AND doc_no NOT IN (${sentDocNos.map((_, i) => `$${i + 1}`).join(",")})`;
    params.push(...sentDocNos);
  }
  const summaryRows = (await runQuery(
    `SELECT COALESCE(SUM(total_amount_2), 0) AS total_all,
        COALESCE(SUM(CASE WHEN payment_type = 'cash' THEN total_amount_2 ELSE 0 END), 0) AS total_cash,
        COALESCE(SUM(CASE WHEN payment_type = 'transfer' THEN total_amount_2 ELSE 0 END), 0) AS total_transfer,
        COUNT(*) AS count_bills
       FROM ic_trans WHERE doc_format_code = 'SPOS' AND doc_date = CURRENT_DATE ${notInClause}`,
    params
  )) as DailySummary[];
  const bills = (await runQuery(
    `SELECT doc_no AS order_id, doc_date, creator_code AS staff, total_amount_2 AS total, payment_type
       FROM ic_trans WHERE doc_format_code = 'SPOS' AND doc_date = CURRENT_DATE ${notInClause}
      ORDER BY doc_no DESC LIMIT 200`,
    params
  )) as Row[];
  const summary = summaryRows?.[0] ?? { total_all: 0, total_cash: 0, total_transfer: 0, count_bills: 0 };
  return { summary, bills: bills || [] };
}

export async function getDailySummaryAction(): Promise<{ summary: DailySummary; bills: Row[] }> {
  return queryTodayUnsent();
}

export async function submitDailySummaryAction(payload: Row): Promise<{ success: true; id: unknown; created_at: unknown }> {
  await ensureDailyClosureTable();
  const cleanPayload = {
    summary: payload.summary || {},
    bills: Array.isArray(payload.bills) ? payload.bills : [],
    staff: payload.staff,
    staffCode: payload.staffCode,
    timestamp: payload.timestamp || new Date().toISOString(),
  };
  const row = (await runQuery(
    "INSERT INTO pos_daily_closure (payload) VALUES ($1) RETURNING id, created_at",
    [JSON.stringify(cleanPayload)], "one"
  )) as Row;
  return { success: true, id: row.id, created_at: row.created_at };
}

function convertDecimals(obj: unknown): unknown {
  if (obj && typeof obj === "object" && !Array.isArray(obj) && !(obj instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) result[k] = convertDecimals(v);
    return result;
  }
  if (Array.isArray(obj)) return obj.map(convertDecimals);
  if (obj instanceof Date) return obj.toISOString();
  return obj;
}

export async function commitDailySummaryAction(data: Row): Promise<Row> {
  const { summary, bills } = await queryTodayUnsent();
  const payload = {
    summary: convertDecimals(summary),
    bills: convertDecimals(bills),
    recipient: data.recipient,
    staff: data.staff,
    staffCode: data.staffCode,
    timestamp: new Date().toISOString(),
  };
  await ensureDailyClosureTable();
  await runQuery("INSERT INTO pos_daily_closure (payload) VALUES ($1)", [JSON.stringify(payload)], "none");
  return payload as Row;
}

"use server";

import { runQuery } from "@/lib/db";
import { ensureDailyClosureTable } from "@/lib/tables";
import { requireSession } from "@/lib/session";

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
    notInClause = `AND t.doc_no NOT IN (${sentDocNos.map((_, i) => `$${i + 1}`).join(",")})`;
    params.push(...sentDocNos);
  }
  // ic_trans has no payment_type column — derive it from cb_trans (transfer bills have tranfer_amount > 0).
  const paymentJoin = `LEFT JOIN (
      SELECT doc_no, MAX(COALESCE(tranfer_amount, 0)) AS transfer_amt
        FROM cb_trans
       WHERE trans_flag = 44 AND doc_format_code = 'SPOS'
       GROUP BY doc_no
    ) cb ON cb.doc_no = t.doc_no`;
  const paymentTypeSql = `CASE WHEN cb.transfer_amt > 0 THEN 'transfer' WHEN cb.doc_no IS NOT NULL THEN 'cash' END`;
  const summaryRows = (await runQuery(
    `SELECT COALESCE(SUM(t.total_amount_2), 0) AS total_all,
        COALESCE(SUM(CASE WHEN ${paymentTypeSql} = 'cash' THEN t.total_amount_2 ELSE 0 END), 0) AS total_cash,
        COALESCE(SUM(CASE WHEN ${paymentTypeSql} = 'transfer' THEN t.total_amount_2 ELSE 0 END), 0) AS total_transfer,
        COUNT(*) AS count_bills
       FROM ic_trans t ${paymentJoin}
      WHERE t.doc_format_code = 'SPOS' AND t.doc_date = CURRENT_DATE ${notInClause}`,
    params
  )) as DailySummary[];
  const bills = (await runQuery(
    `SELECT t.doc_no AS order_id, t.doc_date, t.creator_code AS staff, t.total_amount_2 AS total,
            ${paymentTypeSql} AS payment_type
       FROM ic_trans t ${paymentJoin}
      WHERE t.doc_format_code = 'SPOS' AND t.doc_date = CURRENT_DATE ${notInClause}
      ORDER BY t.doc_no DESC LIMIT 200`,
    params
  )) as Row[];
  const summary = summaryRows?.[0] ?? { total_all: 0, total_cash: 0, total_transfer: 0, count_bills: 0 };
  return { summary, bills: bills || [] };
}

export async function getDailySummaryAction(): Promise<{ summary: DailySummary; bills: Row[] }> {
  await requireSession();
  return queryTodayUnsent();
}

export type DailyClosureEntry = {
  id: number;
  created_at: string;
  staff: string;
  recipient: string;
  total_all: number;
  count_bills: number;
};

export async function listDailyClosuresAction(limit = 30): Promise<DailyClosureEntry[]> {
  await requireSession();
  await ensureDailyClosureTable();
  const rows = (await runQuery(
    `SELECT id, created_at,
            COALESCE(payload->>'staff', payload->>'staffCode', '') AS staff,
            COALESCE(payload->>'recipient', '') AS recipient,
            COALESCE((payload->'summary'->>'total_all')::numeric, 0) AS total_all,
            COALESCE((payload->'summary'->>'count_bills')::numeric, jsonb_array_length(COALESCE(payload->'bills', '[]'::jsonb)), 0) AS count_bills
       FROM pos_daily_closure
      ORDER BY created_at DESC
      LIMIT $1`,
    [Math.min(Math.max(Number(limit) || 30, 1), 200)]
  )) as Row[];
  return (rows || []).map((r) => ({
    id: Number(r.id),
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at || ""),
    staff: String(r.staff || ""),
    recipient: String(r.recipient || ""),
    total_all: Number(r.total_all) || 0,
    count_bills: Number(r.count_bills) || 0,
  }));
}

export async function submitDailySummaryAction(payload: Row): Promise<{ success: true; id: unknown; created_at: unknown }> {
  await requireSession();
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
  await requireSession();
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

"use server";

import { runQuery } from "@/lib/db";
import { requireSession } from "@/lib/session";

type Row = Record<string, unknown>;

export type SalesReportRange = { from: string; to: string };

export type SalesReport = {
  summary: {
    total_all: number;
    total_cash: number;
    total_transfer: number;
    count_bills: number;
    avg_bill: number;
    total_discount: number;
    count_customers: number;
    total_cost: number;
    total_profit: number;
    margin_pct: number;
    member_total: number;
    member_bills: number;
  };
  prev: {
    from: string;
    to: string;
    total_all: number;
    count_bills: number;
    avg_bill: number;
  };
  baht: {
    thb_received: number;
    thb_bills: number;
    rate: number | null;
    total_all_thb: number | null;
  };
  byDay: { day: string; total: number; bills: number }[];
  byHour: { hour: string; total: number; bills: number }[];
  topProducts: { item_code: string; item_name: string; unit: string; qty: number; total: number }[];
  byStaff: { staff_code: string; staff_name: string; bills: number; total: number }[];
  recentBills: Row[];
};

const BILL_FILTER = `t.doc_format_code = 'SPOS' AND t.trans_flag = 44 AND COALESCE(t.is_cancel, 0) = 0 AND t.doc_date BETWEEN $1 AND $2`;

/**
 * ic_trans has no payment_type column — payment method is derived from cb_trans:
 * a transfer bill has tranfer_amount > 0 (column name is misspelled in the ERP schema),
 * a cash bill has a cb_trans row without it. Aggregated per doc_no so duplicate
 * cb_trans rows can never fan out the ic_trans join.
 */
const PAYMENT_JOIN = `LEFT JOIN (
    SELECT doc_no, MAX(COALESCE(tranfer_amount, 0)) AS transfer_amt
      FROM cb_trans
     WHERE trans_flag = 44 AND doc_format_code = 'SPOS'
     GROUP BY doc_no
  ) cb ON cb.doc_no = t.doc_no`;

const PAYMENT_TYPE_SQL = `CASE
    WHEN cb.transfer_amt > 0 THEN 'transfer'
    WHEN cb.doc_no IS NOT NULL THEN 'cash'
  END`;

function num(v: unknown): number {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

/** ISO date (YYYY-MM-DD) guard — the range is interpolated into nothing, but keep params clean. */
function safeDate(s: string, fallback: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) ? s : fallback;
}

/** Run a labelled query so a failure names the exact query in the server log. */
async function q(label: string, sql: string, params: unknown[], mode?: "one"): Promise<Row[] | Row | null> {
  try {
    return await runQuery(sql, params, mode);
  } catch (exc) {
    console.error(`getSalesReportAction: query "${label}" failed:`, exc);
    throw exc;
  }
}

export async function getSalesReportAction(range: SalesReportRange): Promise<SalesReport> {
  await requireSession();
  const today = new Date().toISOString().slice(0, 10);
  const from = safeDate(range?.from, today);
  const to = safeDate(range?.to, today);
  const params = [from, to];

  const [summaryRows, dayRows, hourRows, productRows, staffRows, billRows] = await Promise.all([
    q(
      "summary",
      `SELECT COALESCE(SUM(t.total_amount_2), 0) AS total_all,
              COALESCE(SUM(CASE WHEN ${PAYMENT_TYPE_SQL} = 'cash' THEN t.total_amount_2 ELSE 0 END), 0) AS total_cash,
              COALESCE(SUM(CASE WHEN ${PAYMENT_TYPE_SQL} = 'transfer' THEN t.total_amount_2 ELSE 0 END), 0) AS total_transfer,
              COUNT(*) AS count_bills,
              COUNT(DISTINCT t.cust_code) AS count_customers,
              COALESCE(SUM(CASE WHEN COALESCE(trim(t.cust_code), '') NOT IN ('', '01-2125') THEN t.total_amount_2 ELSE 0 END), 0) AS member_total,
              COUNT(*) FILTER (WHERE COALESCE(trim(t.cust_code), '') NOT IN ('', '01-2125')) AS member_bills
         FROM ic_trans t
         ${PAYMENT_JOIN}
        WHERE ${BILL_FILTER}`,
      params,
      "one"
    ),
    q(
      "by-day",
      `SELECT t.doc_date::text AS day,
              COALESCE(SUM(t.total_amount_2), 0) AS total,
              COUNT(*) AS bills
         FROM ic_trans t
        WHERE ${BILL_FILTER}
        GROUP BY t.doc_date
        ORDER BY t.doc_date`,
      params
    ),
    q(
      "by-hour",
      `SELECT substring(t.doc_time::text FROM 1 FOR 2) AS hour,
              COALESCE(SUM(t.total_amount_2), 0) AS total,
              COUNT(*) AS bills
         FROM ic_trans t
        WHERE ${BILL_FILTER} AND t.doc_time IS NOT NULL
        GROUP BY 1
        ORDER BY 1`,
      params
    ),
    q(
      "top-products",
      `SELECT d.item_code,
              MAX(d.item_name) AS item_name,
              MAX(d.unit_code) AS unit,
              COALESCE(SUM(d.qty), 0) AS qty,
              COALESCE(SUM(d.sum_amount), 0) AS total
         FROM ic_trans_detail d
         JOIN ic_trans t ON t.doc_no = d.doc_no
        WHERE ${BILL_FILTER} AND d.trans_flag = 44
        GROUP BY d.item_code
        ORDER BY total DESC
        LIMIT 10`,
      params
    ),
    q(
      "by-staff",
      `SELECT COALESCE(NULLIF(trim(t.sale_code), ''), t.creator_code) AS staff_code,
              MAX(COALESCE(e.fullname_lo, e.fullname_en, e.nickname)) AS staff_name,
              COUNT(*) AS bills,
              COALESCE(SUM(t.total_amount_2), 0) AS total
         FROM ic_trans t
         LEFT JOIN odg_employee e ON trim(e.employee_code) = COALESCE(NULLIF(trim(t.sale_code), ''), t.creator_code)
        WHERE ${BILL_FILTER}
        GROUP BY 1
        ORDER BY total DESC
        LIMIT 10`,
      params
    ),
    q(
      "recent-bills",
      `SELECT t.doc_no, t.doc_date::text AS doc_date, t.doc_time::text AS doc_time, t.cust_code,
              c.name_1 AS customer_name, t.total_amount_2 AS total,
              ${PAYMENT_TYPE_SQL} AS payment_type,
              COALESCE(NULLIF(trim(t.sale_code), ''), t.creator_code) AS staff_code,
              (SELECT COUNT(*) FROM ic_trans_detail d WHERE d.doc_no = t.doc_no) AS item_count
         FROM ic_trans t
         LEFT JOIN ar_customer c ON c.code = t.cust_code
         ${PAYMENT_JOIN}
        WHERE ${BILL_FILTER}
        ORDER BY t.doc_date DESC, t.doc_no DESC
        LIMIT 100`,
      params
    ),
  ]);

  // sum_of_cost is the TOTAL line cost (SML convention; saveBillAction writes avg cost x qty,
  // and the ERP's cost recalculation writes back the same shape).
  // Revenue here is detail-line revenue (after discount).
  const costRow = (await q(
    "discount-and-cost",
    `SELECT COALESCE(SUM(d.discount_amount), 0) AS total_discount,
            COALESCE(SUM(d.sum_amount), 0) AS detail_revenue,
            COALESCE(SUM(COALESCE(d.sum_of_cost, 0)), 0) AS total_cost
       FROM ic_trans_detail d
       JOIN ic_trans t ON t.doc_no = d.doc_no
      WHERE ${BILL_FILTER} AND d.trans_flag = 44`,
    params,
    "one"
  )) as Row | null;

  // Previous window of the same length, immediately before `from` — for trend deltas.
  const fromDate = new Date(`${from}T00:00:00Z`);
  const toDate = new Date(`${to}T00:00:00Z`);
  const lenDays = Math.max(Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1, 1);
  const prevToDate = new Date(fromDate.getTime() - 86400000);
  const prevFromDate = new Date(prevToDate.getTime() - (lenDays - 1) * 86400000);
  const prevFrom = prevFromDate.toISOString().slice(0, 10);
  const prevTo = prevToDate.toISOString().slice(0, 10);
  const prevRow = (await q(
    "prev-summary",
    `SELECT COALESCE(SUM(t.total_amount_2), 0) AS total_all, COUNT(*) AS count_bills
       FROM ic_trans t
      WHERE ${BILL_FILTER}`,
    [prevFrom, prevTo],
    "one"
  )) as Row | null;

  // THB: cb_trans.cash_amount is the baht a bill was settled with (the ERP's
  // base currency), so any non-zero value is a baht payment.
  const bahtRow = (await q(
    "baht-received",
    `SELECT COALESCE(SUM(cb2.cash_amount), 0) AS thb_received, COUNT(*) AS thb_bills
       FROM cb_trans cb2
       JOIN ic_trans t ON t.doc_no = cb2.doc_no
      WHERE ${BILL_FILTER}
        AND cb2.doc_format_code = 'SPOS' AND cb2.trans_flag = 44 AND COALESCE(cb2.cash_amount, 0) <> 0`,
    params,
    "one"
  )) as Row | null;

  // Latest THB rate (LAK per ฿). pos_fx_rates only exists after the first baht sale — treat a
  // missing table as "no rate yet" instead of failing the whole report.
  let bahtRate: number | null = null;
  try {
    const rateRow = (await runQuery(
      `SELECT rate FROM pos_fx_rates ORDER BY created_at DESC LIMIT 1`,
      [],
      "one"
    )) as Row | null;
    const r = Number(rateRow?.rate);
    bahtRate = isFinite(r) && r > 0 ? r : null;
  } catch {
    bahtRate = null;
  }

  const s = (summaryRows as Row | null) ?? {};
  const countBills = num(s.count_bills);
  const totalAll = num(s.total_all);
  const detailRevenue = num(costRow?.detail_revenue);
  const totalCost = num(costRow?.total_cost);
  const totalProfit = detailRevenue - totalCost;
  const prevTotal = num(prevRow?.total_all);
  const prevBills = num(prevRow?.count_bills);

  return {
    summary: {
      total_all: totalAll,
      total_cash: num(s.total_cash),
      total_transfer: num(s.total_transfer),
      count_bills: countBills,
      avg_bill: countBills > 0 ? Math.round(totalAll / countBills) : 0,
      total_discount: num(costRow?.total_discount),
      count_customers: num(s.count_customers),
      total_cost: totalCost,
      total_profit: totalProfit,
      margin_pct: detailRevenue > 0 ? Math.round((totalProfit / detailRevenue) * 1000) / 10 : 0,
      member_total: num(s.member_total),
      member_bills: num(s.member_bills),
    },
    prev: {
      from: prevFrom,
      to: prevTo,
      total_all: prevTotal,
      count_bills: prevBills,
      avg_bill: prevBills > 0 ? Math.round(prevTotal / prevBills) : 0,
    },
    baht: {
      thb_received: num(bahtRow?.thb_received),
      thb_bills: num(bahtRow?.thb_bills),
      rate: bahtRate,
      total_all_thb: bahtRate ? Math.round((totalAll / bahtRate) * 100) / 100 : null,
    },
    byDay: ((dayRows as Row[]) || []).map((r) => ({ day: String(r.day), total: num(r.total), bills: num(r.bills) })),
    byHour: ((hourRows as Row[]) || []).map((r) => ({ hour: String(r.hour), total: num(r.total), bills: num(r.bills) })),
    topProducts: ((productRows as Row[]) || []).map((r) => ({
      item_code: String(r.item_code || ""),
      item_name: String(r.item_name || r.item_code || ""),
      unit: String(r.unit || ""),
      qty: num(r.qty),
      total: num(r.total),
    })),
    byStaff: ((staffRows as Row[]) || []).map((r) => ({
      staff_code: String(r.staff_code || ""),
      staff_name: String(r.staff_name || r.staff_code || ""),
      bills: num(r.bills),
      total: num(r.total),
    })),
    recentBills: ((billRows as Row[]) || []),
  };
}

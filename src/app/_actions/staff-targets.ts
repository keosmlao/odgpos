"use server";

import { runQuery } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { ensureStaffSalesTargetTable } from "@/lib/tables";

type Row = Record<string, unknown>;

export type StaffTargetRow = {
  staff_code: string;
  staff_name: string;
  /** Monthly target in THB (฿). */
  target_amount: number;
  /** Actual POS sales for the month in LAK (₭). */
  actual_amount: number;
  /** Actual converted to THB with the returned rate (null rate → 0). */
  actual_thb: number;
  bills: number;
  /** Achievement % of the THB target. */
  pct: number;
};

export type StaffTargets = {
  month: string;
  /** Latest LAK-per-THB rate (from pos_fx_rates), null if none recorded yet. */
  rate: number | null;
  rows: StaffTargetRow[];
  staffOptions: { code: string; name: string }[];
};

function num(v: unknown): number {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

function safeMonth(s: string): string {
  return /^\d{4}-\d{2}$/.test(String(s || "")) ? s : new Date().toISOString().slice(0, 7);
}

export async function getStaffTargetsAction(monthRaw: string, rateOverride?: number): Promise<StaffTargets> {
  await requireSession();
  await ensureStaffSalesTargetTable();
  const month = safeMonth(monthRaw);
  const from = `${month}-01`;

  // Latest LAK-per-THB rate; the table only exists after the first baht sale.
  let rate: number | null = null;
  if (rateOverride && isFinite(rateOverride) && rateOverride > 0) {
    rate = rateOverride;
  } else {
    try {
      const rateRow = (await runQuery(
        "SELECT rate FROM pos_fx_rates ORDER BY created_at DESC LIMIT 1",
        [],
        "one"
      )) as Row | null;
      const r = num(rateRow?.rate);
      rate = r > 0 ? r : null;
    } catch {
      rate = null;
    }
  }

  const [targetRows, actualRows, staffRows] = await Promise.all([
    runQuery(
      "SELECT trim(staff_code) AS staff_code, target_amount FROM pos_staff_sales_target WHERE month = $1",
      [month]
    ) as Promise<Row[]>,
    // Monthly POS sales per staff; sale_code falls back to creator_code like the sales report.
    runQuery(
      `SELECT COALESCE(NULLIF(trim(t.sale_code), ''), t.creator_code) AS staff_code,
              COALESCE(SUM(t.total_amount_2), 0) AS actual_amount,
              COUNT(*) AS bills
         FROM ic_trans t
        WHERE t.doc_format_code = 'SPOS' AND t.trans_flag = 44
          AND t.doc_date >= $1::date AND t.doc_date < ($1::date + INTERVAL '1 month')
        GROUP BY 1`,
      [from]
    ) as Promise<Row[]>,
    runQuery(
      `SELECT trim(employee_code) AS code,
              COALESCE(NULLIF(trim(fullname_lo), ''), NULLIF(trim(nickname), ''), NULLIF(trim(fullname_en), ''), trim(employee_code)) AS name
         FROM odg_employee
        WHERE COALESCE(employment_status, 'ACTIVE') = 'ACTIVE'
        ORDER BY name`
    ) as Promise<Row[]>,
  ]);

  const nameMap: Record<string, string> = {};
  for (const s of staffRows || []) nameMap[String(s.code)] = String(s.name || s.code);

  const merged: Record<string, StaffTargetRow> = {};
  for (const t of targetRows || []) {
    const code = String(t.staff_code || "").trim();
    if (!code) continue;
    merged[code] = {
      staff_code: code,
      staff_name: nameMap[code] || code,
      target_amount: num(t.target_amount),
      actual_amount: 0,
      actual_thb: 0,
      bills: 0,
      pct: 0,
    };
  }
  for (const a of actualRows || []) {
    const code = String(a.staff_code || "").trim();
    if (!code) continue;
    if (!merged[code]) {
      merged[code] = {
        staff_code: code,
        staff_name: nameMap[code] || code,
        target_amount: 0,
        actual_amount: 0,
        actual_thb: 0,
        bills: 0,
        pct: 0,
      };
    }
    merged[code].actual_amount = num(a.actual_amount);
    merged[code].bills = num(a.bills);
  }

  const rows = Object.values(merged).map((r) => {
    const actualThb = rate ? Math.round((r.actual_amount / rate) * 100) / 100 : 0;
    return {
      ...r,
      actual_thb: actualThb,
      pct: r.target_amount > 0 && rate ? Math.round((actualThb / r.target_amount) * 1000) / 10 : 0,
    };
  });
  // Staff with a target first (by achievement), then the rest by sales.
  rows.sort((a, b) =>
    (b.target_amount > 0 ? 1 : 0) - (a.target_amount > 0 ? 1 : 0) ||
    b.pct - a.pct ||
    b.actual_amount - a.actual_amount
  );

  return {
    month,
    rate,
    rows,
    staffOptions: (staffRows || []).map((s) => ({ code: String(s.code), name: String(s.name || s.code) })),
  };
}

export type MonthlyTargetRow = {
  staff_code: string;
  staff_name: string;
  /** Monthly target (฿) for the month containing `to`. */
  target_thb: number;
  /** Actual sales in the selected range (฿ / ₭). */
  actual_thb: number;
  actual_lak: number;
  bills: number;
  /** actual vs monthly target, %. */
  ach_pct: number;
  /** Required ฿/day for the rest of the month to still hit the target. */
  req_per_day: number;
  /** Sum of this year's monthly targets up to and including the current month (฿). */
  ytd_target_thb: number;
  /** Sales since Jan 1 of the `to` year (฿). */
  ytd_actual_thb: number;
  ytd_pct: number;
};

export type MonthlyTargetReport = {
  from: string;
  to: string;
  rate: number | null;
  /** Remaining days in the month of `to`, including `to` itself. */
  days_left: number;
  rows: MonthlyTargetRow[];
  totals: {
    target_thb: number;
    actual_thb: number;
    actual_lak: number;
    bills: number;
    ach_pct: number;
    req_per_day: number;
    ytd_target_thb: number;
    ytd_actual_thb: number;
    ytd_pct: number;
  };
};

function safeDate(s: string, fallback: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) ? s : fallback;
}

export async function getMonthlyTargetReportAction(
  range: { from: string; to: string },
  rateOverride?: number
): Promise<MonthlyTargetReport> {
  await requireSession();
  await ensureStaffSalesTargetTable();
  const today = new Date().toISOString().slice(0, 10);
  const from = safeDate(range?.from, today);
  const to = safeDate(range?.to, today);
  const month = to.slice(0, 7);
  const monthStart = `${month}-01`;
  const year = to.slice(0, 4);
  const yearStart = `${year}-01-01`;
  const lowerBound = from < yearStart ? from : yearStart;

  // Days remaining in the month of `to`, including `to`.
  const [yy, mm, dd] = to.split("-").map(Number);
  const daysInMonth = new Date(yy, mm, 0).getDate();
  const daysLeft = Math.max(daysInMonth - dd + 1, 1);

  let rate: number | null = null;
  if (rateOverride && isFinite(rateOverride) && rateOverride > 0) {
    rate = rateOverride;
  } else {
    try {
      const rateRow = (await runQuery(
        "SELECT rate FROM pos_fx_rates ORDER BY created_at DESC LIMIT 1",
        [],
        "one"
      )) as Row | null;
      const r = num(rateRow?.rate);
      rate = r > 0 ? r : null;
    } catch {
      rate = null;
    }
  }
  const toThb = (lak: number) => (rate ? Math.round((lak / rate) * 100) / 100 : 0);

  const [targetRows, salesRows, staffRows] = await Promise.all([
    // This year's targets: current-month value + YTD sum per staff.
    runQuery(
      `SELECT trim(staff_code) AS staff_code,
              COALESCE(SUM(target_amount) FILTER (WHERE month = $1), 0) AS month_target,
              COALESCE(SUM(target_amount) FILTER (WHERE month <= $1), 0) AS ytd_target
         FROM pos_staff_sales_target
        WHERE month LIKE $2
        GROUP BY trim(staff_code)`,
      [month, `${year}-%`]
    ) as Promise<Row[]>,
    runQuery(
      `SELECT COALESCE(NULLIF(trim(t.sale_code), ''), t.creator_code) AS staff_code,
              COALESCE(SUM(t.total_amount_2) FILTER (WHERE t.doc_date BETWEEN $2 AND $3), 0) AS range_lak,
              COUNT(*) FILTER (WHERE t.doc_date BETWEEN $2 AND $3) AS bills,
              COALESCE(SUM(t.total_amount_2) FILTER (WHERE t.doc_date BETWEEN $4 AND $3), 0) AS mtd_lak,
              COALESCE(SUM(t.total_amount_2) FILTER (WHERE t.doc_date BETWEEN $5 AND $3), 0) AS ytd_lak
         FROM ic_trans t
        WHERE t.doc_format_code = 'SPOS' AND t.trans_flag = 44
          AND t.doc_date BETWEEN $1 AND $3
        GROUP BY 1`,
      [lowerBound, from, to, monthStart, yearStart]
    ) as Promise<Row[]>,
    runQuery(
      `SELECT trim(employee_code) AS code,
              COALESCE(NULLIF(trim(fullname_lo), ''), NULLIF(trim(nickname), ''), NULLIF(trim(fullname_en), ''), trim(employee_code)) AS name
         FROM odg_employee
        WHERE COALESCE(employment_status, 'ACTIVE') = 'ACTIVE'`
    ) as Promise<Row[]>,
  ]);

  const nameMap: Record<string, string> = {};
  for (const s of staffRows || []) nameMap[String(s.code)] = String(s.name || s.code);

  type Acc = {
    target: number; ytdTarget: number;
    rangeLak: number; mtdLak: number; ytdLak: number; bills: number;
  };
  const acc: Record<string, Acc> = {};
  const touch = (code: string): Acc => {
    if (!acc[code]) acc[code] = { target: 0, ytdTarget: 0, rangeLak: 0, mtdLak: 0, ytdLak: 0, bills: 0 };
    return acc[code];
  };
  for (const t of targetRows || []) {
    const code = String(t.staff_code || "").trim();
    if (!code) continue;
    const a = touch(code);
    a.target = num(t.month_target);
    a.ytdTarget = num(t.ytd_target);
  }
  for (const s of salesRows || []) {
    const code = String(s.staff_code || "").trim();
    if (!code) continue;
    const a = touch(code);
    a.rangeLak = num(s.range_lak);
    a.mtdLak = num(s.mtd_lak);
    a.ytdLak = num(s.ytd_lak);
    a.bills = num(s.bills);
  }

  const rows: MonthlyTargetRow[] = Object.entries(acc)
    .filter(([, a]) => a.target > 0 || a.rangeLak > 0 || a.ytdTarget > 0)
    .map(([code, a]) => {
      const actualThb = toThb(a.rangeLak);
      const mtdThb = toThb(a.mtdLak);
      const ytdActualThb = toThb(a.ytdLak);
      return {
        staff_code: code,
        staff_name: nameMap[code] || code,
        target_thb: a.target,
        actual_thb: actualThb,
        actual_lak: a.rangeLak,
        bills: a.bills,
        ach_pct: a.target > 0 && rate ? Math.round((actualThb / a.target) * 1000) / 10 : 0,
        req_per_day: a.target > 0 && rate ? Math.max(Math.round((a.target - mtdThb) / daysLeft), 0) : 0,
        ytd_target_thb: a.ytdTarget,
        ytd_actual_thb: ytdActualThb,
        ytd_pct: a.ytdTarget > 0 && rate ? Math.round((ytdActualThb / a.ytdTarget) * 100) : 0,
      };
    });
  rows.sort((a, b) => b.actual_thb - a.actual_thb || b.target_thb - a.target_thb);

  const sum = (f: (r: MonthlyTargetRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  const totalTarget = sum((r) => r.target_thb);
  const totalActualThb = Math.round(sum((r) => r.actual_thb) * 100) / 100;
  const totalYtdTarget = sum((r) => r.ytd_target_thb);
  const totalYtdActual = Math.round(sum((r) => r.ytd_actual_thb) * 100) / 100;

  return {
    from,
    to,
    rate,
    days_left: daysLeft,
    rows,
    totals: {
      target_thb: totalTarget,
      actual_thb: totalActualThb,
      actual_lak: sum((r) => r.actual_lak),
      bills: sum((r) => r.bills),
      ach_pct: totalTarget > 0 && rate ? Math.round((totalActualThb / totalTarget) * 1000) / 10 : 0,
      req_per_day: sum((r) => r.req_per_day),
      ytd_target_thb: totalYtdTarget,
      ytd_actual_thb: totalYtdActual,
      ytd_pct: totalYtdTarget > 0 && rate ? Math.round((totalYtdActual / totalYtdTarget) * 100) : 0,
    },
  };
}

export async function upsertStaffTargetAction(payload: {
  staff_code: string;
  month: string;
  target_amount: number;
}): Promise<{ success: true }> {
  await requireSession();
  await ensureStaffSalesTargetTable();
  const staffCode = String(payload.staff_code || "").trim();
  if (!staffCode) throw new Error("staff_code is required");
  const month = safeMonth(payload.month);
  let target = num(payload.target_amount);
  if (target < 0) target = 0;
  await runQuery(
    `INSERT INTO pos_staff_sales_target (staff_code, month, target_amount, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (staff_code, month)
     DO UPDATE SET target_amount = EXCLUDED.target_amount, updated_at = NOW()`,
    [staffCode, month, target],
    "none"
  );
  return { success: true };
}

export async function deleteStaffTargetAction(staffCode: string, monthRaw: string): Promise<{ success: true }> {
  await requireSession();
  await ensureStaffSalesTargetTable();
  await runQuery(
    "DELETE FROM pos_staff_sales_target WHERE trim(staff_code) = $1 AND month = $2",
    [String(staffCode || "").trim(), safeMonth(monthRaw)],
    "none"
  );
  return { success: true };
}

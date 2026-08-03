"use server";

import { runQuery } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { ensureMinimumStockTable } from "@/lib/tables";

type Row = Record<string, unknown>;

export type StockReportRange = { from: string; to: string };

export type StockMovementItem = {
  item_code: string;
  item_name: string;
  unit: string;
  qty_in: number;
  qty_out: number;
  net: number;
  docs: number;
  balance_qty: number | null;
};

export type RestockItem = {
  ic_code: string;
  item_name: string;
  balance_qty: number;
  out_30d: number;
  days_left: number | null;
  suggest_qty: number;
  below_min: boolean;
  min_qty: number | null;
};

export type OverstockItem = {
  ic_code: string;
  item_name: string;
  balance_qty: number;
  out_90d: number;
  days_of_stock: number;
  stock_value: number;
};

export type DeadStockItem = {
  ic_code: string;
  item_name: string;
  balance_qty: number;
  last_move: string | null;
  stock_value: number;
};

export type StockReport = {
  summary: {
    total_in: number;
    total_out: number;
    net: number;
    items_moved: number;
    docs: number;
  };
  byDay: { day: string; qty_in: number; qty_out: number }[];
  byFlag: { trans_flag: number; direction: "in" | "out"; qty: number; docs: number }[];
  items: StockMovementItem[];
};

/** Range-independent — loaded separately so changing the date range stays fast. */
export type StockRecommendations = {
  restock: RestockItem[];
  overstock: OverstockItem[];
  dead: DeadStockItem[];
};

export type StockOnHandItem = {
  ic_code: string;
  item_name: string;
  unit: string;
  balance_qty: number;
  avg_cost: number;
  stock_value: number;
};

export type StockOnHand = {
  summary: { sku_count: number; total_qty: number; total_value: number };
  items: StockOnHandItem[];
};

/** Days of coverage below which an item is flagged "restock now". */
const RESTOCK_DAYS = 7;
/** Restock suggestion tops the item back up to this many days of sales. */
const COVER_DAYS = 30;
/** Days of coverage above which stocked items are flagged "do not stock more". */
const OVERSTOCK_DAYS = 90;
/** No outbound movement for this long (with stock on hand) = dead stock. */
const DEAD_DAYS = 90;

function num(v: unknown): number {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

function safeDate(s: string, fallback: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) ? s : fallback;
}

async function q(label: string, sql: string, params: unknown[], mode?: "one"): Promise<Row[] | Row | null> {
  try {
    return await runQuery(sql, params, mode);
  } catch (exc) {
    console.error(`getStockReportAction: query "${label}" failed:`, exc);
    throw exc;
  }
}

/** Items with stock on hand (balance > 0) across the whole warehouse. */
export async function getStockOnHandAction(
  options: { wh_code?: string; location_code?: string } = {}
): Promise<StockOnHand> {
  await requireSession();
  const whCode = (options.wh_code || "1105").trim();
  // Empty location = every location in the warehouse.
  const locationCode = (options.location_code ?? "").trim();

  const rows = (await q(
    "stock-on-hand",
    `SELECT btrim(a.ic_code) AS ic_code,
            ic.name_1 AS item_name,
            COALESCE(ic.unit_standard, '') AS unit,
            a.balance_qty,
            COALESCE(ic.average_cost, 0) AS avg_cost,
            round(a.balance_qty * COALESCE(ic.average_cost, 0)) AS stock_value
       FROM sml_ic_function_stock_balance_location_warehouse_cost('2099-12-31', '', $1, $2) a
       LEFT JOIN ic_inventory ic ON ic.code = a.ic_code
      WHERE a.balance_qty > 0 AND btrim(a.ic_code) NOT LIKE '9%'
      ORDER BY stock_value DESC, a.ic_code`,
    [whCode, locationCode]
  )) as Row[];

  const items: StockOnHandItem[] = (rows || []).map((r) => ({
    ic_code: String(r.ic_code || ""),
    item_name: String(r.item_name || r.ic_code || ""),
    unit: String(r.unit || ""),
    balance_qty: num(r.balance_qty),
    avg_cost: num(r.avg_cost),
    stock_value: num(r.stock_value),
  }));

  return {
    summary: {
      sku_count: items.length,
      total_qty: Math.round(items.reduce((s, it) => s + it.balance_qty, 0) * 100) / 100,
      total_value: items.reduce((s, it) => s + it.stock_value, 0),
    },
    items,
  };
}

export async function getStockReportAction(
  range: StockReportRange,
  options: { wh_code?: string; location_code?: string } = {}
): Promise<StockReport> {
  await requireSession();
  const today = new Date().toISOString().slice(0, 10);
  const from = safeDate(range?.from, today);
  const to = safeDate(range?.to, today);
  const whCode = (options.wh_code || "1105").trim();
  // Empty location = every location in the warehouse.
  const locationCode = (options.location_code ?? "").trim();

  // calc_flag: 1 = stock in, -1 = stock out, 0 = no stock effect (skipped).
  // Item codes starting with 9 are internal (services, office supplies, event stock) — not POS merchandise.
  const MOVE_FILTER = `d.calc_flag IN (1, -1) AND d.wh_code = $3 AND d.doc_date BETWEEN $1 AND $2
    AND btrim(d.item_code) NOT LIKE '9%'`;
  const params = [from, to, whCode];

  const [summaryRow, dayRows, flagRows, itemRows] = await Promise.all([
    q(
      "summary",
      `SELECT COALESCE(SUM(CASE WHEN d.calc_flag = 1 THEN d.qty ELSE 0 END), 0) AS total_in,
              COALESCE(SUM(CASE WHEN d.calc_flag = -1 THEN d.qty ELSE 0 END), 0) AS total_out,
              COUNT(DISTINCT d.item_code) AS items_moved,
              COUNT(DISTINCT d.doc_no) AS docs
         FROM ic_trans_detail d
        WHERE ${MOVE_FILTER}`,
      params,
      "one"
    ),
    q(
      "by-day",
      `SELECT d.doc_date::text AS day,
              COALESCE(SUM(CASE WHEN d.calc_flag = 1 THEN d.qty ELSE 0 END), 0) AS qty_in,
              COALESCE(SUM(CASE WHEN d.calc_flag = -1 THEN d.qty ELSE 0 END), 0) AS qty_out
         FROM ic_trans_detail d
        WHERE ${MOVE_FILTER}
        GROUP BY d.doc_date
        ORDER BY d.doc_date`,
      params
    ),
    q(
      "by-flag",
      `SELECT d.trans_flag, d.calc_flag,
              COALESCE(SUM(d.qty), 0) AS qty,
              COUNT(DISTINCT d.doc_no) AS docs
         FROM ic_trans_detail d
        WHERE ${MOVE_FILTER}
        GROUP BY d.trans_flag, d.calc_flag
        ORDER BY qty DESC`,
      params
    ),
    q(
      "items",
      `SELECT m.*, b.balance_qty
         FROM (
           SELECT btrim(d.item_code) AS item_code,
                  MAX(d.item_name) AS item_name,
                  MAX(d.unit_code) AS unit,
                  COALESCE(SUM(CASE WHEN d.calc_flag = 1 THEN d.qty ELSE 0 END), 0) AS qty_in,
                  COALESCE(SUM(CASE WHEN d.calc_flag = -1 THEN d.qty ELSE 0 END), 0) AS qty_out,
                  COUNT(DISTINCT d.doc_no) AS docs
             FROM ic_trans_detail d
            WHERE ${MOVE_FILTER}
            GROUP BY btrim(d.item_code)
            ORDER BY qty_out DESC, qty_in DESC
            LIMIT 300
         ) m
         LEFT JOIN (
           -- One whole-warehouse balance scan instead of a function call per item.
           SELECT btrim(ic_code) AS ic_code, SUM(balance_qty) AS balance_qty
             FROM sml_ic_function_stock_balance_location_warehouse_cost('2099-12-31', '', $3, $4)
            GROUP BY btrim(ic_code)
         ) b ON b.ic_code = m.item_code`,
      [...params, locationCode]
    ),
  ]);

  const s = (summaryRow as Row | null) ?? {};
  return {
    summary: {
      total_in: num(s.total_in),
      total_out: num(s.total_out),
      net: num(s.total_in) - num(s.total_out),
      items_moved: num(s.items_moved),
      docs: num(s.docs),
    },
    byDay: (((dayRows as Row[]) || [])).map((r) => ({
      day: String(r.day),
      qty_in: num(r.qty_in),
      qty_out: num(r.qty_out),
    })),
    byFlag: (((flagRows as Row[]) || [])).map((r) => ({
      trans_flag: num(r.trans_flag),
      direction: num(r.calc_flag) === 1 ? ("in" as const) : ("out" as const),
      qty: num(r.qty),
      docs: num(r.docs),
    })),
    items: (((itemRows as Row[]) || [])).map((r) => ({
      item_code: String(r.item_code || ""),
      item_name: String(r.item_name || r.item_code || ""),
      unit: String(r.unit || ""),
      qty_in: num(r.qty_in),
      qty_out: num(r.qty_out),
      net: num(r.qty_in) - num(r.qty_out),
      docs: num(r.docs),
      balance_qty: r.balance_qty == null ? null : num(r.balance_qty),
    })),
  };
}

/** Restock / overstock / dead-stock lists. Uses fixed windows (30/90/365 days),
 *  independent of any date range — load once per page visit. */
export async function getStockRecommendationsAction(
  options: { wh_code?: string; location_code?: string } = {}
): Promise<StockRecommendations> {
  await requireSession();
  await ensureMinimumStockTable(); // query joins pos_minimum_stock
  const whCode = (options.wh_code || "1105").trim();
  const locationCode = (options.location_code ?? "").trim();

  const recRows = (await q(
    "recommendations",
    `WITH bal AS (
       SELECT btrim(ic_code) AS ic_code, balance_qty
         FROM sml_ic_function_stock_balance_location_warehouse_cost('2099-12-31', '', $1, $2)
        WHERE btrim(ic_code) NOT LIKE '9%'
     ),
     outm AS (
       SELECT btrim(d.item_code) AS ic_code,
              COALESCE(SUM(d.qty) FILTER (WHERE d.doc_date >= CURRENT_DATE - ${DEAD_DAYS}), 0) AS out_90d,
              COALESCE(SUM(d.qty) FILTER (WHERE d.doc_date >= CURRENT_DATE - 30), 0) AS out_30d,
              MAX(d.doc_date) AS last_move
         FROM ic_trans_detail d
        WHERE d.calc_flag = -1 AND d.wh_code = $1 AND d.doc_date >= CURRENT_DATE - 365
          AND btrim(d.item_code) NOT LIKE '9%'
        GROUP BY btrim(d.item_code)
     ),
     minq AS (
       SELECT btrim(ic_code) AS ic_code, MAX(min_qty) AS min_qty
         FROM pos_minimum_stock
        WHERE active = TRUE AND wh_code = $1
        GROUP BY btrim(ic_code)
     )
     SELECT COALESCE(b.ic_code, o.ic_code) AS ic_code,
            ic.name_1 AS item_name,
            COALESCE(b.balance_qty, 0) AS balance_qty,
            COALESCE(o.out_30d, 0) AS out_30d,
            COALESCE(o.out_90d, 0) AS out_90d,
            o.last_move::text AS last_move,
            m.min_qty,
            COALESCE(ic.average_cost, 0) AS avg_cost
       FROM bal b
       FULL OUTER JOIN outm o ON o.ic_code = b.ic_code
       LEFT JOIN ic_inventory ic ON ic.code = COALESCE(b.ic_code, o.ic_code)
       LEFT JOIN minq m ON m.ic_code = COALESCE(b.ic_code, o.ic_code)
      WHERE COALESCE(b.balance_qty, 0) > 0 OR COALESCE(o.out_30d, 0) > 0`,
    [whCode, locationCode]
  )) as Row[];

  const restock: RestockItem[] = [];
  const overstock: OverstockItem[] = [];
  const dead: DeadStockItem[] = [];

  for (const r of recRows || []) {
    const balance = num(r.balance_qty);
    const out30 = num(r.out_30d);
    const out90 = num(r.out_90d);
    const minQty = r.min_qty == null ? null : num(r.min_qty);
    const name = String(r.item_name || r.ic_code || "");
    const code = String(r.ic_code || "");
    const avgCost = num(r.avg_cost);
    const velocity30 = out30 / 30;

    const belowMin = minQty != null && balance <= minQty;
    if (out30 > 0 && (balance <= 0 || balance / velocity30 <= RESTOCK_DAYS || belowMin)) {
      const target = Math.max(velocity30 * COVER_DAYS, minQty ?? 0);
      restock.push({
        ic_code: code,
        item_name: name,
        balance_qty: balance,
        out_30d: out30,
        days_left: balance > 0 ? Math.round((balance / velocity30) * 10) / 10 : 0,
        suggest_qty: Math.max(Math.ceil(target - balance), 1),
        below_min: belowMin,
        min_qty: minQty,
      });
      continue;
    }
    if (balance > 0 && out90 === 0) {
      dead.push({
        ic_code: code,
        item_name: name,
        balance_qty: balance,
        last_move: r.last_move ? String(r.last_move) : null,
        stock_value: Math.round(balance * avgCost),
      });
      continue;
    }
    if (balance > 0 && out90 > 0 && balance / (out90 / DEAD_DAYS) > OVERSTOCK_DAYS) {
      overstock.push({
        ic_code: code,
        item_name: name,
        balance_qty: balance,
        out_90d: out90,
        days_of_stock: Math.round(balance / (out90 / DEAD_DAYS)),
        stock_value: Math.round(balance * avgCost),
      });
    }
  }

  restock.sort((a, b) => (a.days_left ?? 0) - (b.days_left ?? 0) || b.out_30d - a.out_30d);
  overstock.sort((a, b) => b.stock_value - a.stock_value);
  dead.sort((a, b) => b.stock_value - a.stock_value);

  return {
    restock: restock.slice(0, 500),
    overstock: overstock.slice(0, 500),
    dead: dead.slice(0, 500),
  };
}

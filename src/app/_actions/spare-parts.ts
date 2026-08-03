"use server";

import { runQuery } from "@/lib/db";
import { requireSession } from "@/lib/session";

type Row = Record<string, unknown>;

export type SparePartRow = {
  ic_code: string;
  item_name: string;
  unit: string;
  brand: string;
  group_name: string;
  balance_qty: number;
  sale_price: number;
  avg_cost: number;
  stock_value: number;
  /** Products this part is used with (from odg_product_spare_mapping). */
  used_with: { code: string; name: string }[];
};

export type SpareParts = {
  total: number;
  page: number;
  per_page: number;
  items: SparePartRow[];
};

function num(v: unknown): number {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

/** Spare-parts catalog (item codes 14xxxx): whole-warehouse balance, current/latest
 *  sale price, and the products each part is mapped to. */
export async function getSparePartsAction(
  queryRaw = "",
  options: { in_stock_only?: boolean; page?: number; per_page?: number; wh_code?: string } = {}
): Promise<SpareParts> {
  await requireSession();
  const query = (queryRaw || "").trim();
  const whCode = (options.wh_code || "1105").trim();
  const perPage = Math.min(Math.max(Number(options.per_page) || 50, 10), 200);
  const page = Math.max(Number(options.page) || 1, 1);
  const inStockOnly = options.in_stock_only !== false; // default: only items with stock

  const like = `%${query.toLowerCase()}%`;
  const params: unknown[] = [whCode];
  let filter = `ic.code LIKE '14%'`;
  if (query) {
    filter += ` AND (lower(ic.code) LIKE $2 OR lower(ic.name_1) LIKE $2
      OR EXISTS (SELECT 1 FROM ic_inventory_barcode ib WHERE ib.ic_code = ic.code AND lower(ib.barcode) LIKE $2))`;
    params.push(like);
  }

  const balJoin = `LEFT JOIN (
      SELECT btrim(ic_code) AS ic_code, SUM(balance_qty) AS balance_qty
        FROM sml_ic_function_stock_balance_location_warehouse_cost('2099-12-31', '', $1, '')
       GROUP BY btrim(ic_code)
    ) b ON b.ic_code = btrim(ic.code)`;
  const stockCond = inStockOnly ? "AND COALESCE(b.balance_qty, 0) > 0" : "";

  const countRow = (await runQuery(
    `SELECT COUNT(*) AS total
       FROM ic_inventory ic
       ${balJoin}
      WHERE ${filter} ${stockCond}`,
    params,
    "one"
  )) as Row | null;
  const total = num(countRow?.total);

  const rows = (await runQuery(
    `WITH base AS (
       SELECT ic.code AS ic_code, ic.name_1 AS item_name,
              COALESCE(ic.unit_standard, '') AS unit,
              ic.item_brand, ic.group_sub,
              COALESCE(ic.average_cost, 0) AS avg_cost,
              COALESCE(b.balance_qty, 0) AS balance_qty
         FROM ic_inventory ic
         ${balJoin}
        WHERE ${filter} ${stockCond}
        ORDER BY COALESCE(b.balance_qty, 0) DESC, ic.code
        LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
     )
     SELECT base.*, br.name_1 AS brand, sub.name_1 AS group_name,
            COALESCE(p.sale_price1, 0) AS sale_price,
            uw.used_with
       FROM base
       LEFT JOIN ic_brand br ON br.code = base.item_brand
       LEFT JOIN ic_group_sub sub ON sub.code = base.group_sub
       LEFT JOIN LATERAL (
         SELECT sale_price1 FROM ic_inventory_price
          WHERE ic_code = base.ic_code AND currency_code = '02' AND from_qty = 1
          ORDER BY (CURRENT_DATE BETWEEN from_date AND COALESCE(to_date, CURRENT_DATE)) DESC,
                   from_date DESC, roworder DESC
          LIMIT 1
       ) p ON TRUE
       LEFT JOIN LATERAL (
         SELECT json_agg(json_build_object('code', btrim(m.product_code), 'name', COALESCE(pi.name_1, m.product_code))) AS used_with
           FROM odg_product_spare_mapping m
           LEFT JOIN ic_inventory pi ON pi.code = btrim(m.product_code)
          WHERE btrim(m.spare_code) = btrim(base.ic_code)
       ) uw ON TRUE
      ORDER BY base.balance_qty DESC, base.ic_code`,
    params
  )) as Row[];

  return {
    total,
    page,
    per_page: perPage,
    items: (rows || []).map((r) => {
      const balance = num(r.balance_qty);
      const avgCost = num(r.avg_cost);
      return {
        ic_code: String(r.ic_code || "").trim(),
        item_name: String(r.item_name || r.ic_code || ""),
        unit: String(r.unit || ""),
        brand: String(r.brand || ""),
        group_name: String(r.group_name || ""),
        balance_qty: balance,
        sale_price: num(r.sale_price),
        avg_cost: avgCost,
        stock_value: Math.round(balance * avgCost),
        used_with: Array.isArray(r.used_with)
          ? (r.used_with as { code: string; name: string }[])
          : [],
      };
    }),
  };
}

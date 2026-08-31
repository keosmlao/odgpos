"use server";

import { runQuery } from "@/lib/db";
import { openOrderReservationsSql } from "@/lib/reservations";
import { requireSession } from "@/lib/session";
import { ensureOnlineOrdersTable, ensureShopOrdersTable } from "@/lib/tables";

// searchProductsAction / getProductByBarcodeAction are staff-only (POS, back office)
// and may return cost data. getShopProductsAction / getShopPriceListAction stay
// public for the customer shop and must never expose cost columns.

type Row = Record<string, unknown>;

export async function searchProductsAction(
  queryRaw: string,
  options: { wh_code?: string; location_code?: string; include_stock?: boolean } = {}
): Promise<Row[]> {
  await requireSession();
  const query = (queryRaw || "").trim();
  if (!query) return [];
  const whCode = options.wh_code || "1105";
  const locationCode = options.location_code || "110501";
  const includeStock = options.include_stock !== false;

  const prefixLike = `${query}%`;
  const containsLike = `%${query}%`;

  const stockSelect = !includeStock ? "" : `,
  (
    SELECT balance_qty
    FROM sml_ic_function_stock_balance_warehouse_location(
      '2099-12-31'::date,
      btrim(ic.code)::varchar,
      $1::varchar,
      $2::varchar
    )
    LIMIT 1
  ) AS balance_qty`;

  const params: unknown[] = [];
  let idx = 1;
  if (includeStock) {
    params.push(whCode, locationCode);
    idx = 3;
  }
  params.push(prefixLike, containsLike);

  const sql = `
SELECT
  ic.code AS ic_code,
  ic.code AS item_code,
  COALESCE(b.barcode, ic.code) AS barcode,
  COALESCE(b.unit_code, 'EA') AS unit_code,
  ic.name_1 AS item_name,
  COALESCE(p.sale_price1, 0) AS sale_price1${stockSelect},
  b.no_point,
  ic.average_cost
FROM ic_inventory ic
LEFT JOIN LATERAL (
  SELECT barcode, unit_code, no_point FROM ic_inventory_barcode WHERE ic_code = ic.code LIMIT 1
) b ON TRUE
LEFT JOIN LATERAL (
  -- Prefer a currently-valid price; if none, fall back to the latest price on record.
  SELECT sale_price1 FROM ic_inventory_price
  WHERE ic_code = ic.code AND unit_code = COALESCE(b.unit_code, 'EA')
    AND currency_code = '02' AND from_qty = 1
  ORDER BY (CURRENT_DATE BETWEEN from_date AND COALESCE(to_date, CURRENT_DATE)) DESC,
           from_date DESC, roworder DESC
  LIMIT 1
) p ON TRUE
WHERE (ic.code LIKE $${idx} OR ic.name_1 ILIKE $${idx + 1})
ORDER BY ic.code
LIMIT 20;`;

  return (await runQuery(sql, params)) as Row[];
}

export async function getProductByBarcodeAction(
  barcode: string,
  qty = 1,
  options: { wh_code?: string; location_code?: string } = {}
): Promise<Row | null> {
  await requireSession();
  if (!barcode) return null;
  const whCode = options.wh_code || "1105";
  const locationCode = options.location_code || "110501";

  // The POS sells fractional quantities (down to 0.01); an ::int cast rejected
  // them outright ("invalid input syntax for integer: 0.1"), costing the line
  // its price and stock refresh. Clamping to 1 prices a part-unit sale at the
  // single-unit tier, since price tiers start at from_qty 1.
  const rows = (await runQuery(
    `WITH param AS (SELECT GREATEST($1::numeric, 1) AS qty)
     SELECT a.ic_code, c.code AS item_code, a.barcode, a.unit_code, c.name_1 AS item_name,
            COALESCE(b.sale_price1, 0) AS sale_price1, b.from_qty, b.to_qty,
            a.no_point, c.average_cost
       FROM ic_inventory_barcode a
       JOIN ic_inventory c ON c.code = a.ic_code
       JOIN param p ON true
       LEFT JOIN ic_inventory_price b
              ON b.ic_code = a.ic_code AND b.unit_code = a.unit_code
             AND p.qty BETWEEN b.from_qty AND COALESCE(b.to_qty, 999999)
             AND b.currency_code = '02'
      WHERE a.barcode = $2
      ORDER BY (current_date BETWEEN b.from_date AND COALESCE(b.to_date, current_date)) DESC NULLS LAST,
               b.from_date DESC NULLS LAST, b.roworder DESC NULLS LAST
      LIMIT 1;`,
    [qty, barcode]
  )) as Row[];
  if (!rows.length) return null;
  const row = rows[0];
  try {
    const itemCode = String(row.item_code || row.ic_code || "").trim();
    const balance = (await runQuery(
      `SELECT balance_qty FROM sml_ic_function_stock_balance_warehouse_location(
         '2099-12-31'::date, $1::varchar, $2::varchar, $3::varchar
       ) LIMIT 1;`,
      [itemCode, whCode, locationCode],
      "one"
    )) as Row | null;
    if (balance && "balance_qty" in balance) row.balance_qty = balance.balance_qty;
  } catch (exc) {
    console.error("getProductByBarcodeAction stock lookup failed:", exc);
  }
  return row;
}

// Preserved for legacy callers; the original /api/products/[id] route never existed,
// so this path was always a no-op fallback. Keep as a stable, typed no-op.
export async function getProductByIdAction(_id: string): Promise<null> {
  return null;
}

export async function getShopProductsAction(): Promise<Row[]> {
  // Stock already promised to open orders is not on offer: showing it would let
  // a second customer order what the first is coming to collect.
  await ensureShopOrdersTable();
  await ensureOnlineOrdersTable();
  return (await runQuery(`
SELECT a.ic_code, ic.name_1 AS ic_name, a.balance_qty - COALESCE(res.qty, 0) AS balance_qty,
  cat.name_1  AS cat_name,
  grp.name_1  AS group_name,
  sub.name_1  AS sub_group_name,
  sub1.name_1 AS sub_group1_name,
  br.name_1   AS brand_name,
  p.sale_price1 AS price
FROM sml_ic_function_stock_balance_location_warehouse_cost('2099-12-31', '', '1105', '110501') a
LEFT JOIN ic_inventory  ic   ON ic.code   = a.ic_code
LEFT JOIN ic_category   cat  ON cat.code  = ic.item_category
LEFT JOIN ic_group      grp  ON grp.code  = ic.group_main
LEFT JOIN ic_group_sub  sub  ON sub.code  = ic.group_sub
LEFT JOIN ic_group_sub2 sub1 ON sub1.code = ic.group_sub2
LEFT JOIN ic_brand      br   ON br.code   = ic.item_brand
LEFT JOIN LATERAL (
  SELECT sale_price1 FROM ic_inventory_price
  WHERE ic_code = a.ic_code AND currency_code = '02' AND (to_date IS NULL OR to_date > CURRENT_DATE)
  ORDER BY sale_price1 ASC LIMIT 1
) p ON TRUE
LEFT JOIN (${openOrderReservationsSql("''")}) res ON res.code = a.ic_code
WHERE a.balance_qty - COALESCE(res.qty, 0) > 0 AND a.ic_code LIKE '14%'
ORDER BY p.sale_price1, a.ic_code;
`)) as Row[];
}

export async function getShopPriceListAction(icCode: string): Promise<Row[]> {

  if (!icCode) return [];
  return (await runQuery(
    `SELECT sale_price1, from_qty, unit_code, to_date FROM ic_inventory_price
      WHERE currency_code = '02' AND (to_date IS NULL OR to_date > CURRENT_DATE) AND ic_code = $1
      ORDER BY from_qty ASC, sale_price1 ASC;`,
    [icCode]
  )) as Row[];
}

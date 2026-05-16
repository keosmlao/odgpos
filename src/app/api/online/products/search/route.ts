import { NextRequest, NextResponse } from "next/server";
import { runQuery } from "@/lib/db";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const query = (sp.get("q") || "").trim();
  if (!query) return NextResponse.json([]);
  const whCode = sp.get("wh_code") || "1105";
  const locationCode = sp.get("location_code") || sp.get("shelf_code") || "110501";
  const includeStock = ["1", "true", "yes"].includes((sp.get("include_stock") || "").toLowerCase());
  const likeQuery = `%${query}%`;

  const stockSelect = !includeStock ? "" : `,
  (SELECT balance_qty FROM sml_ic_function_stock_balance_warehouse_location(
    '2099-12-31'::date, btrim(c.code)::varchar, $1::varchar, $2::varchar
  ) LIMIT 1) AS balance_qty`;

  const params: unknown[] = [];
  let paramIdx = 1;
  if (includeStock) { params.push(whCode, locationCode); paramIdx = 3; }
  params.push(likeQuery, likeQuery, likeQuery);

  const sql = `
SELECT DISTINCT ON (a.ic_code) a.ic_code, c.code AS item_code, a.barcode, a.unit_code,
  c.name_1 AS item_name, COALESCE(p.sale_price1, 0) AS sale_price1${stockSelect}, a.no_point, c.average_cost
FROM ic_inventory_barcode a
JOIN ic_inventory c ON c.code = a.ic_code
LEFT JOIN (
  SELECT DISTINCT ON (ic_code, unit_code) ic_code, unit_code, sale_price1
  FROM ic_inventory_price WHERE currency_code = '02' and from_qty=1
    AND CURRENT_DATE BETWEEN from_date AND COALESCE(to_date, CURRENT_DATE)
  ORDER BY ic_code, unit_code, from_date DESC, roworder DESC
) p ON p.ic_code = a.ic_code AND p.unit_code = a.unit_code
WHERE (a.barcode ILIKE $${paramIdx} OR a.ic_code ILIKE $${paramIdx + 1} OR c.name_1 ILIKE $${paramIdx + 2})
ORDER BY a.ic_code, p.sale_price1 DESC LIMIT 50;
  `;
  try {
    const rows = await runQuery(sql, params);
    return NextResponse.json(rows);
  } catch (exc) {
    console.error("Error searching online products:", exc);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

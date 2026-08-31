"use server";

import { runQuery } from "@/lib/db";
import { getSession, requireSession } from "@/lib/session";
import { ensureOnlineOrdersTable, ensureShopOrdersTable } from "@/lib/tables";
import { openOrderReservationsSql } from "@/lib/reservations";

type Row = Record<string, unknown>;
type ShopOrderItem = {
  id?: unknown; item_code?: unknown; ic_code?: unknown;
  name?: unknown; ic_name?: unknown;
  unit?: unknown; unit_code?: unknown;
  price?: unknown; unit_cost?: unknown; average_cost?: unknown;
  quantity?: unknown; price_from_qty?: unknown;
};

async function nextShopOrderNo() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `SHP-${yy}${mm}${dd}`;
  const row = (await runQuery(
    "SELECT order_no FROM pos_shop_orders WHERE order_no LIKE $1 ORDER BY order_no DESC LIMIT 1",
    [`${prefix}%`],
    "one"
  )) as { order_no?: string } | null;
  const latest = row?.order_no ?? null;
  let nextSeq = 1;
  if (latest && latest.length >= prefix.length + 1) {
    try { nextSeq = parseInt(latest.slice(prefix.length)) + 1; } catch { nextSeq = 1; }
  }
  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

export async function getShopOrdersAction(query = "", customerCode = "", status = ""): Promise<Row[]> {
  // The customer shop calls this without a session, so it may only list that
  // one customer's orders; the till, which has a session, lists them all.
  const session = await getSession();
  if (!session && !(customerCode || "").trim()) return [];
  await ensureShopOrdersTable();
  let sql = "SELECT order_no, status, customer_name, customer_phone, total, created_at FROM pos_shop_orders WHERE 1=1";
  const params: unknown[] = [];
  let idx = 1;
  const trimmedCustomer = (customerCode || "").trim();
  const trimmedStatus = (status || "").trim().toLowerCase();
  const trimmedQuery = (query || "").trim();
  if (trimmedCustomer) { sql += ` AND customer_code = $${idx++}`; params.push(trimmedCustomer); }
  if (trimmedStatus) { sql += ` AND status = $${idx++}`; params.push(trimmedStatus); }
  if (trimmedQuery) {
    const like = `%${trimmedQuery.toLowerCase()}%`;
    sql += ` AND (lower(order_no) LIKE $${idx} OR lower(customer_name) LIKE $${idx + 1} OR customer_phone LIKE $${idx + 2})`;
    params.push(like, like, like); idx += 3;
  }
  sql += " ORDER BY created_at DESC LIMIT 200";
  return (await runQuery(sql, params)) as Row[];
}

export async function getShopOrderAction(orderNo: string, customerCode = ""): Promise<Row | null> {
  const session = await getSession();
  const scopedCustomer = (customerCode || "").trim();
  if (!session && !scopedCustomer) return null;
  await ensureShopOrdersTable();
  return (await runQuery(
    "SELECT * FROM pos_shop_orders WHERE order_no = $1 AND ($2 = '' OR customer_code = $2)",
    [orderNo, session ? "" : scopedCustomer],
    "one"
  )) as Row | null;
}

export async function createShopOrderAction(payload: Row): Promise<{ order_no: string; created_at: unknown }> {
  const items = payload.items;
  if (!Array.isArray(items) || !items.length) throw new Error("Missing items");
  const customer = (payload.customer as Row) || {};
  const customerCode = (customer.code as string) || (payload.customer_code as string);
  const customerName = (customer.name as string) || (payload.customer_name as string);
  const customerPhone = (customer.phone as string) || (payload.customer_phone as string);
  const discountPercent = Math.min(Math.max(Number(payload.discount_percent || 0), 0), 100);

  // Prices are validated server-side against the price master — the client is
  // unauthenticated (customer shop), so its prices cannot be trusted.
  const codes = (items as ShopOrderItem[])
    .map((i) => String(i.id || i.item_code || i.ic_code || "").trim())
    .filter(Boolean);
  const priceRows = codes.length
    ? ((await runQuery(
        `SELECT DISTINCT ON (ic_code) ic_code, sale_price1
           FROM ic_inventory_price
          WHERE currency_code = '02' AND from_qty = 1 AND ic_code = ANY($1)
          ORDER BY ic_code,
            (CURRENT_DATE BETWEEN from_date AND COALESCE(to_date, CURRENT_DATE)) DESC,
            from_date DESC, roworder DESC`,
        [codes]
      )) as { ic_code: string; sale_price1: unknown }[])
    : [];
  const priceMap: Record<string, number> = {};
  for (const p of priceRows) priceMap[String(p.ic_code).trim()] = Number(p.sale_price1) || 0;

  let subtotal = 0;
  const cleanItems: Row[] = [];
  for (const itemRaw of items as ShopOrderItem[]) {
    const code = String(itemRaw.id || itemRaw.item_code || itemRaw.ic_code || "").trim();
    const serverPrice = priceMap[code] || 0;
    const price = serverPrice > 0 ? serverPrice : Number(itemRaw.price || 0);
    const qty = Number(itemRaw.quantity || 0);
    if (qty <= 0) continue;
    subtotal += price * qty;
    cleanItems.push({
      id: code,
      name: itemRaw.name || itemRaw.ic_name,
      unit: itemRaw.unit || itemRaw.unit_code,
      price,
      quantity: qty, price_from_qty: itemRaw.price_from_qty,
    });
  }
  if (!cleanItems.length) throw new Error("Invalid items");

  // An order holds the stock it names, so it can only be taken for what the
  // shop warehouse still has free — on hand, less what other open orders hold.
  await ensureShopOrdersTable();
  await ensureOnlineOrdersTable();
  const wantedByCode = new Map<string, number>();
  for (const item of cleanItems) {
    const code = String(item.id || "").trim();
    if (code) wantedByCode.set(code, (wantedByCode.get(code) ?? 0) + Number(item.quantity || 0));
  }
  const availability = (await runQuery(
    `SELECT v.code, COALESCE(inv.name_1, v.code) AS item_name,
            COALESCE(f.balance_qty, 0) - COALESCE(res.qty, 0) AS available
       FROM unnest($1::text[]) AS v(code)
       JOIN ic_inventory inv ON inv.code = v.code
       LEFT JOIN LATERAL (
         SELECT balance_qty
           FROM sml_ic_function_stock_balance_warehouse_location(
             '2099-12-31'::date, btrim(v.code)::varchar, '1105'::varchar, '110501'::varchar
           )
          LIMIT 1
       ) f ON TRUE
       LEFT JOIN (${openOrderReservationsSql("''")}) res ON res.code = v.code
      WHERE COALESCE(inv.item_type, 0) NOT IN (3, 5)`,
    [[...wantedByCode.keys()]]
  )) as { code: string; item_name: string; available: unknown }[];
  const shortages = availability
    .filter((row) => (wantedByCode.get(String(row.code)) ?? 0) > Number(row.available || 0))
    .map((row) => `${row.item_name} (ຍັງເຫຼືອ ${Math.max(Number(row.available || 0), 0)})`);
  if (shortages.length) throw new Error(`ສິນຄ້າບໍ່ພຽງພໍ: ${shortages.join(", ")}`);
  const discountAmount = Math.round(subtotal * discountPercent / 100 * 100) / 100;
  const total = subtotal - discountAmount;

  await ensureShopOrdersTable();
  const orderNo = await nextShopOrderNo();
  const row = (await runQuery(
    `INSERT INTO pos_shop_orders (order_no, status, customer_code, customer_name, customer_phone, items, subtotal, discount_amount, discount_percent, total, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING order_no, created_at`,
    [orderNo, "pending", customerCode, customerName, customerPhone, JSON.stringify(cleanItems), subtotal, discountAmount, discountPercent, total, payload.note || null],
    "one"
  )) as Row;
  return { order_no: row.order_no as string, created_at: row.created_at };
}

export async function updateShopOrderStatusAction(orderNo: string, statusRaw: string): Promise<Row> {
  await requireSession();
  const status = (statusRaw || "").trim().toLowerCase();
  if (!["pending", "ready", "picked", "cancelled"].includes(status)) {
    throw new Error("Invalid status");
  }
  await ensureShopOrdersTable();
  const row = (await runQuery(
    "UPDATE pos_shop_orders SET status=$1, updated_at=NOW() WHERE order_no=$2 RETURNING order_no, status, updated_at",
    [status, orderNo],
    "one"
  )) as Row | null;
  if (!row) throw new Error("Order not found");
  return row;
}

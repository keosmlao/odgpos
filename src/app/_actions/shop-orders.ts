"use server";

import { runQuery } from "@/lib/db";
import { ensureShopOrdersTable } from "@/lib/tables";

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

export async function getShopOrderAction(orderNo: string): Promise<Row | null> {
  await ensureShopOrdersTable();
  return (await runQuery("SELECT * FROM pos_shop_orders WHERE order_no = $1", [orderNo], "one")) as Row | null;
}

export async function createShopOrderAction(payload: Row): Promise<{ order_no: string; created_at: unknown }> {
  const items = payload.items;
  if (!Array.isArray(items) || !items.length) throw new Error("Missing items");
  const customer = (payload.customer as Row) || {};
  const customerCode = (customer.code as string) || (payload.customer_code as string);
  const customerName = (customer.name as string) || (payload.customer_name as string);
  const customerPhone = (customer.phone as string) || (payload.customer_phone as string);
  const discountPercent = Number(payload.discount_percent || 0);

  let subtotal = 0;
  const cleanItems: Row[] = [];
  for (const itemRaw of items as ShopOrderItem[]) {
    const price = Number(itemRaw.price || 0);
    const qty = Number(itemRaw.quantity || 0);
    if (qty <= 0) continue;
    subtotal += price * qty;
    cleanItems.push({
      id: itemRaw.id || itemRaw.item_code || itemRaw.ic_code,
      name: itemRaw.name || itemRaw.ic_name,
      unit: itemRaw.unit || itemRaw.unit_code,
      price, unit_cost: Number(itemRaw.unit_cost || 0),
      average_cost: Number(itemRaw.average_cost || 0),
      quantity: qty, price_from_qty: itemRaw.price_from_qty,
    });
  }
  if (!cleanItems.length) throw new Error("Invalid items");
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

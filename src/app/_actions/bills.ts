"use server";

import type { PoolClient } from "pg";

import { pool, runQuery } from "@/lib/db";
import { getSession, requireSession } from "@/lib/session";
import { ensureCancelledBillsTable, ensureChangeLogTable, ensureFxRateTable, ensureSavedBillsTable } from "@/lib/tables";
import { notifyLineOnBill } from "@/lib/line";

type Row = Record<string, unknown>;

/** ERP currency codes: baht is the base every document converts to, kip is what
 *  the drawer counts and gives change in. */
const BASE_CURRENCY = "01";
const KIP_CURRENCY = "02";

function toDecimal(value: unknown, defaultVal = 0): number {
  if (value == null) return defaultVal;
  if (typeof value === "string") {
    const num = Number(value.replace(/,/g, "").trim());
    return isFinite(num) ? num : defaultVal;
  }
  const num = Number(value);
  return isFinite(num) ? num : defaultVal;
}

function formatQty(value: number): string {
  return Number(value.toFixed(2)).toLocaleString("en-US");
}

/**
 * Returns a Lao message naming every line the selling warehouse cannot cover,
 * or null when the whole bill fits in stock. It reads the same SML balance
 * function the POS shows the cashier (warehouse + shelf), not the company-wide
 * ic_inventory.balance_qty, so the check matches the quantity on screen.
 * Item types 3/5 are non-stock (service) lines: never deducted, never checked.
 */
async function findStockShortage(
  client: PoolClient,
  soldQtyByItem: Map<string, number>,
  whCode: string,
  shelfCode: string
): Promise<string | null> {
  if (!soldQtyByItem.size) return null;
  const codes = [...soldQtyByItem.keys()];
  // Lock the inventory rows first: without it two tills can both pass the check
  // on the same last unit. The balance_qty update at the end of the sale takes
  // these same locks, so this only moves the lock earlier in the transaction.
  await client.query(
    "SELECT 1 FROM ic_inventory WHERE code = ANY($1) ORDER BY code FOR UPDATE",
    [codes]
  );
  // Inner join: a code with no ic_inventory row is not stock-tracked here, so
  // there is nothing to drive negative.
  const res = await client.query(
    `SELECT v.code, COALESCE(inv.name_1, v.code) AS item_name, COALESCE(f.balance_qty, 0) AS available
       FROM unnest($1::text[]) AS v(code)
       JOIN ic_inventory inv ON inv.code = v.code
       LEFT JOIN LATERAL (
         SELECT balance_qty
           FROM sml_ic_function_stock_balance_warehouse_location(
             '2099-12-31'::date, btrim(v.code)::varchar, $2::varchar, $3::varchar
           )
          LIMIT 1
       ) f ON TRUE
      WHERE COALESCE(inv.item_type, 0) NOT IN (3, 5)`,
    [codes, whCode, shelfCode]
  );
  const shortages: string[] = [];
  for (const row of res.rows) {
    const available = toDecimal(row.available);
    const wanted = soldQtyByItem.get(row.code) ?? 0;
    if (wanted > available) {
      shortages.push(`${row.item_name} (ຕ້ອງການ ${formatQty(wanted)}, ຄົງເຫຼືອ ${formatQty(available)})`);
    }
  }
  if (!shortages.length) return null;
  return `ສະຕ໋ອກບໍ່ພໍ ຂາຍຕິດລົບບໍ່ໄດ້: ${shortages.join(", ")}`;
}

type RepricedBill = { items: Record<string, unknown>[]; subtotal: number; discount: number; total: number };

/**
 * Rebuilds a bill's money from server data. The customer shop reaches
 * saveBillAction without a session, so its prices, per-line discounts and
 * totals are whatever the client chose to send — only item codes and
 * quantities are taken at face value. Each line is priced at the quantity tier
 * on record and the discount is the customer's own rate, neither of which the
 * request can influence. A staff session is left alone: the till is where
 * manual discounts and promotion prices legitimately come from.
 */
async function repriceForPublicSale(
  client: PoolClient,
  items: Record<string, unknown>[],
  custCode: string
): Promise<RepricedBill> {
  const codes = items.map((i) => String(i.item_code || i.id || i.ic_code || i.barcode || "").trim());
  const quantities = items.map((i) => toDecimal(i.quantity || i.qty || 1));
  const units = items.map((i) => String(i.unit_code || i.unit || ""));

  // One row per line (WITH ORDINALITY keeps them in order), priced at the tier
  // the line quantity falls in — the tier rule getProductByBarcodeAction uses.
  const masterPrices = new Map<number, number>();
  if (codes.some(Boolean)) {
    const priceRes = await client.query(
      `SELECT v.idx, p.sale_price1
         FROM unnest($1::text[], $2::numeric[], $3::text[]) WITH ORDINALITY AS v(code, qty, unit, idx)
         LEFT JOIN LATERAL (
           SELECT sale_price1
             FROM ic_inventory_price
            WHERE ic_code = v.code AND currency_code = '02'
              AND GREATEST(v.qty, 1) BETWEEN from_qty AND COALESCE(to_qty, 999999)
            ORDER BY (unit_code = v.unit) DESC,
                     (CURRENT_DATE BETWEEN from_date AND COALESCE(to_date, CURRENT_DATE)) DESC,
                     from_date DESC, roworder DESC
            LIMIT 1
         ) p ON TRUE`,
      [codes, quantities, units]
    );
    for (const row of priceRes.rows) masterPrices.set(Number(row.idx), toDecimal(row.sale_price1));
  }

  const discountRes = await client.query(
    `SELECT d.discount_item
       FROM ar_customer a
       LEFT JOIN ar_customer_detail d ON d.ar_code = a.code
      WHERE a.code = $1
      LIMIT 1`,
    [custCode]
  );
  const rawDiscount = String(discountRes.rows[0]?.discount_item ?? "").replace("%", "").trim();
  const discountPercent = Math.min(Math.max(toDecimal(rawDiscount), 0), 100);

  let subtotal = 0;
  let discount = 0;
  const repriced = items.map((raw, i) => {
    const masterPrice = masterPrices.get(i + 1) ?? 0;
    // An item with no price on record keeps the price the client sent: that can
    // overcharge the customer, never undercharge the shop.
    const unitPrice = masterPrice > 0 ? masterPrice : Math.max(toDecimal(raw.unitPrice ?? raw.price), 0);
    const lineSubtotal = unitPrice * quantities[i];
    const lineDiscount = Math.round((lineSubtotal * discountPercent) / 100);
    subtotal += lineSubtotal;
    discount += lineDiscount;
    return {
      ...raw,
      price: unitPrice,
      unitPrice,
      discount_amount: lineDiscount,
      discountAmount: lineDiscount,
      discount_percent: discountPercent,
      sum_amount: lineSubtotal - lineDiscount,
    };
  });
  return { items: repriced, subtotal, discount, total: Math.max(subtotal - discount, 0) };
}

export async function getDocNoAction(): Promise<{ doc_no: string }> {
  await requireSession();
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `POS${yy}${mm}`;
  const rows = (await runQuery(
    "SELECT MAX(doc_no) AS doc_no FROM ic_trans WHERE doc_format_code = 'SPOS' AND doc_no LIKE $1",
    [`${prefix}%`]
  )) as { doc_no: string | null }[];
  const latest = rows?.[0]?.doc_no ?? null;
  const nextNumeric = latest ? parseInt(latest.slice(prefix.length)) + 1 : 1;
  return { doc_no: `${prefix}${String(nextNumeric).padStart(4, "0")}` };
}

export async function searchBillsAction(docNoRaw: string): Promise<Row[]> {
  await requireSession();
  const docNo = (docNoRaw || "").trim();
  if (!docNo) return [];
  return (await runQuery(
    `SELECT doc_no, doc_date, cust_code, total_amount as grand_total,
            (SELECT name_1 FROM ar_customer WHERE code = t.cust_code) as customer_name,
            (SELECT COUNT(*) FROM ic_trans_detail WHERE doc_no = t.doc_no) as item_count
       FROM ic_trans t
      WHERE doc_no ILIKE $1
      ORDER BY doc_date DESC, doc_no DESC
      LIMIT 20`,
    [`%${docNo}%`]
  )) as Row[];
}

export async function getPosBillsAction(query = "", customerCode = ""): Promise<Row[]> {
  // Reachable from the customer shop (no session), where it may only ever list
  // one customer's own bills — doc numbers run in sequence, so an unscoped list
  // hands over every customer's name, phone and totals. Staff see everything.
  const session = await getSession();
  if (!session && !(customerCode || "").trim()) return [];
  let sql = `
    SELECT t.doc_no, t.doc_date, t.cust_code, t.total_amount AS total,
      c.name_1 AS customer_name, c.telephone AS customer_phone,
      (SELECT COUNT(*) FROM ic_trans_detail d WHERE d.doc_no = t.doc_no) AS item_count
    FROM ic_trans t
    LEFT JOIN ar_customer c ON c.code = t.cust_code
    WHERE t.doc_format_code = 'SPOS' AND t.trans_flag = 44 AND COALESCE(t.is_cancel, 0) = 0
  `;
  const params: unknown[] = [];
  let idx = 1;
  const trimmedCustomer = (customerCode || "").trim();
  const trimmedQuery = (query || "").trim();
  if (trimmedCustomer) {
    sql += ` AND t.cust_code = $${idx++}`;
    params.push(trimmedCustomer);
  }
  if (trimmedQuery) {
    const like = `%${trimmedQuery.toLowerCase()}%`;
    sql += ` AND (lower(t.doc_no) LIKE $${idx} OR lower(c.name_1) LIKE $${idx + 1} OR c.telephone LIKE $${idx + 2})`;
    params.push(like, like, like);
    idx += 3;
  }
  sql += " ORDER BY t.doc_date DESC, t.doc_no DESC LIMIT 200";
  return (await runQuery(sql, params)) as Row[];
}

export async function getPosBillAction(docNo: string, customerCode = ""): Promise<(Row & { items: Row[] }) | null> {
  // Same rule as the list: without a session the bill has to belong to the
  // customer asking for it, or sequential doc numbers make every bill readable.
  const session = await getSession();
  const scopedCustomer = (customerCode || "").trim();
  if (!session && !scopedCustomer) return null;
  const header = (await runQuery(
    `SELECT t.doc_no, t.doc_date, t.cust_code, t.total_amount AS total,
            c.name_1 AS customer_name, c.telephone AS customer_phone
       FROM ic_trans t
       LEFT JOIN ar_customer c ON c.code = t.cust_code
      WHERE t.doc_no = $1 AND ($2 = '' OR t.cust_code = $2) LIMIT 1`,
    [docNo, session ? "" : scopedCustomer],
    "one"
  )) as Row | null;
  if (!header) return null;
  const items = (await runQuery(
    "SELECT item_code, item_name, qty, price, remark FROM ic_trans_detail WHERE doc_no = $1 ORDER BY roworder NULLS LAST",
    [docNo]
  )) as Row[];
  return { ...header, items };
}

export type SaveBillResult = { success: boolean; doc_no?: string; exchange_rate?: number; error?: string };

/** Per-process guard so schema DDL runs once, not on every sale. */
let billTablesEnsured = false;

export async function saveBillAction(bodyRaw: Record<string, unknown>): Promise<SaveBillResult> {
  let body = bodyRaw;
  // Reachable from the customer shop (no session) and the POS (staff session).
  const session = await getSession();
  const client = await pool.connect();
  try {
    if (!billTablesEnsured) {
      await client.query("ALTER TABLE cb_trans ADD COLUMN IF NOT EXISTS exchange_rate numeric");
      await client.query(`CREATE TABLE IF NOT EXISTS pos_saved_bills (
        id SERIAL PRIMARY KEY, payload JSONB NOT NULL, created_at TIMESTAMP DEFAULT NOW()
      )`);
      billTablesEnsured = true;
    }

    await client.query("BEGIN");
    const now = new Date();
    const docDate = (body.doc_date as string) || now.toISOString().split("T")[0];
    const docTime = (body.doc_time as string) || `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const currencyRow = await client.query("SELECT exchange_rate_present FROM public.erp_currency WHERE code='02'");
    const exchangeRate = currencyRow.rows[0]?.exchange_rate_present || 1;

    let docNo: string | null = (body.orderId as string) || null;
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = `POS${yy}${mm}`;

    const generateDocNo = async () => {
      const res = await client.query(
        "SELECT MAX(doc_no) AS doc_no FROM ic_trans WHERE doc_format_code = 'SPOS' AND doc_no LIKE $1",
        [`${prefix}%`]
      );
      const latest = res.rows[0]?.doc_no;
      const nextNum = latest ? parseInt(latest.slice(prefix.length)) + 1 : 1;
      return `${prefix}${String(nextNum).padStart(4, "0")}`;
    };

    if (!docNo) {
      docNo = await generateDocNo();
    } else {
      const exists = await client.query("SELECT 1 FROM ic_trans WHERE doc_no = $1 AND trans_flag = 44 LIMIT 1", [docNo]);
      if (exists.rows.length) docNo = await generateDocNo();
    }

    const paymentMethod = (body.payment_methods as string) || (body.paymentMethod as string) || (body.paymentType as string) || "cash";
    const member = (body.member as Record<string, unknown>) || {};
    const custCode = (body.cust_code as string) || (member.id as string) || "01-2125";
    const saleCode = (body.sale_code as string) || (body.staffCode as string) || (body.staff as string) || "";
    const sideCode = (body.side_code as string) || "200";
    const departmentCode = (body.department_code as string) || "2014";
    const whCode = (body.wh_code as string) || "1105";
    const shelfCode = (body.sh_code as string) || "110501";

    let itemsList: Record<string, unknown>[] = Array.isArray(body.items)
      ? (body.items as Record<string, unknown>[])
      : Array.isArray(body.bill)
        ? (body.bill as Record<string, unknown>[])
        : [];

    // No session means the customer shop, where every money figure in the
    // request is client-controlled: re-derive them all before they are used.
    if (!session && itemsList.length) {
      const repriced = await repriceForPublicSale(client, itemsList, custCode);
      itemsList = repriced.items;
      body = { ...body, subtotal: repriced.subtotal, discount: repriced.discount, total: repriced.total };
    }
    const computedSubtotal = itemsList.reduce(
      (sum, item) => sum + toDecimal(item.price) * toDecimal(item.quantity || item.qty || 1), 0
    ) * Number(exchangeRate);

    let safeSubtotal = toDecimal(body.subtotal) * Number(exchangeRate);
    if (!safeSubtotal && computedSubtotal) safeSubtotal = computedSubtotal;
    let safeTotal = toDecimal((body.total as number) || (body.finalTotal as number)) * Number(exchangeRate);
    if (!safeTotal && safeSubtotal) safeTotal = safeSubtotal;
    let safeDiscount = toDecimal(body.discount) * Number(exchangeRate);
    if (!safeDiscount && safeSubtotal > safeTotal) safeDiscount = safeSubtotal - safeTotal;

    const totalValue = safeSubtotal || safeTotal;
    const totalAmount = safeTotal || totalValue;
    const totalAmount2 = toDecimal(body.total);
    const changeAmount = toDecimal(body.change_amount);
    const bahtAmount = toDecimal(body.baht_amount);
    const bahtRate = toDecimal(body.baht_rate);
    // Points come from the client — enforce the earn rule (1 point / 50,000₭)
    // server-side so a forged request can't mint arbitrary points.
    const POINTS_RATE_LAK = 50000;
    const maxEarnable = Math.floor((totalAmount2 || totalAmount || 0) / POINTS_RATE_LAK);
    const rawPoint = toDecimal((body.point as number) || (body.earnedPoints as number));
    const sumPoint = Math.max(0, Math.min(Math.floor(rawPoint), maxEarnable));
    // Attribute the document to the logged-in user when there is a session;
    // the client-supplied value is only a fallback for the customer shop flow.
    const creatorCode = session?.code || (body.user_login as string) || "";

    // Aggregated per item so a bill listing the same code twice counts once.
    const soldQtyByItem = new Map<string, number>();
    for (const rawItem of itemsList) {
      const code = String(rawItem.item_code || rawItem.id || rawItem.ic_code || rawItem.barcode || "");
      if (!code) continue;
      soldQtyByItem.set(code, (soldQtyByItem.get(code) ?? 0) + toDecimal(rawItem.quantity || rawItem.qty || 1));
    }

    // No selling into negative stock: checked before the first write, so a
    // shortage rolls back an empty transaction.
    const shortage = await findStockShortage(client, soldQtyByItem, whCode, shelfCode);
    if (shortage) {
      await client.query("ROLLBACK");
      return { success: false, error: shortage };
    }

    await client.query(
      `INSERT INTO ic_trans(doc_ref, trans_type, trans_flag, doc_date, doc_no, vat_type, cust_code, branch_code, currency_code, exchange_rate, total_value, total_amount, doc_time,
        doc_format_code, creator_code, total_value_2, total_amount_2, inquiry_type, sale_code, side_code, department_code, sum_point)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
      [docNo, 2, 44, docDate, docNo, 2, custCode, "01", "02", Number(exchangeRate || 1),
        totalValue, totalAmount, docTime, "SPOS", creatorCode, totalAmount2, totalAmount2, 1,
        saleCode, sideCode, departmentCode, sumPoint]
    );

    const totalForAllocation = safeSubtotal > 0 ? safeSubtotal : computedSubtotal;
    const discountRatio = totalForAllocation > 0 ? safeDiscount / totalForAllocation : 0;

    const itemCodes = itemsList.map(i => i.item_code || i.id || i.ic_code || i.barcode || "").filter(Boolean);
    const avgCostMap: Record<string, number> = {};
    if (itemCodes.length) {
      const avgRes = await client.query("SELECT code, average_cost FROM ic_inventory WHERE code = ANY($1)", [itemCodes]);
      for (const r of avgRes.rows) avgCostMap[r.code] = r.average_cost;
    }

    for (const rawItem of itemsList) {
      const unitPrice = toDecimal(rawItem.unitPrice || rawItem.price) * Number(exchangeRate);
      const quantity = toDecimal(rawItem.quantity || rawItem.qty || 1);
      const lineSubtotal = unitPrice * quantity;
      const allocatedDiscount = Math.round(lineSubtotal * discountRatio);
      const discAmt = toDecimal(rawItem.discount_amount || rawItem.discountAmount || allocatedDiscount);
      const discAmt2 = toDecimal(rawItem.discount_amount);
      const lineTotal = lineSubtotal - discAmt;
      const price2 = rawItem.price;
      const sumAmount2 = rawItem.sum_amount;
      const itemCode = rawItem.item_code || rawItem.id || rawItem.ic_code || rawItem.barcode || "";
      const averageCost = toDecimal(rawItem.average_cost || avgCostMap[itemCode as string] || 0);
      // SML convention: sum_of_cost is the TOTAL line cost (unit avg cost x qty),
      // matching what the ERP's cost recalculation writes back.
      const lineCost = Math.round(averageCost * quantity * 100) / 100;
      await client.query(
        `INSERT INTO ic_trans_detail (
          trans_type, trans_flag, doc_date, doc_no, cust_code,
          item_code, item_name, unit_code, qty, price, discount,
          sum_amount, branch_code, wh_code, shelf_code, calc_flag,
          doc_time, inquiry_type, stand_value, divide_value, doc_date_calc,
          doc_time_calc, sum_of_cost, discount_amount, discount_amount_2,
          price_2, sum_amount_2, item_code_main, remark, doc_ref, price_exclude_vat, sum_amount_exclude_vat
        ) VALUES (2,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'00',$12,$13,-1,$14,'1',1,1,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)`,
        [
          44, docDate, docNo, custCode,
          itemCode,
          rawItem.item_name || rawItem.name || "",
          rawItem.unit_code || rawItem.unit || "EA",
          quantity, unitPrice,
          discAmt / Number(exchangeRate || 1),
          lineTotal, whCode, shelfCode, docTime, docDate, docTime,
          lineCost, discAmt, discAmt2,
          price2, sumAmount2,
          rawItem.item_main_code || rawItem.item_code || rawItem.id || "",
          rawItem.remark || "",
          body.orderId || docNo,
          lineTotal, lineTotal,
        ]
      );
    }

    // ic_inventory.balance_qty is the ERP's denormalised on-hand figure. No trigger
    // maintains it, so the sale has to deduct it here; the movement rows in
    // ic_trans_detail (calc_flag -1) already cover the computed stock balance.
    // Non-stock items (item_type 3/5) are skipped, matching the SML balance function.
    if (soldQtyByItem.size) {
      await client.query(
        `UPDATE ic_inventory SET balance_qty = COALESCE(balance_qty, 0) - v.qty
           FROM unnest($1::text[], $2::numeric[]) AS v(code, qty)
          WHERE ic_inventory.code = v.code AND COALESCE(ic_inventory.item_type, 0) NOT IN (3, 5)`,
        [[...soldQtyByItem.keys()], [...soldQtyByItem.values()]]
      );
    }

    if (paymentMethod !== "cash") {
      await client.query(
        `INSERT INTO cb_trans(trans_type, trans_flag, doc_date, doc_no, total_amount, total_net_amount,
          tranfer_amount, total_amount_pay, ap_ar_code, pay_type, doc_format_code, exchange_rate, currency_code)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [2, 44, docDate, docNo, totalAmount, totalAmount, totalAmount, totalAmount, custCode, 1, "SPOS", Number(exchangeRate || 1), "02"]
      );
      await client.query(
        `INSERT INTO cb_trans_detail(trans_type, trans_flag, doc_date, doc_no, trans_number, bank_code, bank_branch,
          amount, chq_due_date, doc_type, currency_code, exchange_rate, sum_amount_2)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [2, 44, docDate, docNo, "1010201", "1010201", "BCEL01", totalAmount2, docDate, 1, "02", Number(exchangeRate || 1), totalAmount]
      );
    } else {
      // Cash, in any mix of the currencies the ERP knows. Its own documents
      // fill this in one way (checked against 21k of its cash tenders):
      // cash_amount is what came in as baht, the base currency, and needs no
      // line of its own; total_other_currency is the baht value of everything
      // taken in another currency, and each of those currencies gets a
      // doc_type 19 line — trans_number its code, amount in that currency,
      // exchange_rate its rate to baht.
      const rate = Number(exchangeRate || 1);
      // What the customer handed over, per currency. The till sends this list;
      // a baht-only request (and the shop, which sends neither) still works.
      const rawTenders = Array.isArray(body.tenders)
        ? (body.tenders as Record<string, unknown>[])
        : bahtAmount > 0
          ? [{ currency_code: BASE_CURRENCY, amount: bahtAmount }]
          : [];
      const tenderCodes = [...new Set(
        rawTenders
          .map((t) => String(t.currency_code || t.code || "").trim())
          .filter((code) => code && code !== KIP_CURRENCY)
      )];
      // Rates come from erp_currency, never from the request: the books convert
      // at the ERP's rate whatever the counter bought the notes at.
      const tenderRates = await loadCurrencyRates(client, tenderCodes);

      // Each foreign tender settles as much of the bill as it is worth, capped
      // so the tenders never add up past the total; kip is last because it is
      // the currency the change is given in, and takes whatever is left.
      const appliedByCurrency = new Map<string, number>();
      let unsettled = totalAmount;
      for (const tender of rawTenders) {
        const code = String(tender.currency_code || tender.code || "").trim();
        const bahtPerUnit = tenderRates.get(code);
        if (!code || code === KIP_CURRENCY || !bahtPerUnit) continue;
        const applied = Math.min(Math.max(toDecimal(tender.amount), 0) * bahtPerUnit, unsettled);
        if (applied <= 0) continue;
        appliedByCurrency.set(code, (appliedByCurrency.get(code) ?? 0) + applied);
        unsettled -= applied;
      }
      const kipPaidInBaht = Math.max(unsettled, 0);
      if (kipPaidInBaht > 0) appliedByCurrency.set(KIP_CURRENCY, kipPaidInBaht);

      const bahtPaid = appliedByCurrency.get(BASE_CURRENCY) ?? 0;
      const otherCurrencyPaid = [...appliedByCurrency.entries()]
        .filter(([code]) => code !== BASE_CURRENCY)
        .reduce((sum, [, value]) => sum + value, 0);

      await client.query(
        `INSERT INTO cb_trans(trans_type, trans_flag, doc_date, doc_no, doc_ref, total_amount, total_net_amount,
          cash_amount, total_other_currency, total_amount_pay, ap_ar_code, pay_type, doc_format_code, exchange_rate)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [2, 44, docDate, docNo, (body.route_id as string) || (body.doc_ref as string) || "",
          totalAmount, totalAmount, bahtPaid, otherCurrencyPaid, totalAmount, custCode, 1, "SPOS", rate]
      );

      // One line per currency that is not the base one. Kip keeps the whole-kip
      // rounding the till and the customer see.
      for (const [code, appliedInBaht] of appliedByCurrency) {
        if (code === BASE_CURRENCY) continue;
        const bahtPerUnit = code === KIP_CURRENCY ? rate : tenderRates.get(code) ?? 0;
        if (!bahtPerUnit) continue;
        const amount = code === KIP_CURRENCY
          ? Math.round(appliedInBaht / bahtPerUnit)
          : Math.round((appliedInBaht / bahtPerUnit) * 100) / 100;
        if (amount <= 0) continue;
        await client.query(
          `INSERT INTO cb_trans_detail(trans_type, trans_flag, doc_date, doc_no, trans_number, bank_code, bank_branch,
            amount, chq_due_date, doc_type, currency_code, exchange_rate, sum_amount_2)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [2, 44, docDate, docNo, code, "", "", amount, docDate, 19, code, bahtPerUnit, appliedInBaht]
        );
      }
    }

    if (sumPoint > 0) {
      await client.query("UPDATE ar_customer SET point_balance = point_balance + $1 WHERE code = $2", [sumPoint, custCode]);
    }

    const safePayload = {
      orderId: docNo, total: toDecimal(body.total), subtotal: toDecimal(body.subtotal),
      discount: exchangeRate ? safeDiscount / Number(exchangeRate) : 0,
      exchange_rate: Number(exchangeRate || 1), baht_amount: bahtAmount, baht_rate: bahtRate,
      paymentType: paymentMethod,
      receivedAmount: toDecimal((body.receivedAmount as number) || (body.received as number) || totalAmount),
      change_amount: changeAmount, staff: saleCode, member: body.member,
      timestamp: new Date().toISOString(),
    };

    if (changeAmount > 0) {
      await ensureChangeLogTable();
      const receivedCurrency = bahtAmount > 0 ? "THB" : "LAK";
      const changeExchangeRate = bahtAmount > 0 ? bahtRate : Number(exchangeRate);
      await client.query(
        `INSERT INTO pos_change_log (doc_no, total_amount, received_amount, change_amount, payment_type, received_currency, exchange_rate, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
        // Kip throughout: received and change arrive in kip, so the total has to
        // be the kip figure too (totalAmount is baht, the ERP's base currency).
        [docNo, totalAmount2 || totalAmount, toDecimal((body.receivedAmount as number) || (body.received as number) || totalAmount2 || totalAmount), changeAmount, paymentMethod || "cash", receivedCurrency, changeExchangeRate || 0]
      );
    }
    if (bahtRate > 0) {
      await ensureFxRateTable();
      // Only when the rate actually moves. A row per bill had grown this to
      // 1,929 rows holding two distinct rates; readers take the latest row.
      await client.query(
        `INSERT INTO pos_fx_rates (base_currency, foreign_currency, rate, doc_no, created_at)
         SELECT $1, $2, $3, $4, NOW()
          WHERE NOT EXISTS (
            SELECT 1 FROM (SELECT rate FROM pos_fx_rates ORDER BY created_at DESC LIMIT 1) latest
             WHERE latest.rate = $3::numeric
          )`,
        ["LAK", "THB", bahtRate, docNo]
      );
    }
    await ensureSavedBillsTable();
    await client.query("INSERT INTO pos_saved_bills (payload, created_at) VALUES ($1, NOW())", [JSON.stringify(safePayload)]);

    await client.query("COMMIT");
    try { await notifyLineOnBill(docNo as string, custCode, itemsList as never[], totalAmount2 || totalAmount); } catch { /* ignore */ }
    return { success: true, doc_no: docNo as string, exchange_rate: Number(exchangeRate || 1) };
  } catch (exc) {
    await client.query("ROLLBACK").catch(() => {});
    // Log details server-side only — raw PG errors disclose schema to the client.
    console.error("Error saving POS bill:", exc);
    return { success: false, error: "Unable to save bill" };
  } finally {
    client.release();
  }
}

/** Baht value of one unit of each currency, straight from the ERP's own table. */
async function loadCurrencyRates(client: PoolClient, codes: string[]): Promise<Map<string, number>> {
  const rates = new Map<string, number>();
  if (!codes.length) return rates;
  const res = await client.query(
    "SELECT code, exchange_rate_present FROM erp_currency WHERE btrim(code) = ANY($1)",
    [codes]
  );
  for (const row of res.rows) {
    const rate = toDecimal(row.exchange_rate_present);
    if (rate > 0) rates.set(String(row.code).trim(), rate);
  }
  return rates;
}

export type CancelBillResult = { success: boolean; error?: string };

/**
 * Voids a saved POS sale. Three things have to move together, because the ERP
 * keeps stock in two places: ic_inventory.balance_qty is the denormalised
 * on-hand the sale deducts by hand, while the balance SML computes comes from
 * ic_trans_detail — and its function reads those rows with no reference to the
 * header, filtering on last_status = 0 alone. So is_cancel on the header does
 * not give the stock back on its own; the movement rows have to be retired too.
 */
export async function cancelBillAction(docNoRaw: string, reasonRaw: string): Promise<CancelBillResult> {
  const session = await requireSession();
  const docNo = (docNoRaw || "").trim();
  const reason = (reasonRaw || "").trim();
  if (!docNo) return { success: false, error: "ບໍ່ໄດ້ລະບຸເລກບິນ" };
  if (!reason) return { success: false, error: "ກະລຸນາລະບຸເຫດຜົນການຍົກເລີກ" };

  await ensureCancelledBillsTable();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const head = await client.query(
      `SELECT doc_no, cust_code, COALESCE(sum_point, 0) AS sum_point,
              COALESCE(total_amount_2, total_amount, 0) AS total, COALESCE(is_cancel, 0) AS is_cancel
         FROM ic_trans
        WHERE doc_no = $1 AND trans_flag = 44 AND doc_format_code = 'SPOS'
        FOR UPDATE`,
      [docNo]
    );
    const bill = head.rows[0];
    if (!bill) {
      await client.query("ROLLBACK");
      return { success: false, error: `ບໍ່ພົບບິນ ${docNo}` };
    }
    if (Number(bill.is_cancel) === 1) {
      await client.query("ROLLBACK");
      return { success: false, error: `ບິນ ${docNo} ຖືກຍົກເລີກໄປແລ້ວ` };
    }

    // Give the on-hand figure back, skipping non-stock items exactly as the sale
    // skipped them when it deducted.
    await client.query(
      `UPDATE ic_inventory SET balance_qty = COALESCE(balance_qty, 0) + v.qty
         FROM (SELECT item_code AS code, SUM(qty) AS qty FROM ic_trans_detail WHERE doc_no = $1 GROUP BY item_code) v
        WHERE ic_inventory.code = v.code AND COALESCE(ic_inventory.item_type, 0) NOT IN (3, 5)`,
      [docNo]
    );
    // Retire the movement rows so SML's computed balance stops counting the sale.
    await client.query("UPDATE ic_trans_detail SET last_status = 1 WHERE doc_no = $1", [docNo]);

    const sumPoint = toDecimal(bill.sum_point);
    if (sumPoint > 0 && bill.cust_code) {
      await client.query(
        "UPDATE ar_customer SET point_balance = GREATEST(COALESCE(point_balance, 0) - $1, 0) WHERE code = $2",
        [sumPoint, bill.cust_code]
      );
    }

    await client.query("DELETE FROM cb_trans_detail WHERE doc_no = $1", [docNo]);
    await client.query("DELETE FROM cb_trans WHERE doc_no = $1", [docNo]);

    await client.query(
      `UPDATE ic_trans SET is_cancel = 1, cancel_code = $2, cancel_datetime = NOW() WHERE doc_no = $1`,
      [docNo, session.code || ""]
    );
    await client.query(
      "INSERT INTO pos_cancelled_bills (doc_no, reason, cancelled_by, total) VALUES ($1, $2, $3, $4)",
      [docNo, reason, session.code || "", toDecimal(bill.total)]
    );

    await client.query("COMMIT");
    return { success: true };
  } catch (exc) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Error cancelling POS bill:", exc);
    return { success: false, error: "ຍົກເລີກບິນບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }
}

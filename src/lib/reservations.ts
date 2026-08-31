/**
 * Stock promised to orders that have not been handed over yet.
 *
 * There is no reservation table: a reservation *is* an open order, so it
 * appears when the order is placed and is released the moment the order is
 * picked or cancelled — nothing to reconcile, and nothing left holding stock
 * after a crash. Both order books count, since either can be pulled into the
 * till for pickup.
 */
export const OPEN_ORDER_STATUSES = ["pending", "ready"];

/**
 * SQL yielding (code, qty) per reserved item. `excludeParam` is the placeholder
 * holding an order number to leave out — the till passes the order it is
 * ringing up, whose own reservation must not block its sale; pass '' for none.
 */
export function openOrderReservationsSql(excludeParam: string): string {
  const perTable = (table: string) => `
    SELECT btrim(COALESCE(i->>'id', i->>'item_code', i->>'ic_code', i->>'barcode', '')) AS code,
           CASE WHEN i->>'quantity' ~ '^[0-9]+(\\.[0-9]+)?$' THEN (i->>'quantity')::numeric ELSE 0 END AS qty
      FROM ${table} o
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(o.items) = 'array' THEN o.items ELSE '[]'::jsonb END
      ) i
     WHERE lower(o.status) IN ('pending', 'ready')
       AND (${excludeParam} = '' OR o.order_no <> ${excludeParam})`;
  return `SELECT code, SUM(qty) AS qty
            FROM (${perTable("pos_shop_orders")} UNION ALL ${perTable("pos_online_orders")}) r
           WHERE code <> ''
           GROUP BY code`;
}

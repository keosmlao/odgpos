"use server";

import { runQuery } from "@/lib/db";
import { ensurePromotionsTable } from "@/lib/tables";
import {
  normalizePromotionPayload,
  normalizePromotionRecord,
  promotionMatchesCode,
  promotionMatchesQuery,
} from "@/lib/promotions";

type Row = Record<string, unknown>;
type ItemLike = { lookup_code?: unknown; barcode?: unknown; item_code?: unknown; name?: unknown };

const resolveItemNames = async (rows: Row[]) => {
  const codes = new Set<string>();
  for (const row of rows) {
    const buyItems = Array.isArray(row.buy_items) ? row.buy_items : [];
    const giftItems = Array.isArray(row.gift_items) ? row.gift_items : [];
    for (const item of [...buyItems, ...giftItems] as ItemLike[]) {
      const code = String(item?.lookup_code || item?.barcode || item?.item_code || "").trim();
      if (code) codes.add(code);
    }
    if (row.item_code) codes.add(String(row.item_code));
    if (row.gift_code) codes.add(String(row.gift_code));
  }
  if (codes.size === 0) return {};
  const codeList = Array.from(codes);
  const placeholders = codeList.map((_, i) => `$${i + 1}`).join(",");
  try {
    const result = (await runQuery(
      `SELECT code, name_1 FROM ic_inventory WHERE code IN (${placeholders})`,
      codeList
    )) as { code: string; name_1: string }[];
    const map: Record<string, string> = {};
    for (const r of result) if (r.code && r.name_1) map[String(r.code)] = String(r.name_1);
    return map;
  } catch {
    return {};
  }
};

const enrichItems = (items: unknown[] | unknown, nameMap: Record<string, string>) => {
  if (!Array.isArray(items)) return items;
  return items.map((item: ItemLike) => {
    const code = String(item?.lookup_code || item?.barcode || item?.item_code || "");
    const existingName = String(item?.name || "");
    const resolved = nameMap[code];
    if (resolved && (!existingName || existingName === code)) return { ...item, name: resolved };
    return item;
  });
};

export async function listPromotionsAction(query = "", options: { activeOnly?: boolean } = {}): Promise<Row[]> {
  await ensurePromotionsTable();
  const baseSql = options.activeOnly
    ? `SELECT id, item_code, barcode, promo_type, gift_code, gift_qty, buy_items, gift_items, rule_config,
              start_date, end_date, is_active, created_at, updated_at
         FROM pos_promotions
         WHERE is_active = TRUE
           AND (start_date IS NULL OR start_date <= CURRENT_DATE)
           AND (end_date IS NULL OR end_date >= CURRENT_DATE)
         ORDER BY updated_at DESC, id DESC;`
    : `SELECT id, item_code, barcode, promo_type, gift_code, gift_qty, buy_items, gift_items, rule_config,
              start_date, end_date, is_active, created_at, updated_at
         FROM pos_promotions
         ORDER BY updated_at DESC, id DESC;`;
  const rows = (await runQuery(baseSql)) as Row[];
  const normalizedRows = rows.map((row) => normalizePromotionRecord(row));
  const nameMap = await resolveItemNames(normalizedRows as Row[]);
  const enrichedRows = normalizedRows.map((row: Row) => ({
    ...row,
    buy_items: enrichItems(row.buy_items as unknown[], nameMap),
    gift_items: enrichItems(row.gift_items as unknown[], nameMap),
  }));
  const trimmedQuery = (query || "").trim();
  return enrichedRows.filter((row) => promotionMatchesQuery(row, trimmedQuery));
}

export async function lookupPromotionAction(codeRaw: string): Promise<Row> {
  await ensurePromotionsTable();
  const code = (codeRaw || "").trim();
  if (!code) return {};
  const rows = (await runQuery(
    `SELECT id, item_code, barcode, promo_type, gift_code, gift_qty, buy_items, gift_items, rule_config,
            start_date, end_date, is_active, created_at, updated_at
       FROM pos_promotions
       WHERE is_active = TRUE
         AND (start_date IS NULL OR start_date <= CURRENT_DATE)
         AND (end_date IS NULL OR end_date >= CURRENT_DATE)
       ORDER BY updated_at DESC, id DESC;`
  )) as Row[];
  const match = rows.map((row) => normalizePromotionRecord(row)).find((row) => promotionMatchesCode(row, code));
  return (match as Row) || {};
}

export async function createPromotionAction(body: Row): Promise<Row> {
  await ensurePromotionsTable();
  const payload = normalizePromotionPayload(body);
  if (!payload.promo_type) throw new Error("promo_type is required");
  if (!payload.buy_items.length) throw new Error("buy_items is required");
  if (!payload.gift_items.length) throw new Error("gift_items is required");
  const row = (await runQuery(
    `INSERT INTO pos_promotions (item_code, barcode, promo_type, gift_code, gift_qty, start_date, end_date, is_active, buy_items, gift_items, rule_config)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb)
     RETURNING id, item_code, barcode, promo_type, gift_code, gift_qty, buy_items, gift_items, rule_config, start_date, end_date, is_active, created_at, updated_at;`,
    [
      payload.item_code, payload.barcode, payload.promo_type, payload.gift_code, payload.gift_qty || 1,
      payload.start_date, payload.end_date, payload.is_active,
      JSON.stringify(payload.buy_items), JSON.stringify(payload.gift_items), JSON.stringify(payload.rule_config),
    ],
    "one"
  )) as Row;
  return normalizePromotionRecord(row);
}

export async function updatePromotionAction(promoId: number | string, body: Row): Promise<Row> {
  await ensurePromotionsTable();
  const payload = normalizePromotionPayload(body);
  if (!payload.promo_type) throw new Error("promo_type is required");
  if (!payload.buy_items.length) throw new Error("buy_items is required");
  if (!payload.gift_items.length) throw new Error("gift_items is required");
  const row = (await runQuery(
    `UPDATE pos_promotions SET item_code=$1, barcode=$2, promo_type=$3, gift_code=$4, gift_qty=$5,
       start_date=$6, end_date=$7, is_active=$8, buy_items=$9::jsonb, gift_items=$10::jsonb, rule_config=$11::jsonb, updated_at=NOW()
     WHERE id=$12
     RETURNING id, item_code, barcode, promo_type, gift_code, gift_qty, buy_items, gift_items, rule_config, start_date, end_date, is_active, created_at, updated_at;`,
    [
      payload.item_code, payload.barcode, payload.promo_type, payload.gift_code, payload.gift_qty || 1,
      payload.start_date, payload.end_date, payload.is_active,
      JSON.stringify(payload.buy_items), JSON.stringify(payload.gift_items), JSON.stringify(payload.rule_config),
      parseInt(String(promoId)),
    ],
    "one"
  )) as Row | null;
  if (!row) throw new Error("Promotion not found");
  return normalizePromotionRecord(row);
}

export async function deletePromotionAction(promoId: number | string): Promise<{ success: true }> {
  await ensurePromotionsTable();
  const row = await runQuery(
    "DELETE FROM pos_promotions WHERE id = $1 RETURNING id",
    [parseInt(String(promoId))],
    "one"
  );
  if (!row) throw new Error("Promotion not found");
  return { success: true };
}

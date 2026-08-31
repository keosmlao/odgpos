"use server";

import { runQuery } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { ensureFxRateTable } from "@/lib/tables";

type Row = Record<string, unknown>;

export async function getFxRatesAction(limit = 10): Promise<Row[]> {
  await requireSession();
  await ensureFxRateTable();
  const n = Math.min(Math.max(Number(limit) || 10, 1), 50);
  return (await runQuery(
    `SELECT id, base_currency, foreign_currency, rate, doc_no, created_at::text AS created_at
       FROM pos_fx_rates ORDER BY created_at DESC LIMIT $1`,
    [n]
  )) as Row[];
}

export type ErpCurrency = { code: string; name: string; kipPerUnit: number };

/**
 * The currencies the till can take, priced in kip. erp_currency quotes every
 * currency against baht, the base, so a kip price is that quote divided by the
 * kip one: 33 baht to the dollar over 0.0014598 baht to the kip is 22,606 kip
 * to the dollar. Kip itself is left out — it is what the drawer counts in.
 */
export async function getErpCurrenciesAction(): Promise<ErpCurrency[]> {
  await requireSession();
  const rows = (await runQuery(
    "SELECT code, name_1, exchange_rate_present FROM erp_currency ORDER BY code"
  )) as { code?: unknown; name_1?: unknown; exchange_rate_present?: unknown }[];
  const bahtPerKip = Number(
    rows.find((r) => String(r.code ?? "").trim() === "02")?.exchange_rate_present
  );
  if (!isFinite(bahtPerKip) || bahtPerKip <= 0) return [];
  return rows
    .map((r) => {
      const bahtPerUnit = Number(r.exchange_rate_present);
      return {
        code: String(r.code ?? "").trim(),
        name: String(r.name_1 ?? "").trim(),
        kipPerUnit: isFinite(bahtPerUnit) && bahtPerUnit > 0 ? Math.round(bahtPerUnit / bahtPerKip) : 0,
      };
    })
    .filter((c) => c.code && c.code !== "02" && c.kipPerUnit > 0);
}

/**
 * Kip per baht, as the ERP itself values them. erp_currency holds the rate the
 * other way round — baht per kip, on the kip row ('02'), baht being the base
 * currency — and every document is converted with it, so the till has to buy
 * baht at the same rate or the drawer and the books drift apart.
 */
export async function getErpThbRateAction(): Promise<{ rate: number | null }> {
  await requireSession();
  const row = (await runQuery(
    "SELECT exchange_rate_present FROM erp_currency WHERE code = '02' LIMIT 1",
    [],
    "one"
  )) as { exchange_rate_present?: unknown } | null;
  const bahtPerKip = Number(row?.exchange_rate_present);
  if (!isFinite(bahtPerKip) || bahtPerKip <= 0) return { rate: null };
  return { rate: Math.round(1 / bahtPerKip) };
}

/** Record a new LAK-per-THB rate; reports and the POS pick up the latest row. */
export async function setFxRateAction(rateRaw: number): Promise<{ success: true; rate: number }> {
  const session = await requireSession();
  const rate = Number(rateRaw);
  if (!isFinite(rate) || rate <= 0 || rate > 100000) throw new Error("Invalid rate");
  await ensureFxRateTable();
  await runQuery(
    "INSERT INTO pos_fx_rates (base_currency, foreign_currency, rate, doc_no, created_at) VALUES ($1,$2,$3,$4,NOW())",
    ["LAK", "THB", rate, `MANUAL-${session.code}`],
    "none"
  );
  return { success: true, rate };
}

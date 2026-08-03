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

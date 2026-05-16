import { runQuery } from "./db";
import { ensureLineRecipientsTable } from "./tables";
import { formatMoney } from "./utils";

const LINE_OA_TOKEN = process.env.LINE_OA_TOKEN;

export async function sendLineMessage(lineUserId: string, text: string) {
  if (!LINE_OA_TOKEN || !lineUserId || !text) return;
  try {
    await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LINE_OA_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: "text", text }],
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // silently ignore
  }
}

async function fetchCustomerInfo(custCode: string) {
  if (!custCode) return { name: "", phone: "", line_id: "" };
  try {
    const row = await runQuery<Record<string, string>>(
      "SELECT name_1, telephone, line_id FROM ar_customer WHERE code = $1",
      [custCode],
      "one"
    );
    if (!row) return { name: "", phone: "", line_id: "" };
    return {
      name: row.name_1 || "",
      phone: row.telephone || "",
      line_id: row.line_id || "",
    };
  } catch {
    return { name: "", phone: "", line_id: "" };
  }
}

interface BillItem {
  item_name?: string;
  name?: string;
  ic_name?: string;
  quantity?: number;
  qty?: number;
  price?: number;
}

export async function notifyLineOnBill(
  docNo: string,
  custCode: string,
  itemsList: BillItem[],
  totalAmount: number
) {
  if (!LINE_OA_TOKEN) return;
  await ensureLineRecipientsTable();
  let recipients: Record<string, unknown>[] = [];
  try {
    recipients = (await runQuery(
      "SELECT line_user_id, notify_customer FROM pos_line_recipients WHERE active = TRUE"
    )) as Record<string, unknown>[];
  } catch {
    recipients = [];
  }
  const customer = await fetchCustomerInfo(custCode);
  const lines: string[] = ["\u{1F4CC} \u0EC1\u0E88\u0EC9\u0E87\u0EC0\u0E95\u0EB7\u0EAD\u0E99\u0EAD\u0EAD\u0E81\u0E9A\u0EB4\u0E99", `\u0E9A\u0EB4\u0E99: ${docNo}`];
  if (customer.name || customer.phone) {
    lines.push(`\u0EA5\u0EB9\u0E81\u0E84\u0EC9\u0EB2: ${customer.name || "-"} ${customer.phone || ""}`.trim());
  }
  lines.push("\u0EA5\u0EB2\u0E8D\u0E81\u0EB2\u0E99:");
  for (const item of itemsList) {
    const name = item.item_name || item.name || item.ic_name || "";
    const qty = item.quantity || item.qty || 0;
    const price = item.price || 0;
    lines.push(`- ${name} x${qty} @${formatMoney(price)}`);
  }
  lines.push(`\u0EA5\u0EA7\u0EA1: ${formatMoney(totalAmount)} \u0E81\u0EB5\u0E9A`);
  const message = lines.filter(Boolean).join("\n");

  for (const rec of recipients) {
    await sendLineMessage(rec.line_user_id as string, message);
    if (rec.notify_customer && customer.line_id) {
      await sendLineMessage(customer.line_id, message);
    }
  }
}

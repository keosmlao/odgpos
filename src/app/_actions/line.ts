"use server";

import { runQuery } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { ensureLineRecipientsTable } from "@/lib/tables";

type Row = Record<string, unknown>;

export async function getLineRecipientsAction(): Promise<Row[]> {
  await requireSession();
  await ensureLineRecipientsTable();
  return (await runQuery(
    "SELECT id, name, line_user_id, recipient_type, staff_code, phone, active, notify_customer, created_at FROM pos_line_recipients ORDER BY created_at DESC"
  )) as Row[];
}

export async function getStaffLineUsersAction(): Promise<Row[]> {
  await requireSession();
  return (await runQuery(
    `SELECT trim(employee_code) AS code,
            COALESCE(NULLIF(trim(fullname_lo), ''), NULLIF(trim(nickname), ''), NULLIF(trim(fullname_en), ''), trim(employee_code)) AS name_1,
            NULLIF(trim(line_id), '') AS line_id
       FROM odg_employee
      WHERE COALESCE(employment_status, 'ACTIVE') = 'ACTIVE'
      ORDER BY name_1`
  )) as Row[];
}

function readPayload(data: Row) {
  const name = String(data.name || "").trim();
  const lineUserId = String(data.line_user_id || "").trim();
  const recipientType = String(data.recipient_type || "staff").trim().toLowerCase();
  const staffCode = String(data.staff_code || "").trim() || null;
  const phone = String(data.phone || "").trim() || null;
  const active = data.active !== false;
  const notifyCustomer = !!data.notify_customer;
  if (recipientType !== "staff") throw new Error("Invalid recipient_type");
  if (!name || !lineUserId || (recipientType === "staff" && !staffCode)) {
    throw new Error("Missing name or line_user_id");
  }
  return { name, lineUserId, recipientType, staffCode, phone, active, notifyCustomer };
}

export async function createLineRecipientAction(data: Row): Promise<Row> {
  await requireSession();
  await ensureLineRecipientsTable();
  const p = readPayload(data);
  return (await runQuery(
    `INSERT INTO pos_line_recipients (name, line_user_id, recipient_type, staff_code, phone, active, notify_customer)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, line_user_id, recipient_type, staff_code, phone, active, notify_customer, created_at`,
    [p.name, p.lineUserId, p.recipientType, p.staffCode, p.phone, p.active, p.notifyCustomer],
    "one"
  )) as Row;
}

export async function updateLineRecipientAction(id: number | string, data: Row): Promise<Row> {
  await requireSession();
  await ensureLineRecipientsTable();
  const p = readPayload(data);
  const row = (await runQuery(
    `UPDATE pos_line_recipients SET name=$1, line_user_id=$2, recipient_type=$3, staff_code=$4,
       phone=$5, active=$6, notify_customer=$7, updated_at=NOW()
     WHERE id=$8
     RETURNING id, name, line_user_id, recipient_type, staff_code, phone, active, notify_customer, created_at`,
    [p.name, p.lineUserId, p.recipientType, p.staffCode, p.phone, p.active, p.notifyCustomer, parseInt(String(id))],
    "one"
  )) as Row | null;
  if (!row) throw new Error("Recipient not found");
  return row;
}

export async function deleteLineRecipientAction(id: number | string): Promise<{ success: true; id: unknown }> {
  await requireSession();
  await ensureLineRecipientsTable();
  const row = (await runQuery(
    "DELETE FROM pos_line_recipients WHERE id = $1 RETURNING id",
    [parseInt(String(id))],
    "one"
  )) as Row | null;
  if (!row) throw new Error("Recipient not found");
  return { success: true, id: row.id };
}

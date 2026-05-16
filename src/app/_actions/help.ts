"use server";

import { runQuery } from "@/lib/db";
import { ensureHelpContentTable } from "@/lib/tables";
import { HELP_FALLBACK, normalizeHelpSections, normalizeHelpContact } from "@/lib/utils";

type Row = Record<string, unknown>;

export async function getHelpAction(): Promise<Row> {
  await ensureHelpContentTable();
  const row = (await runQuery(
    "SELECT title, subtitle, sections, contact, updated_at FROM pos_help_content WHERE id = 1",
    [], "one"
  )) as Row | null;
  if (!row) return HELP_FALLBACK as unknown as Row;
  return {
    title: row.title || HELP_FALLBACK.title,
    subtitle: row.subtitle || HELP_FALLBACK.subtitle,
    sections: normalizeHelpSections(row.sections),
    contact: normalizeHelpContact(row.contact),
    updated_at: row.updated_at,
  };
}

export async function saveHelpAction(payload: Row): Promise<Row> {
  await ensureHelpContentTable();
  const title = String(payload.title || HELP_FALLBACK.title).trim();
  const subtitle = String(payload.subtitle || HELP_FALLBACK.subtitle).trim();
  const sections = normalizeHelpSections(payload.sections);
  const contact = normalizeHelpContact(payload.contact);
  return (await runQuery(
    `INSERT INTO pos_help_content (id, title, subtitle, sections, contact, updated_at)
     VALUES (1, $1, $2, $3, $4, NOW())
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title, subtitle = EXCLUDED.subtitle,
       sections = EXCLUDED.sections, contact = EXCLUDED.contact, updated_at = NOW()
     RETURNING id, title, subtitle, sections, contact, updated_at`,
    [title, subtitle, JSON.stringify(sections), JSON.stringify(contact)],
    "one"
  )) as Row;
}

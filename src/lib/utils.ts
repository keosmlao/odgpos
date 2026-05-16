export function formatMoney(value: unknown): string {
  try {
    const num = Number(value);
    if (!isFinite(num)) return String(value);
    return Math.round(num).toLocaleString("en-US");
  } catch {
    return String(value);
  }
}

export function formatQty(value: unknown): string {
  try {
    const num = Number(value);
    if (!isFinite(num)) return String(value);
    if (Number.isInteger(num)) return num.toLocaleString("en-US");
    return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return String(value);
  }
}

interface HelpSection {
  id?: string;
  title?: string;
  items?: unknown[];
}

interface HelpContact {
  label?: string;
  phone?: string;
  line?: string;
}

export const HELP_FALLBACK = {
  title: "\u0EAA\u0EB9\u0E99\u0E8A\u0EC8\u0EA7\u0E8D\u0EC0\u0EAB\u0EBC\u0EB7\u0EAD POS",
  subtitle: "\u0E84\u0EB9\u0EC8\u0EA1\u0EB7\u0E81\u0EB2\u0E99\u0EC3\u0E8A\u0EC9\u0E87\u0EB2\u0E99\u0E9E\u0EB7\u0EC9\u0E99\u0E96\u0EB2\u0E99 \u0EC1\u0EA5\u0EB0 \u0E84\u0ECD\u0EC1\u0E99\u0EB0\u0E99\u0ECD\u0EB2\u0E94\u0EC8\u0EA7\u0E99",
  sections: [
    { id: "pos", title: "\u0E82\u0EB1\u0EC9\u0E99\u0E95\u0EAD\u0E99\u0E82\u0EB2\u0E8D (POS)", items: ["\u0EC0\u0E82\u0EBB\u0EC9\u0EB2\u0EA5\u0EB0\u0E9A\u0EBB\u0E9A\u0E94\u0EC9\u0EA7\u0E8D\u0E9A\u0EB1\u0E99\u0E8A\u0EB5\u0E82\u0EAD\u0E87\u0E97\u0EC8\u0EB2\u0E99", "\u0EC0\u0EA5\u0EB7\u0EAD\u0E81\u0E9E\u0EB0\u0E99\u0EB1\u0E81\u0E87\u0EB2\u0E99\u0E82\u0EB2\u0E8D \u0EC1\u0EA5\u0EB0 \u0EA5\u0EB9\u0E81\u0E84\u0EC9\u0EB2 (\u0E96\u0EC9\u0EB2\u0EA1\u0EB5)", "\u0E84\u0EBB\u0EC9\u0E99\u0EAB\u0EB2\u0EAA\u0EB4\u0E99\u0E84\u0EC9\u0EB2\u0E94\u0EC9\u0EA7\u0E8D\u0E9A\u0EB2\u0EC2\u0E84\u0E94 \u0EAB\u0EBC\u0EB7 \u0E8A\u0EB7\u0EC8", "\u0E81\u0EA7\u0E94\u0EAA\u0EAD\u0E9A\u0EA5\u0EB2\u0E84\u0EB2/\u0E88\u0ECD\u0EB2\u0E99\u0EA7\u0E99 \u0EC1\u0EA5\u0EB0 \u0E81\u0EBB\u0E94\u0E8A\u0ECD\u0EB2\u0EA5\u0EB0\u0EC0\u0E87\u0EB4\u0E99", "\u0E81\u0EA7\u0E94\u0EAA\u0EAD\u0E9A\u0E9A\u0EB4\u0E99 \u0EC1\u0EA5\u0EB0 \u0EAA\u0EBB\u0EC8\u0E87/\u0E9E\u0EB4\u0EA1\u0EC3\u0EAB\u0EC9\u0EA5\u0EB9\u0E81\u0E84\u0EC9\u0EB2"] },
    { id: "manage", title: "\u0EAB\u0E99\u0EC9\u0EB2\u0E88\u0EB1\u0E94\u0E81\u0EB2\u0E99", items: ["\u0E88\u0EB1\u0E94\u0E81\u0EB2\u0E99\u0E9C\u0EB9\u0EC9\u0EAE\u0EB1\u0E9A LINE \u0EC1\u0E88\u0EC9\u0E87\u0EC0\u0E95\u0EB7\u0EAD\u0E99", "\u0E95\u0EB1\u0EC9\u0E87\u0E84\u0EC8\u0EB2\u0EC2\u0E9B\u0EA3\u0EC2\u0EA1\u0E8A\u0EB1\u0E99 (\u0E8A\u0EB7\u0EC9 1 \u0EC1\u0E96\u0EA1 1 / \u0E82\u0EAD\u0E87\u0EC1\u0E96\u0EA1)", "\u0EC0\u0E9E\u0EB5\u0EC8\u0EA1 \u0EAB\u0EBC\u0EB7 \u0EC1\u0E81\u0EC9\u0EC4\u0E82\u0EAE\u0EB9\u0E9A\u0E9E\u0EB2\u0E9A\u0EAA\u0EB4\u0E99\u0E84\u0EC9\u0EB2"] },
    { id: "shop", title: "\u0EAE\u0EC9\u0EB2\u0E99\u0EAD\u0EAD\u0E99\u0EC4\u0EA5\u0E99\u0ECC", items: ["\u0EC1\u0E9A\u0EC8\u0E87\u0E9B\u0EB1\u0E99\u0EA5\u0EB4\u0EC9\u0E87\u0EAB\u0E99\u0EC9\u0EB2\u0EAE\u0EC9\u0EB2\u0E99\u0EC3\u0EAB\u0EC9\u0EA5\u0EB9\u0E81\u0E84\u0EC9\u0EB2", "\u0E95\u0EB4\u0E94\u0E95\u0EB2\u0EA1\u0EAD\u0ECD\u0EC0\u0E94\u0EB5\u0E97\u0EB5\u0EC8\u0EAB\u0E99\u0EC9\u0EB2\u0E95\u0EB4\u0E94\u0E95\u0EB2\u0EA1\u0E84\u0ECD\u0EB2\u0EAA\u0EB1\u0EC8\u0E87\u0E8A\u0EB7\u0EC9", "\u0EAD\u0EB1\u0E9A\u0EC0\u0E94\u0E94\u0EAA\u0EB0\u0E96\u0EB2\u0E99\u0EB0\u0EAD\u0ECD\u0EC0\u0E94\u0EB5\u0E95\u0EB2\u0EA1\u0E81\u0EB2\u0E99\u0E88\u0EB1\u0E94\u0EAA\u0EBB\u0EC8\u0E87"] },
    { id: "support", title: "\u0E81\u0EB2\u0E99\u0EC1\u0E81\u0EC9\u0EC4\u0E82\u0E9A\u0EB1\u0E99\u0EAB\u0EB2", items: ["\u0E81\u0EA7\u0E94\u0EAA\u0EAD\u0E9A\u0EAD\u0EB4\u0E99\u0EC0\u0E95\u0EB5\u0EC0\u0E99\u0EB1\u0E94 \u0EC1\u0EA5\u0EB0 \u0EA5\u0EAD\u0E87\u0EC2\u0EAB\u0EBC\u0E94\u0EC3\u0EAB\u0EA1\u0EC8", "\u0E96\u0EC9\u0EB2\u0EA5\u0EB0\u0E9A\u0EBB\u0E9A\u0E8A\u0EC9\u0EB2 \u0E81\u0EB0\u0EA5\u0EB8\u0E99\u0EB2\u0EA5\u0EAD\u0E87\u0E9B\u0EB4\u0E94-\u0EC0\u0E9B\u0EB5\u0E94\u0EC1\u0EAD\u0EB1\u0E9A", "\u0E95\u0EB4\u0E94\u0E95\u0ECD\u0EC8\u0E9C\u0EB9\u0EC9\u0E94\u0EB9\u0EC1\u0EA5\u0EA5\u0EB0\u0E9A\u0EBB\u0E9A\u0E96\u0EC9\u0EB2\u0E9E\u0EBB\u0E9A\u0E82\u0ECD\u0EC9\u0E9C\u0EB4\u0E94\u0E9E\u0EB2\u0E94"] },
  ],
  contact: { label: "\u0E95\u0EB4\u0E94\u0E95\u0ECD\u0EC8\u0E9C\u0EB9\u0EC9\u0E94\u0EB9\u0EC1\u0EA5\u0EA5\u0EB0\u0E9A\u0EBB\u0E9A", phone: "", line: "" },
};

export function normalizeHelpSections(rawSections: unknown): HelpSection[] {
  if (!Array.isArray(rawSections)) return HELP_FALLBACK.sections;
  const normalized: HelpSection[] = [];
  rawSections.forEach((section, idx) => {
    if (!section || typeof section !== "object") return;
    const s = section as Record<string, unknown>;
    const title = String(s.title || "").trim();
    const itemsRaw = Array.isArray(s.items) ? s.items : [];
    const items = itemsRaw.map((i) => String(i).trim()).filter(Boolean);
    normalized.push({
      id: String(s.id || `section-${idx + 1}`),
      title: title || `Section ${idx + 1}`,
      items,
    });
  });
  return normalized.length ? normalized : HELP_FALLBACK.sections;
}

export function normalizeHelpContact(rawContact: unknown): HelpContact {
  if (!rawContact || typeof rawContact !== "object") return HELP_FALLBACK.contact;
  const c = rawContact as Record<string, unknown>;
  return {
    label: String(c.label || HELP_FALLBACK.contact.label),
    phone: String(c.phone || ""),
    line: String(c.line || ""),
  };
}

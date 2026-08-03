"use server";

import { runQuery } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { ensureProductImagesTable } from "@/lib/tables";
import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

type Row = Record<string, unknown>;

export async function listProductImagesAction(icCodeRaw = ""): Promise<Row[]> {
  await ensureProductImagesTable();
  const icCode = (icCodeRaw || "").trim();
  let sql = "SELECT id, ic_code, file_name, file_path, created_at FROM pos_product_images WHERE 1=1";
  const params: unknown[] = [];
  if (icCode) {
    sql += " AND ic_code = $1";
    params.push(icCode);
  }
  sql += " ORDER BY created_at DESC LIMIT 200";
  const rows = (await runQuery(sql, params)) as Row[];
  for (const row of rows) {
    const basename = path.basename((row.file_path as string) || (row.file_name as string) || "");
    row.file_url = basename ? `/uploads/${basename}` : "";
  }
  return rows;
}

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export async function uploadProductImageAction(formData: FormData): Promise<Row> {
  await requireSession();
  await ensureProductImagesTable();
  const icCode = ((formData.get("ic_code") as string) || "").trim();
  if (!icCode) throw new Error("Missing ic_code");
  const file = formData.get("file") as File | null;
  if (!file || !file.name) throw new Error("Missing file");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("File too large (max 5MB)");

  const uploadDir = process.env.UPLOAD_DIR || "public/uploads";
  await mkdir(uploadDir, { recursive: true });
  const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  // Images only — an uploaded .html/.svg would be served from our origin (stored XSS).
  if (!IMAGE_EXTENSIONS.has(path.extname(filename).toLowerCase())) {
    throw new Error("Only image files are allowed (jpg, png, gif, webp, avif)");
  }
  const savePath = path.join(uploadDir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(savePath, buffer);

  const row = (await runQuery(
    `INSERT INTO pos_product_images (ic_code, file_name, file_path)
     VALUES ($1, $2, $3) RETURNING id, ic_code, file_name, file_path, created_at`,
    [icCode, filename, savePath],
    "one"
  )) as Row;
  if (row) row.file_url = `/uploads/${path.basename((row.file_path as string) || filename)}`;
  return row;
}

export async function deleteProductImageAction(id: number | string): Promise<{ success: true }> {
  await requireSession();
  await ensureProductImagesTable();
  const row = (await runQuery(
    "SELECT file_path FROM pos_product_images WHERE id = $1",
    [parseInt(String(id))],
    "one"
  )) as { file_path?: string } | null;
  if (!row) throw new Error("Not found");
  await runQuery("DELETE FROM pos_product_images WHERE id = $1", [parseInt(String(id))], "none");
  try {
    let filePath = row.file_path || "";
    if (filePath && !path.isAbsolute(filePath)) {
      filePath = path.join(process.env.UPLOAD_DIR || "public/uploads", path.basename(filePath));
    }
    if (filePath && existsSync(filePath)) await unlink(filePath);
  } catch { /* ignore */ }
  return { success: true };
}

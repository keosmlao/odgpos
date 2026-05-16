import { Pool, QueryResultRow } from "pg";

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || "5432"),
  max: 10,
  min: 1,
});

type FetchMode = "all" | "one" | "none";

export async function runQuery<T extends QueryResultRow = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
  fetch: FetchMode = "all"
): Promise<T[] | T | null> {
  const client = await pool.connect();
  try {
    const result = await client.query<T>(sql, params ?? []);
    if (fetch === "one") return result.rows[0] ?? null;
    if (fetch === "none") return null;
    return result.rows;
  } finally {
    client.release();
  }
}

export { pool };

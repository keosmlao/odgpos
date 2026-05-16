import { runQuery } from "./db";

export async function ensureLineRecipientsTable() {
  await runQuery(`CREATE TABLE IF NOT EXISTS pos_line_recipients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    line_user_id VARCHAR(255) NOT NULL,
    recipient_type VARCHAR(20) NOT NULL DEFAULT 'staff',
    staff_code VARCHAR(50),
    phone VARCHAR(50),
    active BOOLEAN DEFAULT TRUE,
    notify_customer BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );`, [], "none");
  await runQuery("ALTER TABLE pos_line_recipients ADD COLUMN IF NOT EXISTS recipient_type VARCHAR(20) NOT NULL DEFAULT 'staff'", [], "none");
  await runQuery("ALTER TABLE pos_line_recipients ADD COLUMN IF NOT EXISTS staff_code VARCHAR(50)", [], "none");
  await runQuery("ALTER TABLE pos_line_recipients ADD COLUMN IF NOT EXISTS notify_customer BOOLEAN DEFAULT FALSE", [], "none");
}

export async function ensureProductImagesTable() {
  await runQuery(`CREATE TABLE IF NOT EXISTS pos_product_images (
    id SERIAL PRIMARY KEY,
    ic_code VARCHAR(50) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );`, [], "none");
}

export async function ensureHelpContentTable() {
  await runQuery(`CREATE TABLE IF NOT EXISTS pos_help_content (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    sections JSONB NOT NULL DEFAULT '[]'::jsonb,
    contact JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP DEFAULT NOW()
  );`, [], "none");
}

export async function ensureMinimumStockTable() {
  await runQuery(`CREATE TABLE IF NOT EXISTS pos_minimum_stock (
    id SERIAL PRIMARY KEY,
    ic_code VARCHAR(50) NOT NULL,
    wh_code VARCHAR(20) NOT NULL DEFAULT '1105',
    location_code VARCHAR(20) NOT NULL DEFAULT '110501',
    min_qty NUMERIC(18, 4) NOT NULL DEFAULT 0,
    note TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );`, [], "none");
  await runQuery("ALTER TABLE pos_minimum_stock DROP CONSTRAINT IF EXISTS pos_minimum_stock_ic_code_key", [], "none");
  await runQuery("ALTER TABLE pos_minimum_stock ADD COLUMN IF NOT EXISTS wh_code VARCHAR(20) NOT NULL DEFAULT '1105'", [], "none");
  await runQuery("ALTER TABLE pos_minimum_stock ADD COLUMN IF NOT EXISTS location_code VARCHAR(20) NOT NULL DEFAULT '110501'", [], "none");
  await runQuery("UPDATE pos_minimum_stock SET wh_code = '1105' WHERE wh_code IS NULL OR wh_code = ''", [], "none");
  await runQuery("UPDATE pos_minimum_stock SET location_code = '110501' WHERE location_code IS NULL OR location_code = ''", [], "none");
  await runQuery(`CREATE UNIQUE INDEX IF NOT EXISTS pos_minimum_stock_unique_idx ON pos_minimum_stock (ic_code, wh_code, location_code)`, [], "none");
}

export async function ensureChangeLogTable() {
  await runQuery(`CREATE TABLE IF NOT EXISTS pos_change_log (
    id SERIAL PRIMARY KEY,
    doc_no VARCHAR(32) NOT NULL,
    total_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    received_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    change_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    payment_type VARCHAR(20) NOT NULL DEFAULT 'cash',
    received_currency VARCHAR(10) NOT NULL DEFAULT 'LAK',
    exchange_rate NUMERIC(18, 6) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
  );`, [], "none");
  await runQuery("ALTER TABLE pos_change_log ADD COLUMN IF NOT EXISTS received_currency VARCHAR(10) NOT NULL DEFAULT 'LAK'", [], "none");
  await runQuery("ALTER TABLE pos_change_log ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18, 6) NOT NULL DEFAULT 0", [], "none");
}

export async function ensureFxRateTable() {
  await runQuery(`CREATE TABLE IF NOT EXISTS pos_fx_rates (
    id SERIAL PRIMARY KEY,
    base_currency VARCHAR(10) NOT NULL DEFAULT 'LAK',
    foreign_currency VARCHAR(10) NOT NULL DEFAULT 'THB',
    rate NUMERIC(18, 6) NOT NULL DEFAULT 0,
    doc_no VARCHAR(32),
    created_at TIMESTAMP DEFAULT NOW()
  );`, [], "none");
}

export async function ensureOnlineOrdersTable() {
  await runQuery(`CREATE TABLE IF NOT EXISTS pos_online_orders (
    id SERIAL PRIMARY KEY,
    order_no VARCHAR(32) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    customer_code VARCHAR(50),
    customer_name VARCHAR(255),
    customer_phone VARCHAR(50),
    items JSONB NOT NULL,
    subtotal NUMERIC(18,2) DEFAULT 0,
    discount_amount NUMERIC(18,2) DEFAULT 0,
    discount_percent NUMERIC(8,2) DEFAULT 0,
    total NUMERIC(18,2) DEFAULT 0,
    note TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );`, [], "none");
}

export async function ensureShopOrdersTable() {
  await runQuery(`CREATE TABLE IF NOT EXISTS pos_shop_orders (
    id SERIAL PRIMARY KEY,
    order_no VARCHAR(32) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    customer_code VARCHAR(50),
    customer_name VARCHAR(255),
    customer_phone VARCHAR(50),
    items JSONB NOT NULL,
    subtotal NUMERIC(18,2) DEFAULT 0,
    discount_amount NUMERIC(18,2) DEFAULT 0,
    discount_percent NUMERIC(8,2) DEFAULT 0,
    total NUMERIC(18,2) DEFAULT 0,
    note TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );`, [], "none");
}

export async function ensurePromotionsTable() {
  await runQuery(`CREATE TABLE IF NOT EXISTS pos_promotions (
    id SERIAL PRIMARY KEY,
    item_code VARCHAR(100),
    barcode VARCHAR(100),
    promo_type VARCHAR(20) NOT NULL,
    gift_code VARCHAR(100),
    gift_qty NUMERIC(18,2) DEFAULT 1,
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );`, [], "none");
  await runQuery(`ALTER TABLE pos_promotions ADD COLUMN IF NOT EXISTS buy_items JSONB;`, [], "none");
  await runQuery(`ALTER TABLE pos_promotions ADD COLUMN IF NOT EXISTS gift_items JSONB;`, [], "none");
  await runQuery(`ALTER TABLE pos_promotions ADD COLUMN IF NOT EXISTS rule_config JSONB;`, [], "none");
}

export async function ensureSavedBillsTable() {
  await runQuery(`CREATE TABLE IF NOT EXISTS pos_saved_bills (
    id SERIAL PRIMARY KEY,
    payload JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );`, [], "none");
}

export async function ensureDailyClosureTable() {
  await runQuery(`CREATE TABLE IF NOT EXISTS pos_daily_closure (
    id SERIAL PRIMARY KEY,
    payload JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );`, [], "none");
}

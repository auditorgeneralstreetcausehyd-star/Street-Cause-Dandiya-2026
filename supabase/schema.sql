-- SC Dandiya 2026 - Supabase PostgreSQL Database Schema
-- Run this script in your Supabase SQL Editor to create separate tables for Garba Groove and Navratri Utsav

-- 1. Import Batches Table
CREATE TABLE IF NOT EXISTS import_batches (
    id TEXT PRIMARY KEY,
    file_name TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    event_id TEXT DEFAULT 'garba_groove', -- 'garba_groove' or 'navratri_utsav'
    event_name TEXT DEFAULT 'Garba Groove 2026',
    total_rows INTEGER NOT NULL DEFAULT 0,
    captured_rows INTEGER NOT NULL DEFAULT 0,
    pass_transactions INTEGER NOT NULL DEFAULT 0,
    total_passes INTEGER NOT NULL DEFAULT 0,
    donation_transactions INTEGER NOT NULL DEFAULT 0,
    total_donation_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    duplicates_skipped INTEGER NOT NULL DEFAULT 0,
    errors_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'COMPLETED', -- 'PROCESSING', 'SYNCING', 'COMPLETED', 'FAILED'
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. SEPARATE TABLE: Garba Groove Records (10 Oct 2026)
CREATE TABLE IF NOT EXISTS garba_groove_records (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL UNIQUE, -- Primary duplicate prevention key
    event_id TEXT DEFAULT 'garba_groove',
    event_name TEXT DEFAULT 'Garba Groove 2026',
    record_type TEXT NOT NULL,     -- 'PASS' or 'DONATION'
    payment_page_id TEXT,
    payment_page_title TEXT,
    payment_date TEXT,
    item_name TEXT NOT NULL,
    item_amount NUMERIC(12, 2) DEFAULT 0.00,
    item_quantity INTEGER NOT NULL DEFAULT 1,
    item_payment_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_payment_amount NUMERIC(12, 2) DEFAULT 0.00,
    currency TEXT DEFAULT 'INR',
    payment_status TEXT NOT NULL,  -- 'captured'
    payment_id TEXT,
    email TEXT,
    phone TEXT,
    name TEXT,
    pan_number TEXT,
    divisions TEXT,
    l2 TEXT,
    referred_volunteer TEXT,
    code TEXT,
    source_file TEXT NOT NULL,
    import_batch_id TEXT REFERENCES import_batches(id) ON DELETE SET NULL,
    email_status TEXT NOT NULL DEFAULT 'Pending',
    email_sent_at TIMESTAMPTZ,
    attendance_status TEXT DEFAULT 'PENDING',
    checked_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. SEPARATE TABLE: Navratri Utsav Records (11 Oct 2026)
CREATE TABLE IF NOT EXISTS navratri_utsav_records (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL UNIQUE, -- Primary duplicate prevention key
    event_id TEXT DEFAULT 'navratri_utsav',
    event_name TEXT DEFAULT 'Navratri Utsav 2026',
    record_type TEXT NOT NULL,     -- 'PASS' or 'DONATION'
    payment_page_id TEXT,
    payment_page_title TEXT,
    payment_date TEXT,
    item_name TEXT NOT NULL,
    item_amount NUMERIC(12, 2) DEFAULT 0.00,
    item_quantity INTEGER NOT NULL DEFAULT 1,
    item_payment_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_payment_amount NUMERIC(12, 2) DEFAULT 0.00,
    currency TEXT DEFAULT 'INR',
    payment_status TEXT NOT NULL,  -- 'captured'
    payment_id TEXT,
    email TEXT,
    phone TEXT,
    name TEXT,
    pan_number TEXT,
    divisions TEXT,
    l2 TEXT,
    referred_volunteer TEXT,
    code TEXT,
    source_file TEXT NOT NULL,
    import_batch_id TEXT REFERENCES import_batches(id) ON DELETE SET NULL,
    email_status TEXT NOT NULL DEFAULT 'Pending',
    email_sent_at TIMESTAMPTZ,
    attendance_status TEXT DEFAULT 'PENDING',
    checked_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Import Errors Table
CREATE TABLE IF NOT EXISTS import_errors (
    id TEXT PRIMARY KEY,
    import_batch_id TEXT REFERENCES import_batches(id) ON DELETE CASCADE,
    row_number INTEGER,
    raw_data JSONB,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Replace old single event_records table with Unified View
DROP TABLE IF EXISTS event_records CASCADE;

CREATE OR REPLACE VIEW event_records AS
SELECT * FROM garba_groove_records
UNION ALL
SELECT * FROM navratri_utsav_records;

-- Indexes for ultra-fast queries & deduplication
CREATE INDEX IF NOT EXISTS idx_garba_order_id ON garba_groove_records(order_id);
CREATE INDEX IF NOT EXISTS idx_garba_record_type ON garba_groove_records(record_type);
CREATE INDEX IF NOT EXISTS idx_garba_divisions ON garba_groove_records(divisions);
CREATE INDEX IF NOT EXISTS idx_garba_email ON garba_groove_records(email);
CREATE INDEX IF NOT EXISTS idx_garba_batch_id ON garba_groove_records(import_batch_id);

CREATE INDEX IF NOT EXISTS idx_navratri_order_id ON navratri_utsav_records(order_id);
CREATE INDEX IF NOT EXISTS idx_navratri_record_type ON navratri_utsav_records(record_type);
CREATE INDEX IF NOT EXISTS idx_navratri_divisions ON navratri_utsav_records(divisions);
CREATE INDEX IF NOT EXISTS idx_navratri_email ON navratri_utsav_records(email);
CREATE INDEX IF NOT EXISTS idx_navratri_batch_id ON navratri_utsav_records(import_batch_id);

CREATE INDEX IF NOT EXISTS idx_batches_event_id ON import_batches(event_id);
CREATE INDEX IF NOT EXISTS idx_batches_created_at ON import_batches(created_at DESC);

-- Enable RLS
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE garba_groove_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE navratri_utsav_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Full access policies for service role
DROP POLICY IF EXISTS "Allow full access on import_batches" ON import_batches;
CREATE POLICY "Allow full access on import_batches" ON import_batches FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow full access on garba_groove_records" ON garba_groove_records;
CREATE POLICY "Allow full access on garba_groove_records" ON garba_groove_records FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow full access on navratri_utsav_records" ON navratri_utsav_records;
CREATE POLICY "Allow full access on navratri_utsav_records" ON navratri_utsav_records FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow full access on import_errors" ON import_errors;
CREATE POLICY "Allow full access on import_errors" ON import_errors FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow full access on system_settings" ON system_settings;
CREATE POLICY "Allow full access on system_settings" ON system_settings FOR ALL USING (true);

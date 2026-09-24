-- SC Dandiya 2026 - Supabase PostgreSQL Database Schema
-- Run this in your Supabase Project SQL Editor

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

-- 2. Event Records Table (Passes & Donations)
CREATE TABLE IF NOT EXISTS event_records (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL UNIQUE, -- Primary duplicate prevention key
    event_id TEXT DEFAULT 'garba_groove', -- 'garba_groove' or 'navratri_utsav'
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
    email_status TEXT NOT NULL DEFAULT 'Pending', -- For Zapier audit trail
    email_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Import Errors Table
CREATE TABLE IF NOT EXISTS import_errors (
    id TEXT PRIMARY KEY,
    import_batch_id TEXT REFERENCES import_batches(id) ON DELETE CASCADE,
    row_number INTEGER,
    raw_data JSONB,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for ultra-fast queries & deduplication
CREATE INDEX IF NOT EXISTS idx_records_order_id ON event_records(order_id);
CREATE INDEX IF NOT EXISTS idx_records_event_id ON event_records(event_id);
CREATE INDEX IF NOT EXISTS idx_records_record_type ON event_records(record_type);
CREATE INDEX IF NOT EXISTS idx_records_divisions ON event_records(divisions);
CREATE INDEX IF NOT EXISTS idx_records_volunteer ON event_records(referred_volunteer);
CREATE INDEX IF NOT EXISTS idx_records_email ON event_records(email);
CREATE INDEX IF NOT EXISTS idx_records_phone ON event_records(phone);
CREATE INDEX IF NOT EXISTS idx_records_batch_id ON event_records(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_batches_event_id ON import_batches(event_id);
CREATE INDEX IF NOT EXISTS idx_batches_created_at ON import_batches(created_at DESC);

-- Enable RLS (Optional / Recommended)
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Allow access
DROP POLICY IF EXISTS "Allow full access with service role" ON import_batches;
CREATE POLICY "Allow full access with service role" ON import_batches FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow full access with service role on records" ON event_records;
CREATE POLICY "Allow full access with service role on records" ON event_records FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow full access with service role on errors" ON import_errors;
CREATE POLICY "Allow full access with service role on errors" ON import_errors FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow full access with service role on settings" ON system_settings;
CREATE POLICY "Allow full access with service role on settings" ON system_settings FOR ALL USING (true);



-- SC Dandiya 2026 - Supabase PostgreSQL Database Schema
-- Run this script in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

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

-- 2. TABLE 1: Garba Groove Passes (Order ID is UNIQUE for passes)
CREATE TABLE IF NOT EXISTS garba_groove_passes (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL UNIQUE,
    event_id TEXT DEFAULT 'garba_groove',
    event_name TEXT DEFAULT 'Garba Groove 2026',
    record_type TEXT NOT NULL DEFAULT 'PASS',
    payment_page_id TEXT,
    payment_page_title TEXT,
    payment_date TEXT,
    item_name TEXT NOT NULL,
    item_amount NUMERIC(12, 2) DEFAULT 0.00,
    item_quantity INTEGER NOT NULL DEFAULT 1,
    item_payment_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_payment_amount NUMERIC(12, 2) DEFAULT 0.00,
    currency TEXT DEFAULT 'INR',
    payment_status TEXT NOT NULL,
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
    email_last_attempt_at TIMESTAMPTZ,
    email_error TEXT,
    attendance_status TEXT DEFAULT 'PENDING',
    checked_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABLE 2: Garba Groove Donations (Order ID is UNIQUE for donations)
CREATE TABLE IF NOT EXISTS garba_groove_donations (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL UNIQUE,
    event_id TEXT DEFAULT 'garba_groove',
    event_name TEXT DEFAULT 'Garba Groove 2026',
    record_type TEXT NOT NULL DEFAULT 'DONATION',
    payment_page_id TEXT,
    payment_page_title TEXT,
    payment_date TEXT,
    item_name TEXT NOT NULL,
    item_amount NUMERIC(12, 2) DEFAULT 0.00,
    item_quantity INTEGER NOT NULL DEFAULT 1,
    item_payment_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_payment_amount NUMERIC(12, 2) DEFAULT 0.00,
    currency TEXT DEFAULT 'INR',
    payment_status TEXT NOT NULL,
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
    email_last_attempt_at TIMESTAMPTZ,
    email_error TEXT,
    attendance_status TEXT DEFAULT 'PENDING',
    checked_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABLE 3: Navratri Utsav Passes (Order ID is UNIQUE for passes)
CREATE TABLE IF NOT EXISTS navratri_utsav_passes (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL UNIQUE,
    event_id TEXT DEFAULT 'navratri_utsav',
    event_name TEXT DEFAULT 'Navratri Utsav 2026',
    record_type TEXT NOT NULL DEFAULT 'PASS',
    payment_page_id TEXT,
    payment_page_title TEXT,
    payment_date TEXT,
    item_name TEXT NOT NULL,
    item_amount NUMERIC(12, 2) DEFAULT 0.00,
    item_quantity INTEGER NOT NULL DEFAULT 1,
    item_payment_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_payment_amount NUMERIC(12, 2) DEFAULT 0.00,
    currency TEXT DEFAULT 'INR',
    payment_status TEXT NOT NULL,
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
    email_last_attempt_at TIMESTAMPTZ,
    email_error TEXT,
    attendance_status TEXT DEFAULT 'PENDING',
    checked_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TABLE 4: Navratri Utsav Donations (Order ID is UNIQUE for donations)
CREATE TABLE IF NOT EXISTS navratri_utsav_donations (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL UNIQUE,
    event_id TEXT DEFAULT 'navratri_utsav',
    event_name TEXT DEFAULT 'Navratri Utsav 2026',
    record_type TEXT NOT NULL DEFAULT 'DONATION',
    payment_page_id TEXT,
    payment_page_title TEXT,
    payment_date TEXT,
    item_name TEXT NOT NULL,
    item_amount NUMERIC(12, 2) DEFAULT 0.00,
    item_quantity INTEGER NOT NULL DEFAULT 1,
    item_payment_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_payment_amount NUMERIC(12, 2) DEFAULT 0.00,
    currency TEXT DEFAULT 'INR',
    payment_status TEXT NOT NULL,
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
    email_last_attempt_at TIMESTAMPTZ,
    email_error TEXT,
    attendance_status TEXT DEFAULT 'PENDING',
    checked_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Import Errors Table
CREATE TABLE IF NOT EXISTS import_errors (
    id TEXT PRIMARY KEY,
    import_batch_id TEXT REFERENCES import_batches(id) ON DELETE CASCADE,
    row_number INTEGER,
    raw_data JSONB,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for ultra-fast queries & deduplication
CREATE INDEX IF NOT EXISTS idx_gg_passes_order_id ON garba_groove_passes(order_id);
CREATE INDEX IF NOT EXISTS idx_gg_passes_divisions ON garba_groove_passes(divisions);
CREATE INDEX IF NOT EXISTS idx_gg_passes_volunteer ON garba_groove_passes(referred_volunteer);

CREATE INDEX IF NOT EXISTS idx_gg_donations_order_id ON garba_groove_donations(order_id);
CREATE INDEX IF NOT EXISTS idx_gg_donations_divisions ON garba_groove_donations(divisions);
CREATE INDEX IF NOT EXISTS idx_gg_donations_volunteer ON garba_groove_donations(referred_volunteer);

CREATE INDEX IF NOT EXISTS idx_nu_passes_order_id ON navratri_utsav_passes(order_id);
CREATE INDEX IF NOT EXISTS idx_nu_passes_divisions ON navratri_utsav_passes(divisions);
CREATE INDEX IF NOT EXISTS idx_nu_passes_volunteer ON navratri_utsav_passes(referred_volunteer);

CREATE INDEX IF NOT EXISTS idx_nu_donations_order_id ON navratri_utsav_donations(order_id);
CREATE INDEX IF NOT EXISTS idx_nu_donations_divisions ON navratri_utsav_donations(divisions);
CREATE INDEX IF NOT EXISTS idx_nu_donations_volunteer ON navratri_utsav_donations(referred_volunteer);

-- Enable RLS
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE garba_groove_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE garba_groove_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE navratri_utsav_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE navratri_utsav_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated are denied; the server uses the service role key, which bypasses RLS

-- Full access policies for service role

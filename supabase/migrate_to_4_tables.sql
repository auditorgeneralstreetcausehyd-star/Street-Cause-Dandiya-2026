-- SC Dandiya 2026 - Migration to 4 Separate Tables (Passes & Donations)
-- Run this script in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- 1. Garba Groove Passes Table (order_id is UNIQUE for passes)
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
    attendance_status TEXT DEFAULT 'PENDING',
    checked_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Garba Groove Donations Table (order_id is UNIQUE for donations)
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
    attendance_status TEXT DEFAULT 'PENDING',
    checked_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Navratri Utsav Passes Table (order_id is UNIQUE for passes)
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
    attendance_status TEXT DEFAULT 'PENDING',
    checked_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Navratri Utsav Donations Table (order_id is UNIQUE for donations)
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
    attendance_status TEXT DEFAULT 'PENDING',
    checked_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for rapid query performance
CREATE INDEX IF NOT EXISTS idx_gg_passes_order_id ON garba_groove_passes(order_id);
CREATE INDEX IF NOT EXISTS idx_gg_passes_division ON garba_groove_passes(divisions);
CREATE INDEX IF NOT EXISTS idx_gg_passes_volunteer ON garba_groove_passes(referred_volunteer);

CREATE INDEX IF NOT EXISTS idx_gg_donations_order_id ON garba_groove_donations(order_id);
CREATE INDEX IF NOT EXISTS idx_gg_donations_division ON garba_groove_donations(divisions);
CREATE INDEX IF NOT EXISTS idx_gg_donations_volunteer ON garba_groove_donations(referred_volunteer);

CREATE INDEX IF NOT EXISTS idx_nu_passes_order_id ON navratri_utsav_passes(order_id);
CREATE INDEX IF NOT EXISTS idx_nu_passes_division ON navratri_utsav_passes(divisions);
CREATE INDEX IF NOT EXISTS idx_nu_passes_volunteer ON navratri_utsav_passes(referred_volunteer);

CREATE INDEX IF NOT EXISTS idx_nu_donations_order_id ON navratri_utsav_donations(order_id);
CREATE INDEX IF NOT EXISTS idx_nu_donations_division ON navratri_utsav_donations(divisions);
CREATE INDEX IF NOT EXISTS idx_nu_donations_volunteer ON navratri_utsav_donations(referred_volunteer);

-- Data Backfill: Copy existing records from garba_groove_records and navratri_utsav_records if present
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'garba_groove_records') THEN
        INSERT INTO garba_groove_passes
        SELECT * FROM garba_groove_records WHERE record_type = 'PASS'
        ON CONFLICT (order_id) DO NOTHING;

        INSERT INTO garba_groove_donations
        SELECT * FROM garba_groove_records WHERE record_type = 'DONATION'
        ON CONFLICT (order_id) DO NOTHING;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'navratri_utsav_records') THEN
        INSERT INTO navratri_utsav_passes
        SELECT * FROM navratri_utsav_records WHERE record_type = 'PASS'
        ON CONFLICT (order_id) DO NOTHING;

        INSERT INTO navratri_utsav_donations
        SELECT * FROM navratri_utsav_records WHERE record_type = 'DONATION'
        ON CONFLICT (order_id) DO NOTHING;
    END IF;
END $$;

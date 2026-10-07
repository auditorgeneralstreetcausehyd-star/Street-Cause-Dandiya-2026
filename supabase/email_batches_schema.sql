-- SC Dandiya 2026 - Email Batches & Dispatch Logs Tables
-- Run this in your Supabase SQL editor: https://supabase.com/dashboard/project/_/sql

-- 1. Email Batches Table
CREATE TABLE IF NOT EXISTS email_batches (
    batch_id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL DEFAULT 'garba_groove',
    requested_by TEXT,
    total INTEGER NOT NULL DEFAULT 0,
    queued INTEGER NOT NULL DEFAULT 0,
    processing INTEGER NOT NULL DEFAULT 0,
    sent INTEGER NOT NULL DEFAULT 0,
    retrying INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 2. Email Dispatch Logs Table
CREATE TABLE IF NOT EXISTS email_dispatch_logs (
    id TEXT PRIMARY KEY,
    batch_id TEXT REFERENCES email_batches(batch_id) ON DELETE CASCADE,
    order_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'QUEUED', -- 'QUEUED', 'PROCESSING', 'SENT', 'RETRYING', 'FAILED', 'DEFERRED'
    attempt_count INTEGER NOT NULL DEFAULT 0,
    smtp_message_id TEXT,
    smtp_account TEXT,
    smtp_code TEXT,
    error_message TEXT,
    next_retry_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);

-- Indexes for performance & atomic job claiming
CREATE INDEX IF NOT EXISTS idx_email_batches_event_id ON email_batches(event_id);
CREATE INDEX IF NOT EXISTS idx_email_dispatch_logs_batch_id ON email_dispatch_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_email_dispatch_logs_order_id ON email_dispatch_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_email_dispatch_logs_status_retry ON email_dispatch_logs(status, next_retry_at);

-- RLS Policies
ALTER TABLE email_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_dispatch_logs ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated are denied; the server uses the service role key, which bypasses RLS


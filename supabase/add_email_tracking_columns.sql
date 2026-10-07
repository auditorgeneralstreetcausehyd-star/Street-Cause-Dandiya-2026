-- SC Dandiya 2026 - Add email delivery tracking columns
-- updateRecordEmailStatus() writes these; without them Supabase rejects the whole update.
-- Run this in your Supabase SQL editor: https://supabase.com/dashboard/project/_/sql

ALTER TABLE garba_groove_passes ADD COLUMN IF NOT EXISTS email_last_attempt_at TIMESTAMPTZ;
ALTER TABLE garba_groove_passes ADD COLUMN IF NOT EXISTS email_error TEXT;

ALTER TABLE garba_groove_donations ADD COLUMN IF NOT EXISTS email_last_attempt_at TIMESTAMPTZ;
ALTER TABLE garba_groove_donations ADD COLUMN IF NOT EXISTS email_error TEXT;

ALTER TABLE navratri_utsav_passes ADD COLUMN IF NOT EXISTS email_last_attempt_at TIMESTAMPTZ;
ALTER TABLE navratri_utsav_passes ADD COLUMN IF NOT EXISTS email_error TEXT;

ALTER TABLE navratri_utsav_donations ADD COLUMN IF NOT EXISTS email_last_attempt_at TIMESTAMPTZ;
ALTER TABLE navratri_utsav_donations ADD COLUMN IF NOT EXISTS email_error TEXT;

-- Which Gmail account sent each email (multi-account rotation counts per-account daily quota from this)
ALTER TABLE email_dispatch_logs ADD COLUMN IF NOT EXISTS smtp_account TEXT;
CREATE INDEX IF NOT EXISTS idx_email_dispatch_logs_account_sent ON email_dispatch_logs(smtp_account, status, sent_at);

-- Make PostgREST pick up the new columns immediately
NOTIFY pgrst, 'reload schema';

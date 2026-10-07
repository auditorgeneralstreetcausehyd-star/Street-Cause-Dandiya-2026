-- SC Dandiya 2026 - Security hardening
-- Run this in your Supabase SQL editor: https://supabase.com/dashboard/project/_/sql
--
-- BEFORE RUNNING: make sure every deployment (Vercel included) has SUPABASE_SERVICE_ROLE_KEY set.
-- The app's server code uses the service role, which bypasses RLS. After this script the anon key
-- can no longer read or write anything, so a deployment running on the anon key would stop working.

-- 1. Lock down every app table: RLS on, no policies => anon/authenticated are denied, service role still works
DO $$
DECLARE
  t text;
  p record;
  app_tables text[] := ARRAY[
    'import_batches',
    'garba_groove_passes',
    'garba_groove_donations',
    'navratri_utsav_passes',
    'navratri_utsav_donations',
    'import_errors',
    'system_settings',
    'email_batches',
    'email_dispatch_logs'
  ];
BEGIN
  FOREACH t IN ARRAY app_tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- 2. Shared rate limiting (in-memory counters are per serverless instance, so they don't hold on Vercel)
CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    reset_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits(reset_at);

-- Atomically count one hit for p_key in a fixed window; returns the count so far and when the window resets
CREATE OR REPLACE FUNCTION rate_limit_hit(p_key TEXT, p_window_seconds INTEGER)
RETURNS TABLE (hit_count INTEGER, window_reset_at TIMESTAMPTZ)
LANGUAGE sql
AS $$
  INSERT INTO rate_limits AS r (key, count, reset_at)
  VALUES (p_key, 1, now() + make_interval(secs => p_window_seconds))
  ON CONFLICT (key) DO UPDATE SET
    count = CASE WHEN r.reset_at <= now() THEN 1 ELSE r.count + 1 END,
    reset_at = CASE WHEN r.reset_at <= now() THEN now() + make_interval(secs => p_window_seconds) ELSE r.reset_at END
  RETURNING r.count, r.reset_at;
$$;

REVOKE ALL ON FUNCTION rate_limit_hit(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rate_limit_hit(TEXT, INTEGER) TO service_role;

-- Make PostgREST pick up the new table and function immediately
NOTIFY pgrst, 'reload schema';

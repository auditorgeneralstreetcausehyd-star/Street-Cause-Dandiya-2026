-- ============================================================
-- SC Dandiya 2026 — Drop Legacy Tables
-- Run this in your Supabase SQL Editor ONCE after confirming
-- the 4 new tables (garba_groove_passes, garba_groove_donations,
-- navratri_utsav_passes, navratri_utsav_donations) have data.
-- ============================================================

-- Step 1: Drop legacy views / tables (CASCADE removes dependent objects)
DROP VIEW  IF EXISTS event_records          CASCADE;
DROP TABLE IF EXISTS event_records          CASCADE;
DROP TABLE IF EXISTS garba_groove_records   CASCADE;
DROP TABLE IF EXISTS navratri_utsav_records CASCADE;

-- Step 2 (optional): Verify remaining tables
SELECT table_name
FROM   information_schema.tables
WHERE  table_schema = 'public'
ORDER  BY table_name;

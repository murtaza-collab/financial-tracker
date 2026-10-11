-- ============================================================
--  Fix default currency: INR -> PKR  —  run in Supabase SQL Editor
-- ============================================================
-- The app already formats everything as PKR (src/lib/currency.ts);
-- this only corrects the stored `currency` column + its default,
-- which was seeded as 'INR'. Harmless today (nothing reads it yet),
-- but correct for when a currency picker is added later.
-- ============================================================

-- STEP 1 (run first): find every 'currency' column + its default.
-- Confirm the table is `profiles` before running Step 2. If it's a
-- different table, swap the name in Step 2 accordingly.
select table_name, column_name, column_default
from information_schema.columns
where column_name ilike '%currency%' and table_schema = 'public';

-- STEP 2: fix existing rows, then the default for future rows.
update public.profiles set currency = 'PKR'
where currency is distinct from 'PKR';

alter table public.profiles alter column currency set default 'PKR';

-- STEP 3 (verify): should show 'PKR' for all rows and the new default.
-- select distinct currency from public.profiles;
-- select column_default from information_schema.columns
--   where table_name = 'profiles' and column_name = 'currency';

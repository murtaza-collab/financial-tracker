-- ============================================================
--  Add missing settlements.direction column  —  Supabase SQL Editor
-- ============================================================
-- The app records whether a settlement was money you RECEIVED
-- ('received') or money you PAID ('paid'), but the column was
-- never added to this database — so logging a settlement fails
-- with "Could not find the 'direction' column".
--
-- Existing rows get NULL, which the app already treats as
-- 'received' (its original behaviour before this column existed),
-- so no back-fill is needed.
-- ============================================================

alter table public.settlements
  add column if not exists direction text;

-- guard values (NULL is allowed → legacy rows read as 'received')
alter table public.settlements
  drop constraint if exists settlements_direction_check;
alter table public.settlements
  add constraint settlements_direction_check
  check (direction is null or direction in ('received','paid'));

-- verify
-- select direction, count(*) from public.settlements group by direction;

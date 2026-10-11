-- ============================================================
--  Fix outing_participants RLS  —  run in Supabase SQL Editor
-- ============================================================
-- "Someone Paid for Group" inserts rows into outing_participants,
-- but the table has RLS on with no owner INSERT policy, so the
-- insert is denied ("new row violates row-level security policy").
-- This was masked until now because the outings insert used to
-- fail first (missing paid_by_person_id column).
--
-- outing_participants has no user_id of its own — ownership is via
-- the parent outing. This grants the owner full access to rows
-- under their own outings, for every command. The Phase 2
-- counterparty read-only SELECT policy stays as-is (they OR
-- together, so both work).
-- ============================================================

-- (optional) inspect existing policies first:
-- select policyname, cmd, qual, with_check
-- from pg_policies where tablename = 'outing_participants';

drop policy if exists outing_participants_owner_all on public.outing_participants;
create policy outing_participants_owner_all on public.outing_participants
  for all to authenticated
  using      (outing_id in (select id from public.outings where user_id = auth.uid()))
  with check (outing_id in (select id from public.outings where user_id = auth.uid()));

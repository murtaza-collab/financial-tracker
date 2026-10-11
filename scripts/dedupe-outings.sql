-- ============================================================
--  De-duplicate outings  —  run in Supabase SQL Editor
-- ============================================================
-- Removes duplicate "Someone Paid for Group" outings created when a
-- write committed but its response was lost (so the UI showed an error
-- and the row was re-sent). Scoped to outings with NO linked transaction
-- (transaction_id IS NULL) — i.e. the Splits "someone paid" flow, which
-- makes no transaction and no balance change, so deleting extras is safe.
-- Transaction-linked outings (from the Transactions page) are untouched.
-- ============================================================

-- ------------------------------------------------------------
-- STEP 1: PREVIEW. Run first — each row is a set of duplicates.
-- 'copies' = how many exist; we will keep 1 and delete the rest.
-- ------------------------------------------------------------
select place_name, date, total_amount, paid_by_person_id,
       count(*) as copies
from public.outings
where transaction_id is null
group by user_id, place_name, date, total_amount, paid_by_person_id, your_share
having count(*) > 1
order by copies desc, place_name;


-- ------------------------------------------------------------
-- STEP 2: DELETE the extra copies (keeps the earliest id in each
-- group) plus their participant rows. Run only after the preview
-- looks right. This cannot be undone. Run 2a THEN 2b (children
-- first, then parents).
-- ------------------------------------------------------------

-- 2a: remove participant rows belonging to the duplicate outings
delete from public.outing_participants
where outing_id in (
  select id from (
    select id,
           row_number() over (
             partition by user_id, place_name, date, total_amount, paid_by_person_id, your_share
             order by id
           ) as rn
    from public.outings
    where transaction_id is null
  ) d
  where d.rn > 1
);

-- 2b: remove the duplicate outings themselves
delete from public.outings
where id in (
  select id from (
    select id,
           row_number() over (
             partition by user_id, place_name, date, total_amount, paid_by_person_id, your_share
             order by id
           ) as rn
    from public.outings
    where transaction_id is null
  ) d
  where d.rn > 1
);

-- ------------------------------------------------------------
-- STEP 3 (verify): re-run STEP 1 — it should return no rows.
-- ------------------------------------------------------------

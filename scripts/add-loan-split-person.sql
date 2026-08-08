-- Link loans to a Splits contact so a person's loan + outing balances roll up
-- into one net figure on the Splits page.
--
-- person_id is nullable on purpose: loans with one-off people (not in Splits)
-- keep working exactly as before, carrying only person_name.
-- ON DELETE SET NULL so deleting a Splits contact never destroys loan history.
--
-- Run manually in the Supabase SQL Editor (no migrations dir in this project).

alter table public.loans
  add column if not exists person_id uuid references public.split_people(id) on delete set null;

create index if not exists loans_person_id_idx on public.loans(person_id);

-- Backfill: link existing loans whose person_name exactly matches one of the
-- same user's Splits contacts (case-insensitive, trimmed). Safe to re-run —
-- it only touches rows that are still unlinked, and skips ambiguous names.
update public.loans l
set person_id = sp.id
from public.split_people sp
where l.person_id is null
  and sp.user_id = l.user_id
  and lower(trim(sp.name)) = lower(trim(l.person_name))
  and (
    select count(*) from public.split_people s2
    where s2.user_id = l.user_id
      and lower(trim(s2.name)) = lower(trim(l.person_name))
  ) = 1;

-- Verify
select
  count(*) filter (where person_id is not null) as linked_loans,
  count(*) filter (where person_id is null)     as unlinked_loans
from public.loans;

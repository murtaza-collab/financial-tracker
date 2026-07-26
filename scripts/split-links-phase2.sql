-- ============================================================
--  Split Links — Phase 2 (read-only sharing)  —  run ONCE in
--  Supabase SQL Editor. Requires Phase 1 to have run first.
-- ============================================================
-- Adds the actual cross-user visibility, gated on consent:
--   * a linked user can CLAIM their pending invites
--   * ACCEPT / DECLINE them
--   * once ACCEPTED, they get READ-ONLY sight of exactly the
--     outings / settlements that concern them, plus the name
--     of the person who added them
--
-- Guarantees:
--   * nothing is visible until link_status = 'accepted'
--   * the counterparty gets SELECT only — never insert/update/
--     delete on the creator's ledger
--   * the creator's own data & existing RLS are untouched;
--     these are ADDITIONAL permissive SELECT policies
-- ============================================================

-- ---------- prerequisite column --------------------------------
-- The app references outings.paid_by_person_id (the "Someone Paid
-- for Group" feature), but the column may never have been added to
-- this database. Add it if missing so the helpers below can compile.
alter table public.outings
  add column if not exists paid_by_person_id uuid
  references public.split_people(id) on delete set null;

-- ---------- helper sets (SECURITY DEFINER, self-scoped) ------
-- All are scoped to auth.uid() internally, and run as definer so
-- they can be used inside RLS policies without causing recursion.

-- split_people.id rows the caller has ACCEPTED as their own
create or replace function public.shared_person_ids()
returns setof uuid language sql security definer stable
set search_path = public as $$
  select id from public.split_people
  where linked_user_id = auth.uid() and link_status = 'accepted';
$$;

-- distinct creators (user_id) who have an accepted link with the caller
create or replace function public.shared_creator_ids()
returns setof uuid language sql security definer stable
set search_path = public as $$
  select distinct user_id from public.split_people
  where linked_user_id = auth.uid() and link_status = 'accepted';
$$;

-- outings that concern the caller (they paid, or they were a participant)
create or replace function public.shared_outing_ids()
returns setof uuid language sql security definer stable
set search_path = public as $$
  select o.id from public.outings o
  where o.paid_by_person_id in (select public.shared_person_ids())
     or exists (
       select 1 from public.outing_participants op
       where op.outing_id = o.id
         and op.person_id in (select public.shared_person_ids())
     );
$$;

revoke all on function public.shared_person_ids()  from public, anon;
revoke all on function public.shared_creator_ids() from public, anon;
revoke all on function public.shared_outing_ids()  from public, anon;
grant execute on function public.shared_person_ids()  to authenticated;
grant execute on function public.shared_creator_ids() to authenticated;
grant execute on function public.shared_outing_ids()  to authenticated;

-- ---------- read-only policies for the counterparty ----------
drop policy if exists split_people_counterparty_select on public.split_people;
create policy split_people_counterparty_select on public.split_people
  for select to authenticated
  using (linked_user_id = auth.uid() and link_status = 'accepted');

drop policy if exists outings_counterparty_select on public.outings;
create policy outings_counterparty_select on public.outings
  for select to authenticated
  using (id in (select public.shared_outing_ids()));

-- only their OWN participant row is exposed, not other guests'
drop policy if exists outing_participants_counterparty_select on public.outing_participants;
create policy outing_participants_counterparty_select on public.outing_participants
  for select to authenticated
  using (person_id in (select public.shared_person_ids()));

drop policy if exists settlements_counterparty_select on public.settlements;
create policy settlements_counterparty_select on public.settlements
  for select to authenticated
  using (person_id in (select public.shared_person_ids()));

-- lets the counterparty see the NAME of whoever added them
drop policy if exists profiles_counterparty_select on public.profiles;
create policy profiles_counterparty_select on public.profiles
  for select to authenticated
  using (id in (select public.shared_creator_ids()));

-- ---------- claim / list / respond ---------------------------
-- Link any contact (owned by anyone) whose email matches the
-- caller's own login email. Runs as definer so it can touch
-- rows the caller doesn't own, but only ever sets linked_user_id
-- to the CALLER and only where the email genuinely matches.
create or replace function public.claim_split_links()
returns integer language plpgsql security definer
set search_path = public as $$
declare
  uid      uuid := auth.uid();
  my_email text;
  touched  integer := 0;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select email into my_email from auth.users where id = uid;
  if my_email is null then return 0; end if;

  update public.split_people sp
     set linked_user_id = uid,
         link_status    = case when sp.link_status in ('accepted','declined')
                               then sp.link_status else 'pending' end
   where sp.user_id <> uid
     and sp.email is not null
     and lower(sp.email) = lower(my_email)
     and sp.linked_user_id is distinct from uid;

  get diagnostics touched = row_count;
  return touched;
end; $$;

-- Pending invites for the caller — curated fields only (who invited
-- them + the label they were saved under). NO balances leak here.
create or replace function public.my_pending_split_invites()
returns table(person_id uuid, creator_id uuid, creator_name text,
              creator_email text, invited_as text)
language sql security definer stable
set search_path = public as $$
  select sp.id, sp.user_id, pr.name, pr.email, sp.name
  from public.split_people sp
  left join public.profiles pr on pr.id = sp.user_id
  where sp.linked_user_id = auth.uid() and sp.link_status = 'pending';
$$;

-- Accept or decline. Scoped to the caller's own link row.
create or replace function public.respond_to_split_invite(p_person_id uuid, p_accept boolean)
returns void language plpgsql security definer
set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  update public.split_people
     set link_status = case when p_accept then 'accepted' else 'declined' end
   where id = p_person_id and linked_user_id = uid;
end; $$;

revoke all on function public.claim_split_links()        from public, anon;
revoke all on function public.my_pending_split_invites() from public, anon;
revoke all on function public.respond_to_split_invite(uuid, boolean) from public, anon;
grant execute on function public.claim_split_links()        to authenticated;
grant execute on function public.my_pending_split_invites() to authenticated;
grant execute on function public.respond_to_split_invite(uuid, boolean) to authenticated;

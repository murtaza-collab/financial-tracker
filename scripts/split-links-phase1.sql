-- ============================================================
--  Split Links — Phase 1 (foundation only)  —  run ONCE in
--  Supabase SQL Editor.
-- ============================================================
-- Goal: let a contact you add in Splits be *recognised* as a
-- real app user (matched by email), WITHOUT sharing any of
-- your ledger with them yet.
--
-- Phase 1 does three things and nothing more:
--   1. adds email + link columns to split_people
--   2. a SECURITY DEFINER matcher that flags which of YOUR
--      OWN contacts correspond to a registered user
--   3. leaves all existing RLS untouched — no data crosses
--      between users. That is Phase 2.
--
-- link_status meaning:
--   none      — no match / no email yet (default)
--   pending   — a real user exists for this email, but they
--               have NOT accepted the link (Phase 2). Your
--               splits are NOT visible to them.
--   accepted  — reserved for Phase 2
--   declined  — reserved for Phase 2
-- ============================================================

-- 1. Columns -------------------------------------------------
alter table public.split_people
  add column if not exists email          text,
  add column if not exists linked_user_id uuid references auth.users(id) on delete set null,
  add column if not exists link_status    text not null default 'none'
    check (link_status in ('none','pending','accepted','declined'));

create index if not exists split_people_email_idx       on public.split_people (lower(email));
create index if not exists split_people_linked_user_idx on public.split_people (linked_user_id);

-- 2. Matcher -------------------------------------------------
-- Runs as definer so it can read auth.users, but is HARD-SCOPED
-- to the caller's own rows (user_id = auth.uid()), so it can
-- never enumerate emails the caller didn't type themselves.
create or replace function public.refresh_split_links()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid     uuid    := auth.uid();
  touched integer := 0;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- (a) link contacts whose email matches a registered user
  update public.split_people sp
     set linked_user_id = u.id,
         link_status    = case when sp.link_status in ('accepted','declined')
                               then sp.link_status else 'pending' end
    from auth.users u
   where sp.user_id = uid
     and sp.email is not null
     and lower(sp.email) = lower(u.email)
     and u.id <> uid                                   -- never link yourself
     and sp.linked_user_id is distinct from u.id;

  get diagnostics touched = row_count;

  -- (b) clear stale links (email changed/removed, or user gone)
  update public.split_people sp
     set linked_user_id = null,
         link_status    = 'none'
   where sp.user_id = uid
     and sp.linked_user_id is not null
     and not exists (
       select 1 from auth.users u
        where u.id = sp.linked_user_id
          and sp.email is not null
          and lower(sp.email) = lower(u.email)
     );

  return touched;
end;
$$;

revoke all on function public.refresh_split_links() from public, anon;
grant execute on function public.refresh_split_links() to authenticated;

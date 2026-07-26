-- ============================================================
--  Split Links — Phase 2b (resend + consent guard)  —  run
--  ONCE in Supabase SQL Editor, after Phase 2.
-- ============================================================
-- Adds:
--   * resend_split_invite() — creator re-offers a declined link
--   * a trigger so ONLY the invited user can ever set a link to
--     'accepted' / 'declined'. The creator can only set 'pending'.
--     This enforces the consent promise at the DB level: a creator
--     can never force their data into someone else's view.
-- ============================================================

-- Creator re-offers a declined (or reset) invite -> back to 'pending'.
-- Never touches an already-accepted link.
create or replace function public.resend_split_invite(p_person_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  update public.split_people
     set link_status = 'pending'
   where id = p_person_id
     and user_id = uid                 -- only the creator of the row
     and linked_user_id is not null    -- a real user exists to invite
     and link_status <> 'accepted';    -- don't disturb active shares
end; $$;

revoke all on function public.resend_split_invite(uuid) from public, anon;
grant execute on function public.resend_split_invite(uuid) to authenticated;

-- Consent guard: only the linked (invited) user may move a link into
-- 'accepted' or 'declined'. Anyone else (i.e. the creator) is blocked,
-- so a creator can never forge acceptance and force-share their ledger.
create or replace function public.guard_split_link_status()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if NEW.link_status is distinct from OLD.link_status
     and NEW.link_status in ('accepted','declined')
     and auth.uid() is distinct from OLD.linked_user_id then
    raise exception 'Only the invited user can accept or decline a split link';
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_guard_split_link_status on public.split_people;
create trigger trg_guard_split_link_status
  before update on public.split_people
  for each row execute function public.guard_split_link_status();

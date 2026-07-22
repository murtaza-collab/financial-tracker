-- ============================================================
--  delete_own_account()  —  run ONCE in Supabase SQL Editor
-- ============================================================
-- Lets a logged-in user delete THEIR OWN account + all data
-- straight from the app (Profile -> Danger Zone).
--
-- Why a function: the browser uses the public anon key, which
-- can never delete an auth.users row. This SECURITY DEFINER
-- function runs with elevated rights but is hard-scoped to
-- auth.uid(), so a user can only ever delete themselves.
-- ============================================================

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- child / dependent rows first, then parents
  delete from outing_participants where outing_id in (select id from outings where user_id = uid);
  delete from loan_repayments     where user_id = uid;
  delete from bill_payments       where user_id = uid;
  delete from goal_contributions  where user_id = uid;
  delete from emi_payments        where user_id = uid;
  delete from recurring_instances where user_id = uid;
  delete from settlements         where user_id = uid;
  delete from outings             where user_id = uid;
  delete from transactions        where user_id = uid;
  delete from loans               where user_id = uid;
  delete from bills               where user_id = uid;
  delete from emis                where user_id = uid;
  delete from goals               where user_id = uid;
  delete from recurring_rules     where user_id = uid;
  delete from budget_rules        where user_id = uid;
  delete from split_people        where user_id = uid;
  delete from custom_categories   where user_id = uid;
  delete from accounts            where user_id = uid;
  delete from profiles            where id = uid;

  -- finally, the auth login itself (also clears sessions/identities)
  delete from auth.users where id = uid;
end;
$$;

-- Only signed-in users may call it; never anon/public.
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

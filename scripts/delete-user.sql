-- ============================================================
--  DELETE ONE USER — full account + all data
--  Run in: Supabase Dashboard -> SQL Editor
--  Runs as service role (bypasses RLS). IRREVERSIBLE.
-- ============================================================

-- ------------------------------------------------------------
-- STEP 0 (optional): How many users total?
-- ------------------------------------------------------------
-- select count(*) as total_users from auth.users;


-- ------------------------------------------------------------
-- STEP 1: Find the user + PREVIEW how much data they have.
--         Replace the email, run this FIRST and eyeball it.
-- ------------------------------------------------------------
with u as (
  select id from auth.users where email = 'USER_EMAIL_HERE'
)
select
  (select email from auth.users where id = (select id from u))                as email,
  (select id    from u)                                                       as user_id,
  (select count(*) from transactions      where user_id = (select id from u)) as transactions,
  (select count(*) from accounts          where user_id = (select id from u)) as accounts,
  (select count(*) from loans             where user_id = (select id from u)) as loans,
  (select count(*) from bills             where user_id = (select id from u)) as bills,
  (select count(*) from outings           where user_id = (select id from u)) as outings,
  (select count(*) from goals             where user_id = (select id from u)) as goals,
  (select count(*) from emis              where user_id = (select id from u)) as emis;


-- ------------------------------------------------------------
-- STEP 2: DELETE everything for that user, then the login.
--         Same email. This cannot be undone.
--         Every DELETE below runs exactly once; FK checks pass
--         because parent+child are removed in one statement.
-- ------------------------------------------------------------
with u as (
  select id from auth.users where email = 'USER_EMAIL_HERE'
),
_op as (delete from outing_participants where outing_id in (select id from outings where user_id in (select id from u)) returning 1),
_lr as (delete from loan_repayments     where user_id in (select id from u) returning 1),
_bp as (delete from bill_payments       where user_id in (select id from u) returning 1),
_gc as (delete from goal_contributions  where user_id in (select id from u) returning 1),
_ep as (delete from emi_payments        where user_id in (select id from u) returning 1),
_ri as (delete from recurring_instances where user_id in (select id from u) returning 1),
_st as (delete from settlements         where user_id in (select id from u) returning 1),
_ou as (delete from outings             where user_id in (select id from u) returning 1),
_tx as (delete from transactions        where user_id in (select id from u) returning 1),
_ln as (delete from loans               where user_id in (select id from u) returning 1),
_bl as (delete from bills               where user_id in (select id from u) returning 1),
_em as (delete from emis                where user_id in (select id from u) returning 1),
_go as (delete from goals               where user_id in (select id from u) returning 1),
_rr as (delete from recurring_rules     where user_id in (select id from u) returning 1),
_br as (delete from budget_rules        where user_id in (select id from u) returning 1),
_sp as (delete from split_people        where user_id in (select id from u) returning 1),
_cc as (delete from custom_categories   where user_id in (select id from u) returning 1),
_ac as (delete from accounts            where user_id in (select id from u) returning 1),
_pr as (delete from profiles            where id      in (select id from u) returning 1)
delete from auth.users where id in (select id from u);

-- ============================================================
--  SCHEMA AUDIT — read-only, run in Supabase SQL Editor
-- ============================================================
-- Compares what the app CODE uses against what the DATABASE has.
-- Nothing is modified. Run each of the 3 queries; each returns
-- ONLY the problems (empty result = that check is clean).
--
-- Derived from a full scan of src/ (19 tables, all insert/
-- update/select/filter column usage).
-- ============================================================


-- ------------------------------------------------------------
-- CHECK A: MISSING COLUMNS
-- Columns the code reads/writes that DON'T exist in the DB.
-- (This is the paid_by_person_id / settlements.direction class.)
-- Any row returned = a column to ADD.
-- ------------------------------------------------------------
with expected(table_name, column_name) as (
  values
  -- accounts
  ('accounts','user_id'),('accounts','name'),('accounts','bank_name'),('accounts','type'),
  ('accounts','balance'),('accounts','credit_limit'),('accounts','billing_date'),('accounts','due_date'),
  ('accounts','last_four'),('accounts','is_archived'),('accounts','id'),
  -- transactions
  ('transactions','user_id'),('transactions','date'),('transactions','amount'),('transactions','type'),
  ('transactions','account_id'),('transactions','to_account_id'),('transactions','category'),('transactions','note'),
  ('transactions','is_personal'),('transactions','goal_id'),('transactions','emi_id'),('transactions','id'),
  ('transactions','created_at'),
  -- split_people
  ('split_people','user_id'),('split_people','name'),('split_people','phone'),('split_people','email'),
  ('split_people','notes'),('split_people','opening_balance'),('split_people','id'),
  ('split_people','linked_user_id'),('split_people','link_status'),
  -- outings
  ('outings','user_id'),('outings','transaction_id'),('outings','place_name'),('outings','date'),
  ('outings','total_amount'),('outings','paid_by'),('outings','paid_by_person_id'),('outings','total_people'),
  ('outings','your_share'),('outings','notes'),('outings','id'),
  -- outing_participants
  ('outing_participants','outing_id'),('outing_participants','user_id'),('outing_participants','person_id'),
  ('outing_participants','share_amount'),
  -- settlements
  ('settlements','user_id'),('settlements','person_id'),('settlements','amount'),('settlements','date'),
  ('settlements','account_id'),('settlements','notes'),('settlements','direction'),('settlements','id'),
  -- profiles
  ('profiles','id'),('profiles','name'),('profiles','email'),
  -- loans
  ('loans','user_id'),('loans','direction'),('loans','person_name'),('loans','principal'),('loans','date'),
  ('loans','due_date'),('loans','account_id'),('loans','outstanding'),('loans','status'),('loans','notes'),
  ('loans','monthly_installment'),('loans','repayment_start_date'),('loans','id'),
  -- loan_repayments
  ('loan_repayments','loan_id'),('loan_repayments','user_id'),('loan_repayments','amount'),
  ('loan_repayments','date'),('loan_repayments','transaction_id'),('loan_repayments','id'),
  -- recurring_rules
  ('recurring_rules','user_id'),('recurring_rules','name'),('recurring_rules','amount'),('recurring_rules','type'),
  ('recurring_rules','account_id'),('recurring_rules','category'),('recurring_rules','note'),
  ('recurring_rules','frequency'),('recurring_rules','interval_days'),('recurring_rules','next_date'),
  ('recurring_rules','end_date'),('recurring_rules','is_active'),('recurring_rules','id'),
  -- goals
  ('goals','user_id'),('goals','name'),('goals','target_amount'),('goals','target_date'),('goals','account_id'),
  ('goals','current_amount'),('goals','status'),('goals','id'),('goals','created_at'),
  -- goal_contributions
  ('goal_contributions','goal_id'),('goal_contributions','user_id'),('goal_contributions','amount'),
  ('goal_contributions','date'),('goal_contributions','transaction_id'),
  -- emis
  ('emis','user_id'),('emis','loan_name'),('emis','principal'),('emis','emi_amount'),('emis','start_date'),
  ('emis','tenure_months'),('emis','account_id'),('emis','interest_rate'),('emis','paid_count'),
  ('emis','is_active'),('emis','status'),('emis','id'),('emis','created_at'),
  -- emi_payments
  ('emi_payments','emi_id'),('emi_payments','user_id'),('emi_payments','month'),('emi_payments','due_date'),
  ('emi_payments','paid_date'),('emi_payments','is_prepayment'),('emi_payments','transaction_id'),('emi_payments','id'),
  -- bills
  ('bills','user_id'),('bills','account_id'),('bills','month'),('bills','billing_date'),('bills','due_date'),
  ('bills','status'),('bills','total_amount'),('bills','statement_amount'),('bills','minimum_due'),
  ('bills','total_paid'),('bills','id'),
  -- bill_payments
  ('bill_payments','bill_id'),('bill_payments','user_id'),('bill_payments','amount'),('bill_payments','paid_date'),
  ('bill_payments','account_id'),('bill_payments','note'),('bill_payments','id'),
  -- budget_rules
  ('budget_rules','user_id'),('budget_rules','category'),('budget_rules','monthly_limit'),('budget_rules','month'),
  ('budget_rules','id'),
  -- custom_categories
  ('custom_categories','user_id'),('custom_categories','name'),('custom_categories','id'),
  -- recurring_instances
  ('recurring_instances','user_id'),('recurring_instances','due_date'),('recurring_instances','id')
)
select e.table_name, e.column_name as missing_column
from expected e
left join information_schema.columns c
  on c.table_schema = 'public' and c.table_name = e.table_name and c.column_name = e.column_name
where c.column_name is null
order by e.table_name, e.column_name;


-- ------------------------------------------------------------
-- CHECK B: NOT-NULL COLUMNS THE CODE NEVER INSERTS
-- DB requires the column, but no insert in the app fills it and
-- it has no default -> a "null value violates not-null" crash
-- waiting to happen (the user_id-in-outing_participants class).
-- Review each row: either the app should send it, or the column
-- needs a default / should be made nullable.
-- ------------------------------------------------------------
with inserted(table_name, column_name) as (
  values
  ('accounts','user_id'),('accounts','name'),('accounts','bank_name'),('accounts','type'),('accounts','balance'),
  ('accounts','credit_limit'),('accounts','billing_date'),('accounts','due_date'),('accounts','last_four'),
  ('transactions','user_id'),('transactions','date'),('transactions','amount'),('transactions','type'),
  ('transactions','account_id'),('transactions','to_account_id'),('transactions','category'),('transactions','note'),
  ('transactions','is_personal'),('transactions','goal_id'),('transactions','emi_id'),
  ('split_people','user_id'),('split_people','name'),('split_people','phone'),('split_people','email'),
  ('split_people','notes'),('split_people','opening_balance'),
  ('outings','user_id'),('outings','transaction_id'),('outings','place_name'),('outings','date'),
  ('outings','total_amount'),('outings','paid_by'),('outings','paid_by_person_id'),('outings','total_people'),
  ('outings','your_share'),('outings','notes'),
  ('outing_participants','outing_id'),('outing_participants','user_id'),('outing_participants','person_id'),
  ('outing_participants','share_amount'),
  ('settlements','user_id'),('settlements','person_id'),('settlements','amount'),('settlements','date'),
  ('settlements','account_id'),('settlements','notes'),('settlements','direction'),
  ('loans','user_id'),('loans','direction'),('loans','person_name'),('loans','principal'),('loans','date'),
  ('loans','due_date'),('loans','account_id'),('loans','outstanding'),('loans','status'),('loans','notes'),
  ('loans','monthly_installment'),('loans','repayment_start_date'),
  ('loan_repayments','loan_id'),('loan_repayments','user_id'),('loan_repayments','amount'),
  ('loan_repayments','date'),('loan_repayments','transaction_id'),
  ('recurring_rules','user_id'),('recurring_rules','name'),('recurring_rules','amount'),('recurring_rules','type'),
  ('recurring_rules','account_id'),('recurring_rules','category'),('recurring_rules','note'),
  ('recurring_rules','frequency'),('recurring_rules','interval_days'),('recurring_rules','next_date'),
  ('recurring_rules','end_date'),('recurring_rules','is_active'),
  ('goals','user_id'),('goals','name'),('goals','target_amount'),('goals','target_date'),('goals','account_id'),
  ('goals','current_amount'),('goals','status'),
  ('goal_contributions','goal_id'),('goal_contributions','user_id'),('goal_contributions','amount'),
  ('goal_contributions','date'),('goal_contributions','transaction_id'),
  ('emis','user_id'),('emis','loan_name'),('emis','principal'),('emis','emi_amount'),('emis','start_date'),
  ('emis','tenure_months'),('emis','account_id'),('emis','interest_rate'),('emis','paid_count'),('emis','is_active'),
  ('emi_payments','emi_id'),('emi_payments','user_id'),('emi_payments','month'),('emi_payments','due_date'),
  ('emi_payments','paid_date'),('emi_payments','is_prepayment'),
  ('bills','user_id'),('bills','account_id'),('bills','month'),('bills','billing_date'),('bills','due_date'),
  ('bills','status'),('bills','total_amount'),('bills','statement_amount'),('bills','minimum_due'),('bills','total_paid'),
  ('bill_payments','bill_id'),('bill_payments','user_id'),('bill_payments','amount'),('bill_payments','paid_date'),
  ('bill_payments','account_id'),('bill_payments','note'),
  ('budget_rules','user_id'),('budget_rules','category'),('budget_rules','monthly_limit'),('budget_rules','month'),
  ('custom_categories','user_id'),('custom_categories','name')
)
select c.table_name, c.column_name, c.data_type
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in (
    'accounts','transactions','split_people','outings','outing_participants','settlements','loans',
    'loan_repayments','recurring_rules','goals','goal_contributions','emis','emi_payments','bills',
    'bill_payments','budget_rules','custom_categories'
  )
  and c.is_nullable = 'NO'
  and c.column_default is null
  and c.column_name not in ('id','created_at','updated_at')
  and not exists (
    select 1 from inserted i where i.table_name = c.table_name and i.column_name = c.column_name
  )
order by c.table_name, c.column_name;


-- ------------------------------------------------------------
-- CHECK C: RLS COVERAGE
-- Tables the app writes to that have RLS ON but no INSERT/ALL
-- policy -> inserts get denied (the outing_participants class).
-- insert_or_all_policies = 0 with rls_enabled = true is the red flag.
-- ------------------------------------------------------------
select
  t.tablename,
  t.rowsecurity as rls_enabled,
  count(p.policyname) as total_policies,
  count(*) filter (where p.cmd in ('INSERT','ALL')) as insert_or_all_policies,
  count(*) filter (where p.cmd in ('SELECT','ALL')) as select_or_all_policies
from pg_tables t
left join pg_policies p on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname = 'public'
  and t.tablename in (
    'accounts','transactions','split_people','outings','outing_participants','settlements','profiles','loans',
    'loan_repayments','recurring_rules','goals','goal_contributions','emis','emi_payments','bills',
    'bill_payments','budget_rules','custom_categories','recurring_instances'
  )
group by t.tablename, t.rowsecurity
order by t.tablename;

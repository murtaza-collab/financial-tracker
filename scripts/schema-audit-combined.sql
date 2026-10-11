-- ============================================================
--  SCHEMA AUDIT (combined, single result)  —  read-only
-- ============================================================
-- One query so the SQL editor returns ALL problems at once.
-- issue = 'MISSING COLUMN'         -> code uses a column the DB lacks (ADD it)
-- issue = 'NOT NULL, NOT INSERTED' -> DB requires it, code never sends it,
--                                     no default -> future not-null crash
-- Empty result = both checks clean.
-- ============================================================
with expected(table_name, column_name) as (
  values
  ('accounts','user_id'),('accounts','name'),('accounts','bank_name'),('accounts','type'),
  ('accounts','balance'),('accounts','credit_limit'),('accounts','billing_date'),('accounts','due_date'),
  ('accounts','last_four'),('accounts','is_archived'),('accounts','id'),
  ('transactions','user_id'),('transactions','date'),('transactions','amount'),('transactions','type'),
  ('transactions','account_id'),('transactions','to_account_id'),('transactions','category'),('transactions','note'),
  ('transactions','is_personal'),('transactions','goal_id'),('transactions','emi_id'),('transactions','id'),
  ('transactions','created_at'),
  ('split_people','user_id'),('split_people','name'),('split_people','phone'),('split_people','email'),
  ('split_people','notes'),('split_people','opening_balance'),('split_people','id'),
  ('split_people','linked_user_id'),('split_people','link_status'),
  ('outings','user_id'),('outings','transaction_id'),('outings','place_name'),('outings','date'),
  ('outings','total_amount'),('outings','paid_by'),('outings','paid_by_person_id'),('outings','total_people'),
  ('outings','your_share'),('outings','notes'),('outings','id'),
  ('outing_participants','outing_id'),('outing_participants','user_id'),('outing_participants','person_id'),
  ('outing_participants','share_amount'),
  ('settlements','user_id'),('settlements','person_id'),('settlements','amount'),('settlements','date'),
  ('settlements','account_id'),('settlements','notes'),('settlements','direction'),('settlements','id'),
  ('profiles','id'),('profiles','name'),('profiles','email'),
  ('loans','user_id'),('loans','direction'),('loans','person_name'),('loans','principal'),('loans','date'),
  ('loans','due_date'),('loans','account_id'),('loans','outstanding'),('loans','status'),('loans','notes'),
  ('loans','monthly_installment'),('loans','repayment_start_date'),('loans','id'),
  ('loan_repayments','loan_id'),('loan_repayments','user_id'),('loan_repayments','amount'),
  ('loan_repayments','date'),('loan_repayments','transaction_id'),('loan_repayments','id'),
  ('recurring_rules','user_id'),('recurring_rules','name'),('recurring_rules','amount'),('recurring_rules','type'),
  ('recurring_rules','account_id'),('recurring_rules','category'),('recurring_rules','note'),
  ('recurring_rules','frequency'),('recurring_rules','interval_days'),('recurring_rules','next_date'),
  ('recurring_rules','end_date'),('recurring_rules','is_active'),('recurring_rules','id'),
  ('goals','user_id'),('goals','name'),('goals','target_amount'),('goals','target_date'),('goals','account_id'),
  ('goals','current_amount'),('goals','status'),('goals','id'),('goals','created_at'),
  ('goal_contributions','goal_id'),('goal_contributions','user_id'),('goal_contributions','amount'),
  ('goal_contributions','date'),('goal_contributions','transaction_id'),
  ('emis','user_id'),('emis','loan_name'),('emis','principal'),('emis','emi_amount'),('emis','start_date'),
  ('emis','tenure_months'),('emis','account_id'),('emis','interest_rate'),('emis','paid_count'),
  ('emis','is_active'),('emis','status'),('emis','id'),('emis','created_at'),
  ('emi_payments','emi_id'),('emi_payments','user_id'),('emi_payments','month'),('emi_payments','due_date'),
  ('emi_payments','paid_date'),('emi_payments','is_prepayment'),('emi_payments','transaction_id'),('emi_payments','id'),
  ('bills','user_id'),('bills','account_id'),('bills','month'),('bills','billing_date'),('bills','due_date'),
  ('bills','status'),('bills','total_amount'),('bills','statement_amount'),('bills','minimum_due'),
  ('bills','total_paid'),('bills','id'),
  ('bill_payments','bill_id'),('bill_payments','user_id'),('bill_payments','amount'),('bill_payments','paid_date'),
  ('bill_payments','account_id'),('bill_payments','note'),('bill_payments','id'),
  ('budget_rules','user_id'),('budget_rules','category'),('budget_rules','monthly_limit'),('budget_rules','month'),
  ('budget_rules','id'),
  ('custom_categories','user_id'),('custom_categories','name'),('custom_categories','id'),
  ('recurring_instances','user_id'),('recurring_instances','due_date'),('recurring_instances','id')
),
inserted(table_name, column_name) as (
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
select 'MISSING COLUMN' as issue, e.table_name, e.column_name, null::text as data_type
from expected e
left join information_schema.columns c
  on c.table_schema = 'public' and c.table_name = e.table_name and c.column_name = e.column_name
where c.column_name is null
union all
select 'NOT NULL, NOT INSERTED' as issue, c.table_name, c.column_name, c.data_type
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
order by issue, table_name, column_name;

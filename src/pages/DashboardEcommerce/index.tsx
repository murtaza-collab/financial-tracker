import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, CardBody, CardHeader, Badge, Spinner, Progress } from 'reactstrap';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/currency';

interface Account { id: string; name: string; type: string; balance: number; credit_limit: number; }
interface Transaction { id: string; date: string; amount: number; type: string; category: string; note: string; accounts?: { name: string }; is_personal?: boolean; }
interface Bill { id: string; account_id: string; due_date: string; status: string; statement_amount: number; total_paid: number; accounts?: { name: string }; }
interface Loan { id: string; direction: string; person_name: string; outstanding: number; }
interface EMI { id: string; loan_name: string; emi_amount: number; tenure_months: number; paid_count: number; }
interface Goal { id: string; name: string; target_amount: number; current_amount: number; }
interface BudgetRule { id: string; category: string; monthly_limit: number; }

const MONTH_KEY = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const TYPE_COLORS: Record<string, string> = {
  expense: 'danger', income: 'success', transfer: 'info',
  atm_withdrawal: 'warning', credit_card_payment: 'primary',
  reimbursement_received: 'success', loan_given: 'warning',
  loan_received: 'info', emi_payment: 'danger', goal_contribution: 'success',
};

const TYPE_LABELS: Record<string, string> = {
  expense: 'Expense', income: 'Income', transfer: 'Transfer',
  atm_withdrawal: 'ATM', credit_card_payment: 'Card Payment',
  reimbursement_received: 'Reimbursement', loan_given: 'Loan Given',
  loan_received: 'Loan Received', emi_payment: 'EMI', goal_contribution: 'Goal',
};

const ACCOUNT_ICON: Record<string, { icon: string; color: string }> = {
  bank_savings:  { icon: 'ri-bank-line',                  color: 'success' },
  bank_current:  { icon: 'ri-bank-line',                  color: 'info'    },
  credit_card:   { icon: 'ri-bank-card-line',             color: 'danger'  },
  cash:          { icon: 'ri-money-dollar-circle-line',   color: 'warning' },
  custom_wallet: { icon: 'ri-wallet-3-line',              color: 'primary' },
};

const Dashboard = () => {
  const { user } = useAuth();
  const [accounts, setAccounts]         = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bills, setBills]               = useState<Bill[]>([]);
  const [loans, setLoans]               = useState<Loan[]>([]);
  const [emis, setEmis]                 = useState<EMI[]>([]);
  const [goals, setGoals]               = useState<Goal[]>([]);
  const [budgets, setBudgets]           = useState<BudgetRule[]>([]);
  const [splitsPending, setSplitsPending] = useState(0);
  const [loading, setLoading]           = useState(true);

  document.title = 'Dashboard | Finance Portal';

  const fetchAll = async () => {
    setLoading(true);
    const startOfMonth = new Date();
    startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

    const [
      { data: accData },
      { data: txData },
      { data: billData },
      { data: loanData },
      { data: emiData },
      { data: goalData },
      { data: budgetData },
      { data: outingData },
      { data: settlementData },
    ] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', user?.id).eq('is_archived', false),
      supabase.from('transactions')
        .select('*, accounts!transactions_account_id_fkey(name)')
        .eq('user_id', user?.id)
        .gte('date', startOfMonth.toISOString())
        .order('date', { ascending: false }),
      supabase.from('bills')
        .select('*, accounts!bills_account_id_fkey(name)')
        .eq('user_id', user?.id).eq('month', MONTH_KEY()).neq('status', 'paid'),
      supabase.from('loans')
        .select('id, direction, person_name, outstanding')
        .eq('user_id', user?.id).eq('status', 'active'),
      supabase.from('emis')
        .select('id, loan_name, emi_amount, tenure_months, paid_count, status')
        .eq('user_id', user?.id),
      supabase.from('goals')
        .select('id, name, target_amount, current_amount')
        .eq('user_id', user?.id).eq('status', 'active'),
      supabase.from('budget_rules').select('*').eq('user_id', user?.id).eq('month', MONTH_KEY()),
      supabase.from('outings').select('total_amount, your_share').eq('user_id', user?.id),
      supabase.from('settlements').select('amount').eq('user_id', user?.id),
    ]);

    if (accData) setAccounts(accData);
    if (txData)  setTransactions(txData);
    if (billData) setBills(billData);
    if (loanData) setLoans(loanData);
    if (emiData)  setEmis((emiData as any[]).filter(e => e.status !== 'closed'));
    if (goalData) setGoals(goalData);
    if (budgetData) setBudgets(budgetData);

    const totalToRecover = (outingData || []).reduce(
      (s: number, o: any) => s + ((o.total_amount || 0) - (o.your_share || 0)), 0
    );
    const totalRecovered = (settlementData || []).reduce(
      (s: number, st: any) => s + Number(st.amount), 0
    );
    setSplitsPending(Math.max(0, totalToRecover - totalRecovered));
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Calculations ────────────────────────────────────────────────────
  const bankBalance = accounts
    .filter(a => ['bank_savings', 'bank_current', 'cash', 'custom_wallet'].includes(a.type))
    .reduce((s, a) => s + Number(a.balance), 0);

  const creditOutstanding = accounts
    .filter(a => a.type === 'credit_card')
    .reduce((s, a) => s + Number(a.balance), 0);

  const netWorth = bankBalance - creditOutstanding;

  const personalTx = transactions.filter(t => t.is_personal !== false);

  const monthIncome = personalTx
    .filter(t => ['income', 'reimbursement_received', 'loan_received'].includes(t.type))
    .reduce((s, t) => s + Number(t.amount), 0);

  const monthExpenses = personalTx
    .filter(t => ['expense', 'loan_given', 'emi_payment', 'atm_withdrawal', 'goal_contribution'].includes(t.type))
    .reduce((s, t) => s + Number(t.amount), 0);

  const familyCardUsage = transactions
    .filter(t => t.is_personal === false && t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0);

  const monthSavings  = monthIncome - monthExpenses;
  const savingsRate   = monthIncome > 0 ? Math.round((monthSavings / monthIncome) * 100) : 0;

  const loansGiven     = loans.filter(l => l.direction === 'given');
  const loansTaken     = loans.filter(l => l.direction === 'taken');
  const totalOwedToMe  = loansGiven.reduce((s, l) => s + Number(l.outstanding), 0);
  const totalIOwe      = loansTaken.reduce((s, l) => s + Number(l.outstanding), 0);
  const monthlyEMI     = emis.reduce((s, e) => s + Number(e.emi_amount), 0);

  const categorySpend: Record<string, number> = {};
  personalTx
    .filter(t => ['expense', 'emi_payment', 'goal_contribution'].includes(t.type))
    .forEach(t => {
      const cat = t.category || 'Other';
      categorySpend[cat] = (categorySpend[cat] || 0) + Number(t.amount);
    });

  const budgetItems = budgets
    .map(b => ({
      category: b.category,
      limit: b.monthly_limit,
      spent: categorySpend[b.category] || 0,
      pct: Math.min(100, Math.round(((categorySpend[b.category] || 0) / b.monthly_limit) * 100)),
    }))
    .sort((a, b) => b.pct - a.pct);

  const getDaysUntil = (dateStr: string) => {
    const days = Math.ceil((new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
    if (days < 0)  return { text: `Overdue ${Math.abs(days)}d`, color: 'danger' };
    if (days === 0) return { text: 'Due Today',                  color: 'danger' };
    if (days <= 3)  return { text: `${days}d left`,              color: 'warning' };
    return             { text: `${days}d left`,              color: 'info' };
  };

  if (loading) return (
    <div className="page-content">
      <div className="text-center py-5"><Spinner color="primary" /></div>
    </div>
  );

  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>

          <div className="mb-4">
            <h4 className="mb-1">Dashboard</h4>
            <p className="text-muted mb-0">
              {new Date().toLocaleDateString('en-PK', { month: 'long', year: 'numeric' })} — Your complete financial picture
            </p>
          </div>

          {/* ── Row 1 · Position ─────────────────────────────────────────── */}
          <Row className="mb-3">
            <Col md={4}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1 fs-13">Net Worth</p>
                      <h4 className={netWorth >= 0 ? 'text-success' : 'text-danger'}>{formatCurrency(netWorth)}</h4>
                      <small className="text-muted">Bank − Credit Cards</small>
                    </div>
                    <div className="avatar-sm">
                      <span className="avatar-title bg-success-subtle rounded-circle fs-3">
                        <i className="ri-funds-line text-success"></i>
                      </span>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1 fs-13">Bank & Cash</p>
                      <h4 className="text-success">{formatCurrency(bankBalance)}</h4>
                      <small className="text-muted">{accounts.filter(a => a.type !== 'credit_card').length} accounts</small>
                    </div>
                    <div className="avatar-sm">
                      <span className="avatar-title bg-info-subtle rounded-circle fs-3">
                        <i className="ri-bank-line text-info"></i>
                      </span>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1 fs-13">Credit Outstanding</p>
                      <h4 className="text-danger">{formatCurrency(creditOutstanding)}</h4>
                      <small className="text-muted">{accounts.filter(a => a.type === 'credit_card').length} credit cards</small>
                    </div>
                    <div className="avatar-sm">
                      <span className="avatar-title bg-danger-subtle rounded-circle fs-3">
                        <i className="ri-bank-card-line text-danger"></i>
                      </span>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </Col>
          </Row>

          {/* ── Row 2 · This Month ───────────────────────────────────────── */}
          <Row className="mb-4">
            <Col md={4}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1 fs-13">Income This Month</p>
                      <h4 className="text-success">+{formatCurrency(monthIncome)}</h4>
                      <small className="text-muted">
                        {personalTx.filter(t => ['income', 'reimbursement_received', 'loan_received'].includes(t.type)).length} entries
                      </small>
                    </div>
                    <div className="avatar-sm">
                      <span className="avatar-title bg-success-subtle rounded-circle fs-3">
                        <i className="ri-arrow-down-circle-line text-success"></i>
                      </span>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1 fs-13">Spent This Month</p>
                      <h4 className="text-danger">-{formatCurrency(monthExpenses)}</h4>
                      <small className="text-muted">
                        {personalTx.filter(t => ['expense', 'loan_given', 'emi_payment', 'atm_withdrawal', 'goal_contribution'].includes(t.type)).length} transactions
                      </small>
                    </div>
                    <div className="avatar-sm">
                      <span className="avatar-title bg-danger-subtle rounded-circle fs-3">
                        <i className="ri-arrow-up-circle-line text-danger"></i>
                      </span>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1 fs-13">Saved This Month</p>
                      <h4 className={monthSavings >= 0 ? 'text-success' : 'text-danger'}>
                        {monthSavings >= 0 ? '+' : ''}{formatCurrency(monthSavings)}
                      </h4>
                      <small className={
                        monthIncome === 0 ? 'text-muted'
                          : savingsRate >= 20 ? 'text-success'
                          : savingsRate >= 0  ? 'text-warning'
                          : 'text-danger'
                      }>
                        {monthIncome > 0 ? `${savingsRate}% savings rate` : 'No income recorded'}
                      </small>
                    </div>
                    <div className="avatar-sm">
                      <span className={`avatar-title bg-${monthSavings >= 0 ? 'warning' : 'danger'}-subtle rounded-circle fs-3`}>
                        <i className={`ri-piggy-bank-line text-${monthSavings >= 0 ? 'warning' : 'danger'}`}></i>
                      </span>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </Col>
          </Row>

          {/* ── Family Card Usage ───────────────────────────────────────── */}
          {familyCardUsage > 0 && (
            <Row className="mb-4">
              <Col md={4}>
                <Card className="card-animate border-secondary">
                  <CardBody>
                    <div className="d-flex justify-content-between">
                      <div>
                        <p className="text-muted mb-1 fs-13">Family Card Usage</p>
                        <h4 className="text-secondary">{formatCurrency(familyCardUsage)}</h4>
                        <small className="text-muted">
                          {transactions.filter(t => t.is_personal === false && t.type === 'expense').length} transactions — not in your budget
                        </small>
                      </div>
                      <div className="avatar-sm">
                        <span className="avatar-title bg-secondary-subtle rounded-circle fs-3">
                          <i className="ri-user-shared-line text-secondary"></i>
                        </span>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </Col>
            </Row>
          )}

          {/* ── Row 3 · Budget + Loans ───────────────────────────────────── */}
          <Row className="mb-4">
            <Col md={6}>
              <Card className="h-100">
                <CardHeader className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">Budget This Month</h5>
                  <Link to="/budget" className="text-primary fs-12">Manage</Link>
                </CardHeader>
                <CardBody>
                  {budgetItems.length === 0 ? (
                    <div className="text-center py-4">
                      <i className="ri-pie-chart-line fs-1 text-muted"></i>
                      <p className="text-muted mt-2 mb-2">No budget rules set for this month.</p>
                      <Link to="/budget" className="btn btn-sm btn-soft-primary">Set Budget</Link>
                    </div>
                  ) : (
                    budgetItems.map(b => {
                      const barColor = b.pct >= 90 ? 'danger' : b.pct >= 70 ? 'warning' : 'success';
                      return (
                        <div key={b.category} className="mb-3">
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <span className="fs-13 fw-semibold">{b.category}</span>
                            <span className="fs-12 text-muted">
                              {formatCurrency(b.spent)} / {formatCurrency(b.limit)}
                              {b.pct >= 100 && <Badge color="danger" pill className="ms-1">Over</Badge>}
                            </span>
                          </div>
                          <Progress value={b.pct} color={barColor} style={{ height: 6 }} />
                        </div>
                      );
                    })
                  )}
                </CardBody>
              </Card>
            </Col>

            <Col md={6}>
              <Card className="h-100">
                <CardHeader className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">Loans</h5>
                  <Link to="/loans-given" className="text-primary fs-12">View all</Link>
                </CardHeader>
                <CardBody>
                  {loans.length === 0 ? (
                    <div className="text-center py-4">
                      <i className="ri-shake-hands-line fs-1 text-muted"></i>
                      <p className="text-muted mt-2">No active loans.</p>
                    </div>
                  ) : (
                    <>
                      <Row className="g-2 mb-3">
                        <Col xs={6}>
                          <div className="border rounded p-2 text-center">
                            <p className="text-muted fs-12 mb-1">Owed to Me</p>
                            <h6 className="text-success mb-0">{formatCurrency(totalOwedToMe)}</h6>
                            <small className="text-muted">{loansGiven.length} loan{loansGiven.length !== 1 ? 's' : ''}</small>
                          </div>
                        </Col>
                        <Col xs={6}>
                          <div className="border rounded p-2 text-center">
                            <p className="text-muted fs-12 mb-1">I Owe</p>
                            <h6 className="text-danger mb-0">{formatCurrency(totalIOwe)}</h6>
                            <small className="text-muted">{loansTaken.length} loan{loansTaken.length !== 1 ? 's' : ''}</small>
                          </div>
                        </Col>
                      </Row>
                      {loans.slice(0, 5).map(loan => (
                        <div key={loan.id} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                          <div>
                            <p className="mb-0 fs-13 fw-semibold">{loan.person_name}</p>
                            <small className={`text-${loan.direction === 'given' ? 'success' : 'danger'}`}>
                              {loan.direction === 'given' ? 'They owe you' : 'You owe them'}
                            </small>
                          </div>
                          <span className={`fw-semibold fs-13 text-${loan.direction === 'given' ? 'success' : 'danger'}`}>
                            {formatCurrency(loan.outstanding)}
                          </span>
                        </div>
                      ))}
                      {loans.length > 5 && (
                        <p className="text-muted fs-12 mt-2 mb-0 text-center">+{loans.length - 5} more</p>
                      )}
                    </>
                  )}
                </CardBody>
              </Card>
            </Col>
          </Row>

          {/* ── Row 4 · Goals + EMIs + Splits ───────────────────────────── */}
          <Row className="mb-4">
            <Col md={4}>
              <Card className="h-100">
                <CardHeader className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">Goals</h5>
                  <Link to="/goals" className="text-primary fs-12">View all</Link>
                </CardHeader>
                <CardBody>
                  {goals.length === 0 ? (
                    <div className="text-center py-4">
                      <i className="ri-trophy-line fs-1 text-muted"></i>
                      <p className="text-muted mt-2 mb-2">No active goals.</p>
                      <Link to="/goals" className="btn btn-sm btn-soft-primary">Add Goal</Link>
                    </div>
                  ) : (
                    goals.map(g => {
                      const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100));
                      return (
                        <div key={g.id} className="mb-3">
                          <div className="d-flex justify-content-between mb-1">
                            <span className="fs-13 fw-semibold">{g.name}</span>
                            <span className="fs-12 text-muted">{pct}%</span>
                          </div>
                          <Progress value={pct} color="info" style={{ height: 6 }} />
                          <div className="d-flex justify-content-between mt-1">
                            <small className="text-muted">{formatCurrency(g.current_amount)}</small>
                            <small className="text-muted">{formatCurrency(g.target_amount)}</small>
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardBody>
              </Card>
            </Col>

            <Col md={4}>
              <Card className="h-100">
                <CardHeader className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">EMIs</h5>
                  <Link to="/emis" className="text-primary fs-12">View all</Link>
                </CardHeader>
                <CardBody>
                  {emis.length === 0 ? (
                    <div className="text-center py-4">
                      <i className="ri-calendar-check-line fs-1 text-muted"></i>
                      <p className="text-muted mt-2">No active EMIs.</p>
                    </div>
                  ) : (
                    <>
                      <div className="border rounded p-2 text-center mb-3">
                        <p className="text-muted fs-12 mb-1">Monthly Commitment</p>
                        <h5 className="text-danger mb-0">{formatCurrency(monthlyEMI)}</h5>
                        <small className="text-muted">{emis.length} active EMI{emis.length !== 1 ? 's' : ''}</small>
                      </div>
                      {emis.map(e => {
                        const remaining = e.tenure_months - e.paid_count;
                        return (
                          <div key={e.id} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                            <div>
                              <p className="mb-0 fs-13 fw-semibold">{e.loan_name}</p>
                              <small className="text-muted">{remaining} month{remaining !== 1 ? 's' : ''} left</small>
                            </div>
                            <span className="fw-semibold fs-13 text-danger">{formatCurrency(e.emi_amount)}/mo</span>
                          </div>
                        );
                      })}
                    </>
                  )}
                </CardBody>
              </Card>
            </Col>

            <Col md={4}>
              <Card className="h-100">
                <CardHeader className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">Splits to Recover</h5>
                  <Link to="/splits" className="text-primary fs-12">View all</Link>
                </CardHeader>
                <CardBody>
                  {splitsPending <= 0 ? (
                    <div className="text-center py-4">
                      <i className="ri-group-line fs-1 text-success"></i>
                      <p className="text-muted mt-2">All splits settled!</p>
                    </div>
                  ) : (
                    <div className="text-center py-3">
                      <i className="ri-group-line fs-1 text-warning"></i>
                      <p className="text-muted mt-2 mb-1">Pending recovery</p>
                      <h4 className="text-warning">{formatCurrency(splitsPending)}</h4>
                      <Link to="/splits" className="btn btn-sm btn-soft-warning mt-2">
                        See who owes what
                      </Link>
                    </div>
                  )}
                </CardBody>
              </Card>
            </Col>
          </Row>

          {/* ── Row 5 · Bills + Accounts + Recent Transactions ──────────── */}
          <Row>
            <Col md={4}>
              <Card className="h-100">
                <CardHeader className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">Upcoming Bills</h5>
                  <Link to="/credit-cards" className="text-primary fs-12">View all</Link>
                </CardHeader>
                <CardBody>
                  {bills.length === 0 ? (
                    <div className="text-center py-4">
                      <i className="ri-checkbox-circle-line fs-1 text-success"></i>
                      <p className="text-muted mt-2">All bills paid!</p>
                    </div>
                  ) : (
                    bills.map(bill => {
                      const due       = getDaysUntil(bill.due_date);
                      const remaining = (bill.statement_amount || 0) - (bill.total_paid || 0);
                      return (
                        <div key={bill.id} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                          <div>
                            <p className="mb-0 fw-semibold fs-13">{bill.accounts?.name}</p>
                            <small className="text-muted">Due: {formatCurrency(remaining)}</small>
                          </div>
                          <Badge color={due.color} pill>{due.text}</Badge>
                        </div>
                      );
                    })
                  )}
                </CardBody>
              </Card>
            </Col>

            <Col md={4}>
              <Card className="h-100">
                <CardHeader className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">Accounts</h5>
                  <Link to="/accounts" className="text-primary fs-12">Manage</Link>
                </CardHeader>
                <CardBody>
                  {accounts.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-muted">No accounts added yet</p>
                    </div>
                  ) : (
                    accounts.map(acc => {
                      const ic = ACCOUNT_ICON[acc.type] || { icon: 'ri-wallet-line', color: 'secondary' };
                      return (
                        <div key={acc.id} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                          <div className="d-flex align-items-center gap-2">
                            <div className="avatar-xs">
                              <span className={`avatar-title rounded-circle fs-12 bg-${ic.color}-subtle`}>
                                <i className={`${ic.icon} text-${ic.color} fs-14`}></i>
                              </span>
                            </div>
                            <p className="mb-0 fs-13 fw-semibold">{acc.name}</p>
                          </div>
                          <span className={`fw-semibold fs-13 text-${acc.type === 'credit_card' ? 'danger' : 'success'}`}>
                            {formatCurrency(acc.balance)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </CardBody>
              </Card>
            </Col>

            <Col md={4}>
              <Card className="h-100">
                <CardHeader className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">Recent Transactions</h5>
                  <Link to="/transactions" className="text-primary fs-12">View all</Link>
                </CardHeader>
                <CardBody className="p-0">
                  {transactions.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-muted">No transactions this month</p>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover table-sm mb-0">
                        <tbody>
                          {transactions
                            .filter(t => t.type !== 'credit_card_payment')
                            .slice(0, 10)
                            .map(tx => {
                              const isIn = ['income', 'reimbursement_received', 'loan_received'].includes(tx.type);
                              return (
                                <tr key={tx.id}>
                                  <td className="ps-3">
                                    <p className="mb-0 fs-12 fw-semibold">
                                      {tx.note || tx.category || tx.accounts?.name || '—'}
                                    </p>
                                    <small className="text-muted">
                                      {new Date(tx.date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })}
                                    </small>
                                  </td>
                                  <td className="text-center">
                                    <Badge color={TYPE_COLORS[tx.type]} pill className="fs-10">
                                      {TYPE_LABELS[tx.type]}
                                    </Badge>
                                  </td>
                                  <td className={`text-end pe-3 fw-semibold fs-12 ${isIn ? 'text-success' : 'text-danger'}`}>
                                    {isIn ? '+' : '-'}{formatCurrency(tx.amount)}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardBody>
              </Card>
            </Col>
          </Row>

        </Container>
      </div>
    </React.Fragment>
  );
};

export default Dashboard;

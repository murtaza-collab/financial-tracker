import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, CardBody, CardHeader, Badge, Spinner } from 'reactstrap';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/currency';

interface Account { id: string; name: string; type: string; balance: number; credit_limit: number; }
interface Transaction { id: string; date: string; amount: number; type: string; category: string; note: string; accounts?: { name: string }; }
interface Bill { id: string; account_id: string; due_date: string; status: string; statement_amount: number; total_paid: number; accounts?: { name: string }; }

const MONTH_KEY = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const Dashboard = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  document.title = 'Dashboard | Finance Portal';

  const fetchAll = async () => {
    setLoading(true);

    const { data: accData } = await supabase
      .from('accounts').select('*')
      .eq('user_id', user?.id).eq('is_archived', false);

    const startOfMonth = new Date();
    startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

    const { data: txData } = await supabase
      .from('transactions')
      .select('*, accounts!transactions_account_id_fkey(name)')
      .eq('user_id', user?.id)
      .gte('date', startOfMonth.toISOString())
      .order('date', { ascending: false })
      .limit(10);

    const { data: billData } = await supabase
      .from('bills')
      .select('*, accounts!bills_account_id_fkey(name)')
      .eq('user_id', user?.id)
      .eq('month', MONTH_KEY())
      .neq('status', 'paid');

    if (accData) setAccounts(accData);
    if (txData) setTransactions(txData);
    if (billData) setBills(billData);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Calculations
  const bankBalance = accounts
    .filter(a => ['bank_savings', 'bank_current', 'cash', 'custom_wallet'].includes(a.type))
    .reduce((s, a) => s + Number(a.balance), 0);

  const creditOutstanding = accounts
    .filter(a => a.type === 'credit_card')
    .reduce((s, a) => s + Number(a.balance), 0);

  const netWorth = bankBalance - creditOutstanding;

  const monthIncome = transactions
    .filter(t => ['income', 'reimbursement_received', 'loan_received'].includes(t.type))
    .reduce((s, t) => s + Number(t.amount), 0);

  const monthExpenses = transactions
    .filter(t => ['expense', 'loan_given', 'emi_payment', 'atm_withdrawal', 'goal_contribution'].includes(t.type))
    .reduce((s, t) => s + Number(t.amount), 0);

  const upcomingBills = bills.filter(b => {
    if (!b.due_date) return false;
    const days = Math.ceil((new Date(b.due_date).getTime() - new Date().setHours(0,0,0,0)) / 86400000);
    return days <= 7;
  });

  const getDaysUntil = (dateStr: string) => {
    const days = Math.ceil((new Date(dateStr).getTime() - new Date().setHours(0,0,0,0)) / 86400000);
    if (days < 0) return { text: `Overdue ${Math.abs(days)}d`, color: 'danger' };
    if (days === 0) return { text: 'Due Today', color: 'danger' };
    if (days <= 3) return { text: `${days}d left`, color: 'warning' };
    return { text: `${days}d left`, color: 'info' };
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
            <p className="text-muted mb-0">Your complete financial picture</p>
          </div>

          {/* Net Worth Row */}
          <Row className="mb-4">
            <Col md={3}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1 fs-13">Net Worth</p>
                      <h4 className={netWorth >= 0 ? 'text-success' : 'text-danger'}>
                        {formatCurrency(netWorth)}
                      </h4>
                      <small className="text-muted">Bank - Credit Cards</small>
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
            <Col md={3}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1 fs-13">Bank & Cash</p>
                      <h4 className="text-success">{formatCurrency(bankBalance)}</h4>
                      <small className="text-muted">All accounts combined</small>
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
            <Col md={3}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1 fs-13">Credit Outstanding</p>
                      <h4 className="text-danger">{formatCurrency(creditOutstanding)}</h4>
                      <small className="text-muted">All credit cards</small>
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
            <Col md={3}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1 fs-13">This Month</p>
                      <h4 className="text-success">+{formatCurrency(monthIncome)}</h4>
                      <small className="text-danger">-{formatCurrency(monthExpenses)} spent</small>
                    </div>
                    <div className="avatar-sm">
                      <span className="avatar-title bg-warning-subtle rounded-circle fs-3">
                        <i className="ri-exchange-line text-warning"></i>
                      </span>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </Col>
          </Row>

          <Row>
            {/* Upcoming Bills */}
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
                      const due = getDaysUntil(bill.due_date);
                      const remaining = (bill.statement_amount || 0) - (bill.total_paid || 0);
                      return (
                        <div key={bill.id} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                          <div>
                            <p className="mb-0 fw-semibold fs-13">{bill.accounts?.name}</p>
                            <small className="text-muted">
                              Remaining: {formatCurrency(remaining)}
                            </small>
                          </div>
                          <Badge color={due.color} pill>{due.text}</Badge>
                        </div>
                      );
                    })
                  )}
                </CardBody>
              </Card>
            </Col>

            {/* Account Balances */}
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
                    accounts.map(acc => (
                      <div key={acc.id} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                        <div className="d-flex align-items-center gap-2">
                          <div className={`avatar-xs`}>
                            <span className={`avatar-title rounded-circle fs-12 bg-${acc.type === 'credit_card' ? 'danger' : 'success'}-subtle`}>
                              <i className={`${acc.type === 'credit_card' ? 'ri-bank-card-line text-danger' : 'ri-bank-line text-success'} fs-14`}></i>
                            </span>
                          </div>
                          <div>
                            <p className="mb-0 fs-13 fw-semibold">{acc.name}</p>
                          </div>
                        </div>
                        <span className={`fw-semibold fs-13 ${acc.type === 'credit_card' ? 'text-danger' : 'text-success'}`}>
                          {formatCurrency(acc.balance)}
                        </span>
                      </div>
                    ))
                  )}
                </CardBody>
              </Card>
            </Col>

            {/* Recent Transactions */}
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
                          {transactions.filter(t => t.type !== 'credit_card_payment').slice(0, 8).map(tx => {
                            const isIn = ['income', 'reimbursement_received', 'loan_received'].includes(tx.type);
                            return (
                              <tr key={tx.id}>
                                <td className="ps-3">
                                  <p className="mb-0 fs-12 fw-semibold">{tx.category || tx.accounts?.name || '—'}</p>
                                  <small className="text-muted">{new Date(tx.date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })}</small>
                                </td>
                                <td className="text-center">
                                  <Badge color={TYPE_COLORS[tx.type]} pill className="fs-10">{TYPE_LABELS[tx.type]}</Badge>
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
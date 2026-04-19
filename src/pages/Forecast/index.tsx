import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, CardBody, CardHeader, Badge, Spinner, Table } from 'reactstrap';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/currency';
import BreadCrumb from '../../Components/Common/BreadCrumb';

interface EMI { id: string; loan_name: string; emi_amount: number; is_active: boolean; }
interface Bill { id: string; due_date: string; statement_amount: number; total_paid: number; status: string; accounts?: { name: string }; }
interface Loan { id: string; person_name: string; outstanding: number; due_date: string; direction: string; status: string; }
interface Transaction { id: string; amount: number; type: string; category: string; date: string; }

const getMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const getMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-');
  return new Date(Number(year), Number(month) - 1).toLocaleDateString('en-PK', { month: 'short', year: 'numeric' });
};

const Forecast = () => {
  const { user } = useAuth();
  const [emis, setEmis] = useState<EMI[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  document.title = 'Forecast | Finance Portal';

  const fetchData = async () => {
    setLoading(true);

    const currentMonth = getMonthKey(new Date());

    const [{ data: emiData }, { data: billData }, { data: loanData }, { data: txData }] = await Promise.all([
      supabase.from('emis').select('id, loan_name, emi_amount, is_active').eq('user_id', user?.id).eq('is_active', true),
      supabase.from('bills').select('*, accounts!bills_account_id_fkey(name)').eq('user_id', user?.id).eq('month', currentMonth),
      supabase.from('loans').select('*').eq('user_id', user?.id).eq('status', 'active'),
      supabase.from('transactions').select('id, amount, type, category, date')
        .eq('user_id', user?.id)
        .eq('type', 'expense')
        .gte('date', new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1).toISOString())
        .order('date', { ascending: false }),
    ]);

    if (emiData) setEmis(emiData);
    if (billData) setBills(billData);
    if (loanData) setLoans(loanData);
    if (txData) setTransactions(txData);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Calculate average monthly spending by category (last 2 months)
  const avgSpending = () => {
    const catMap: Record<string, number[]> = {};
    transactions.forEach(tx => {
      const month = tx.date.slice(0, 7);
      if (!catMap[tx.category]) catMap[tx.category] = [];
      catMap[tx.category].push(Number(tx.amount));
    });
    return Object.entries(catMap).map(([category, amounts]) => ({
      category,
      avg: amounts.reduce((s, a) => s + a, 0) / 2,
    })).sort((a, b) => b.avg - a.avg);
  };

  // Build 3-month forecast
  const buildForecast = () => {
    const months = Array.from({ length: 3 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() + i);
      return getMonthKey(d);
    });

    const avgExp = avgSpending();
    const totalAvgExpenses = avgExp.reduce((s, c) => s + c.avg, 0);
    const totalMonthlyEMI = emis.reduce((s, e) => s + Number(e.emi_amount), 0);

    return months.map((month, idx) => {
      const committed = totalMonthlyEMI;

      // Credit card bills due this month
      const cardBillsDue = idx === 0
        ? bills.filter(b => b.status !== 'paid').reduce((s, b) => s + Math.max(0, (b.statement_amount || 0) - (b.total_paid || 0)), 0)
        : 0;

      // Loans due this month
      const loansDue = loans.filter(l => {
        if (!l.due_date || l.direction !== 'taken') return false;
        return l.due_date.slice(0, 7) === month;
      }).reduce((s, l) => s + Number(l.outstanding), 0);

      const variableExpenses = totalAvgExpenses;
      const total = committed + cardBillsDue + loansDue + variableExpenses;

      return { month, committed, cardBillsDue, loansDue, variableExpenses, total };
    });
  };

  const forecast = buildForecast();
  const avgExp = avgSpending();
  const totalMonthlyEMI = emis.reduce((s, e) => s + Number(e.emi_amount), 0);
  const pendingCardBills = bills.filter(b => b.status !== 'paid').reduce((s, b) => s + Math.max(0, (b.statement_amount || 0) - (b.total_paid || 0)), 0);
  const activeLoansToPayBack = loans.filter(l => l.direction === 'taken');

  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>
          <BreadCrumb title="Cash Flow Forecast" pageTitle="Finance Portal" />

          {loading ? (
            <div className="text-center py-5"><Spinner color="primary" /></div>
          ) : (
            <>
              {/* Committed Expenses */}
              <Row className="mb-4">
                <Col md={4}>
                  <Card className="card-animate">
                    <CardBody>
                      <div className="d-flex justify-content-between">
                        <div>
                          <p className="text-muted mb-1">Monthly EMI Commitment</p>
                          <h4 className="text-danger">{formatCurrency(totalMonthlyEMI)}</h4>
                          <small className="text-muted">{emis.length} active loans</small>
                        </div>
                        <div className="avatar-sm"><span className="avatar-title bg-danger-subtle rounded-circle fs-3"><i className="ri-calendar-check-line text-danger"></i></span></div>
                      </div>
                    </CardBody>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="card-animate">
                    <CardBody>
                      <div className="d-flex justify-content-between">
                        <div>
                          <p className="text-muted mb-1">Pending Card Bills</p>
                          <h4 className="text-warning">{formatCurrency(pendingCardBills)}</h4>
                          <small className="text-muted">This month unpaid</small>
                        </div>
                        <div className="avatar-sm"><span className="avatar-title bg-warning-subtle rounded-circle fs-3"><i className="ri-bank-card-line text-warning"></i></span></div>
                      </div>
                    </CardBody>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="card-animate">
                    <CardBody>
                      <div className="d-flex justify-content-between">
                        <div>
                          <p className="text-muted mb-1">Loans to Pay Back</p>
                          <h4 className="text-danger">{formatCurrency(activeLoansToPayBack.reduce((s, l) => s + Number(l.outstanding), 0))}</h4>
                          <small className="text-muted">{activeLoansToPayBack.length} active</small>
                        </div>
                        <div className="avatar-sm"><span className="avatar-title bg-danger-subtle rounded-circle fs-3"><i className="ri-money-dollar-circle-line text-danger"></i></span></div>
                      </div>
                    </CardBody>
                  </Card>
                </Col>
              </Row>

              {/* 3 Month Forecast */}
              <Card className="mb-4">
                <CardHeader><h5 className="mb-0">3-Month Cash Flow Forecast</h5></CardHeader>
                <CardBody>
                  <Row>
                    {forecast.map((f, i) => (
                      <Col md={4} key={f.month}>
                        <Card className={`border ${i === 0 ? 'border-primary' : ''}`}>
                          <CardBody>
                            <div className="d-flex justify-content-between align-items-center mb-3">
                              <h6 className="mb-0">{getMonthLabel(f.month)}</h6>
                              {i === 0 && <Badge color="primary" pill>Current</Badge>}
                              {i === 1 && <Badge color="info" pill>Next</Badge>}
                              {i === 2 && <Badge color="secondary" pill>Following</Badge>}
                            </div>
                            <div className="mb-2">
                              <div className="d-flex justify-content-between py-1 border-bottom">
                                <small className="text-muted">EMIs</small>
                                <small className="fw-semibold text-danger">{formatCurrency(f.committed)}</small>
                              </div>
                              {f.cardBillsDue > 0 && (
                                <div className="d-flex justify-content-between py-1 border-bottom">
                                  <small className="text-muted">Card Bills</small>
                                  <small className="fw-semibold text-warning">{formatCurrency(f.cardBillsDue)}</small>
                                </div>
                              )}
                              {f.loansDue > 0 && (
                                <div className="d-flex justify-content-between py-1 border-bottom">
                                  <small className="text-muted">Loan Repayments</small>
                                  <small className="fw-semibold text-danger">{formatCurrency(f.loansDue)}</small>
                                </div>
                              )}
                              <div className="d-flex justify-content-between py-1 border-bottom">
                                <small className="text-muted">Avg Variable Expenses</small>
                                <small className="fw-semibold">{formatCurrency(f.variableExpenses)}</small>
                              </div>
                              <div className="d-flex justify-content-between py-2 mt-1">
                                <span className="fw-semibold">Estimated Total</span>
                                <span className="fw-semibold text-danger fs-15">{formatCurrency(f.total)}</span>
                              </div>
                            </div>
                          </CardBody>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                </CardBody>
              </Card>

              {/* EMI Schedule */}
              {emis.length > 0 && (
                <Card className="mb-4">
                  <CardHeader><h5 className="mb-0">Active EMIs</h5></CardHeader>
                  <CardBody>
                    <Table className="table-hover mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Loan</th>
                          <th className="text-end">Monthly EMI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {emis.map(emi => (
                          <tr key={emi.id}>
                            <td>{emi.loan_name}</td>
                            <td className="text-end text-danger fw-semibold">{formatCurrency(emi.emi_amount)}</td>
                          </tr>
                        ))}
                        <tr className="table-light">
                          <td className="fw-semibold">Total Monthly EMI</td>
                          <td className="text-end fw-semibold text-danger">{formatCurrency(totalMonthlyEMI)}</td>
                        </tr>
                      </tbody>
                    </Table>
                  </CardBody>
                </Card>
              )}

              {/* Average Spending by Category */}
              {avgExp.length > 0 && (
                <Card>
                  <CardHeader>
                    <h5 className="mb-0">Average Monthly Spending by Category</h5>
                    <small className="text-muted">Based on last 2 months of expense data</small>
                  </CardHeader>
                  <CardBody>
                    <Table className="table-hover mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Category</th>
                          <th className="text-end">Avg / Month</th>
                        </tr>
                      </thead>
                      <tbody>
                        {avgExp.map(c => (
                          <tr key={c.category}>
                            <td>{c.category || 'Uncategorized'}</td>
                            <td className="text-end fw-semibold">{formatCurrency(c.avg)}</td>
                          </tr>
                        ))}
                        <tr className="table-light">
                          <td className="fw-semibold">Total</td>
                          <td className="text-end fw-semibold">{formatCurrency(avgExp.reduce((s, c) => s + c.avg, 0))}</td>
                        </tr>
                      </tbody>
                    </Table>
                  </CardBody>
                </Card>
              )}
            </>
          )}
        </Container>
      </div>
    </React.Fragment>
  );
};

export default Forecast;
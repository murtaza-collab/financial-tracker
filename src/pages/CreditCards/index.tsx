import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, CardBody, CardHeader, Button, Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Input, Alert, Badge, Spinner, Progress, Table } from 'reactstrap';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/currency';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import StatementRecon from './StatementRecon';

interface CreditCard {
  id: string; name: string; bank_name: string; balance: number;
  credit_limit: number; billing_date: number; due_date: number; last_four: string;
}
interface Bill {
  id: string; account_id: string; month: string; billing_date: string;
  due_date: string; status: string; total_amount: number;
  statement_amount: number; minimum_due: number; total_paid: number;
}
interface BillPayment {
  id: string; bill_id: string; amount: number; paid_date: string;
  account_id: string | null; note: string; accounts?: { name: string };
}

const getMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const getMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-');
  return new Date(Number(year), Number(month) - 1).toLocaleDateString('en-PK', { month: 'long', year: 'numeric' });
};

const getDaysUntil = (dateStr: string) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr); due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const ordinal = (n: number) => {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
};

const CreditCards = () => {
  const { user } = useAuth();
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<Record<string, BillPayment[]>>({});
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey(new Date()));

  // Modals
  const [statementModal, setStatementModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Statement form
  const [stmtAmount, setStmtAmount] = useState('');
  const [stmtMinDue, setStmtMinDue] = useState('');
  const [stmtDueDate, setStmtDueDate] = useState('');
  const [stmtAlreadyPaid, setStmtAlreadyPaid] = useState('');
  const [stmtAlreadyPaidDate, setStmtAlreadyPaidDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [stmtAlreadyPaidNote, setStmtAlreadyPaidNote] = useState('');
  const [showAlreadyPaid, setShowAlreadyPaid] = useState(false);

  // Payment form
  const [payAmount, setPayAmount] = useState('');
  const [payAccount, setPayAccount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [payNote, setPayNote] = useState('');

  // Reconciliation
  const [reconCard, setReconCard] = useState<CreditCard | null>(null);

  document.title = 'Credit Card Bills | Finance Portal';

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    return getMonthKey(d);
  });

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);

    // Fetch cards and bank accounts in parallel
    const [{ data: cardData }, { data: bankData }] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', user?.id).eq('type', 'credit_card').eq('is_archived', false).order('name', { ascending: true }),
      supabase.from('accounts').select('id, name, balance, type').eq('user_id', user?.id).eq('is_archived', false).in('type', ['bank_savings', 'bank_current']).order('name', { ascending: true }),
    ]);

    if (cardData) {
      setCards(cardData);

      // Auto-create missing bills for current month — all cards checked in parallel
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      if (selectedMonth === currentMonthKey) {
        await Promise.all(cardData.map(async (card) => {
          const { data: existing } = await supabase
            .from('bills').select('id').eq('account_id', card.id).eq('month', selectedMonth).single();
          if (!existing) {
            const [year, month] = selectedMonth.split('-').map(Number);
            const billingDateObj = new Date(year, month - 1, card.billing_date);
            const dueDay = card.due_date;
            const dueMonth = dueDay < card.billing_date ? month : month - 1;
            const dueDateObj = new Date(year, dueMonth, dueDay);
            await supabase.from('bills').insert({
              user_id: user?.id, account_id: card.id, month: selectedMonth,
              billing_date: billingDateObj.toLocaleDateString('en-CA'),
              due_date: dueDateObj.toLocaleDateString('en-CA'),
              status: 'pending', total_amount: 0,
              statement_amount: null, minimum_due: null, total_paid: 0,
            });
          }
        }));
      }
    }

    const { data: billData } = await supabase
      .from('bills').select('*')
      .eq('user_id', user?.id).eq('month', selectedMonth)
      .order('due_date', { ascending: true });

    if (billData) {
      setBills(billData);

      // Fetch all payments in one batched query instead of one per bill
      const billIds = billData.map(b => b.id);
      if (billIds.length > 0) {
        const { data: allPmts } = await supabase
          .from('bill_payments').select('*, accounts!bill_payments_account_id_fkey(name)')
          .in('bill_id', billIds).order('paid_date', { ascending: true });
        const paymentsMap: Record<string, BillPayment[]> = {};
        (allPmts || []).forEach(p => {
          if (!paymentsMap[p.bill_id]) paymentsMap[p.bill_id] = [];
          paymentsMap[p.bill_id].push(p);
        });
        setPayments(paymentsMap);
      } else {
        setPayments({});
      }
    }

    if (bankData) setBankAccounts(bankData);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [selectedMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  // Open statement modal
  const openStatementModal = (bill: Bill) => {
    setSelectedBill(bill);
    setStmtAmount(bill.statement_amount ? String(bill.statement_amount) : '');
    setStmtMinDue(bill.minimum_due ? String(bill.minimum_due) : '');
    setStmtDueDate(bill.due_date ? bill.due_date : '');
    setStmtAlreadyPaid('');
    setStmtAlreadyPaidDate(new Date().toLocaleDateString('en-CA'));
    setStmtAlreadyPaidNote('');
    setShowAlreadyPaid(false);
    setError('');
    setStatementModal(true);
  };

  // Save statement details
  const handleSaveStatement = async () => {
    if (!selectedBill || !stmtAmount) {
      setError('Please enter statement amount');
      return;
    }
    setSaving(true);
    try {
      const stmtAmt = Number(stmtAmount);
      const minDue = Number(stmtMinDue) || 0;
      const prePaid = showAlreadyPaid ? (Number(stmtAlreadyPaid) || 0) : 0;

      // Combine any existing total_paid with the newly entered pre-paid amount
      const existingPaid = selectedBill.total_paid || 0;
      const newTotalPaid = existingPaid + prePaid;
      const newStatus = newTotalPaid >= stmtAmt ? 'paid' : newTotalPaid > 0 ? 'partial' : 'pending';

      await supabase.from('bills').update({
        statement_amount: stmtAmt,
        minimum_due: minDue,
        due_date: stmtDueDate,
        total_amount: stmtAmt,
        total_paid: newTotalPaid,
        status: newStatus,
      }).eq('id', selectedBill.id);

      // Log the pre-existing payment as a record — NO balance adjustment
      // (bank and card balances already reflect this payment since user entered current balances)
      if (prePaid > 0) {
        await supabase.from('bill_payments').insert({
          bill_id: selectedBill.id,
          user_id: user?.id,
          amount: prePaid,
          paid_date: stmtAlreadyPaidDate,
          account_id: null,
          note: stmtAlreadyPaidNote || 'Paid before adding to app',
        });
      }

      setStatementModal(false);
      fetchData(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Open payment modal
  const openPaymentModal = (bill: Bill) => {
    setSelectedBill(bill);
    const remaining = (bill.statement_amount || 0) - (bill.total_paid || 0);
    setPayAmount(remaining > 0 ? String(remaining) : '');
    setPayAccount('');
    setPayDate(new Date().toLocaleDateString('en-CA'));
    setPayNote('');
    setError('');
    setPaymentModal(true);
  };

  // Log a payment
  const handleLogPayment = async () => {
    if (!selectedBill || !payAccount || !payAmount || !payDate) {
      setError('Please fill all required fields');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const amount = Number(payAmount);

      const { data: freshBank } = await supabase
        .from('accounts').select('balance').eq('id', payAccount).single();
      const { data: freshCard } = await supabase
        .from('accounts').select('balance, name').eq('id', selectedBill.account_id).single();

      if (!freshBank || freshBank.balance < amount) {
        setError('Insufficient balance in selected account');
        setSaving(false);
        return;
      }

      // Log bill payment record
      await supabase.from('bill_payments').insert({
        bill_id: selectedBill.id,
        user_id: user?.id,
        amount,
        paid_date: payDate,
        account_id: payAccount,
        note: payNote || null,
      });

      // Create transaction
      await supabase.from('transactions').insert({
        user_id: user?.id,
        date: new Date(payDate).toISOString(),
        amount,
        type: 'credit_card_payment',
        account_id: payAccount,
        to_account_id: selectedBill.account_id,
        category: 'Credit Card Payment',
        note: payNote || `${freshCard?.name} payment - ${getMonthLabel(selectedBill.month)}`,
      });

      // Debit bank account
      await supabase.from('accounts')
        .update({ balance: freshBank.balance - amount })
        .eq('id', payAccount);

      // Reduce card outstanding
      const newCardBalance = Math.max(0, (freshCard?.balance || 0) - amount);
      await supabase.from('accounts')
        .update({ balance: newCardBalance })
        .eq('id', selectedBill.account_id);

      // Recalculate total_paid from bill_payments table directly
      const { data: allPayments } = await supabase
        .from('bill_payments')
        .select('amount')
        .eq('bill_id', selectedBill.id);

      const newTotalPaid = (allPayments || []).reduce((s, p) => s + Number(p.amount), 0);
      const stmtAmt = selectedBill.statement_amount || 0;
      const newStatus = stmtAmt > 0
        ? (newTotalPaid >= stmtAmt ? 'paid' : 'partial')
        : 'partial';

      await supabase.from('bills').update({
        total_paid: newTotalPaid,
        status: newStatus,
      }).eq('id', selectedBill.id);

      setPaymentModal(false);
      fetchData(true);
    } catch (err: any) {
      setError(err.message || 'Payment failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async (payment: BillPayment, bill: Bill) => {
    if (!window.confirm('Remove this payment? Balances will be reversed.')) return;
    try {
      const amount = Number(payment.amount);

      // Reverse bank and card balances only for real payments (account_id = null means pre-existing, no balance touch)
      if (payment.account_id) {
        const { data: freshBank } = await supabase.from('accounts').select('balance').eq('id', payment.account_id).single();
        if (freshBank) {
          await supabase.from('accounts').update({ balance: freshBank.balance + amount }).eq('id', payment.account_id);
        }
        const { data: freshCard } = await supabase.from('accounts').select('balance').eq('id', bill.account_id).single();
        if (freshCard) {
          await supabase.from('accounts').update({ balance: freshCard.balance + amount }).eq('id', bill.account_id);
        }
      }

      await supabase.from('bill_payments').delete().eq('id', payment.id);

      // Also delete linked transaction (credit_card_payment type for this bill)
      await supabase.from('transactions')
        .delete()
        .eq('account_id', payment.account_id)
        .eq('to_account_id', bill.account_id)
        .eq('type', 'credit_card_payment')
        .eq('amount', amount);

      const { data: remaining } = await supabase.from('bill_payments').select('amount').eq('bill_id', bill.id);
      const newTotalPaid = (remaining || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
      const stmtAmt = bill.statement_amount || 0;
      const newStatus = stmtAmt > 0
        ? (newTotalPaid >= stmtAmt ? 'paid' : newTotalPaid > 0 ? 'partial' : 'pending')
        : (newTotalPaid > 0 ? 'partial' : 'pending');

      await supabase.from('bills').update({ total_paid: newTotalPaid, status: newStatus }).eq('id', bill.id);

      fetchData(true);
    } catch (err: any) {
      alert(err.message || 'Failed to remove payment');
    }
  };

  const totalOutstanding = cards.reduce((s, c) => s + Number(c.balance), 0);
  const totalLimit = cards.reduce((s, c) => s + Number(c.credit_limit), 0);
  const paidBills = bills.filter(b => b.status === 'paid').length;
  const partialBills = bills.filter(b => b.status === 'partial').length;
  const pendingBills = bills.filter(b => b.status === 'pending').length;

  const getStatusColor = (status: string) => {
    if (status === 'paid') return 'success';
    if (status === 'partial') return 'warning';
    return 'danger';
  };

  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>
          <BreadCrumb title="Credit Card Bills" pageTitle="Finance Portal" />

          <Row className="mb-4">
            <Col md={3}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1">Total Outstanding</p>
                      <h4 className="text-danger">{formatCurrency(totalOutstanding)}</h4>
                      <small className="text-muted">of {formatCurrency(totalLimit)} limit</small>
                    </div>
                    <div className="avatar-sm"><span className="avatar-title bg-danger-subtle rounded-circle fs-3"><i className="ri-bank-card-line text-danger"></i></span></div>
                  </div>
                  {totalLimit > 0 && <Progress value={(totalOutstanding / totalLimit) * 100} color="danger" className="mt-2" style={{ height: 4 }} />}
                </CardBody>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1">Fully Paid</p>
                      <h4 className="text-success">{paidBills}</h4>
                    </div>
                    <div className="avatar-sm"><span className="avatar-title bg-success-subtle rounded-circle fs-3"><i className="ri-checkbox-circle-line text-success"></i></span></div>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1">Partially Paid</p>
                      <h4 className="text-warning">{partialBills}</h4>
                    </div>
                    <div className="avatar-sm"><span className="avatar-title bg-warning-subtle rounded-circle fs-3"><i className="ri-time-line text-warning"></i></span></div>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1">Pending</p>
                      <h4 className="text-danger">{pendingBills}</h4>
                    </div>
                    <div className="avatar-sm"><span className="avatar-title bg-danger-subtle rounded-circle fs-3"><i className="ri-error-warning-line text-danger"></i></span></div>
                  </div>
                </CardBody>
              </Card>
            </Col>
          </Row>

          {/* Month Selector */}
          <Card className="mb-4">
            <CardBody className="py-2">
              <div className="d-flex gap-2 flex-wrap">
                {months.map(m => (
                  <Button key={m} size="sm" color={selectedMonth === m ? 'success' : 'light'} onClick={() => setSelectedMonth(m)}>
                    {getMonthLabel(m)}
                  </Button>
                ))}
              </div>
            </CardBody>
          </Card>

          {loading ? (
            <div className="text-center py-5"><Spinner color="primary" /></div>
          ) : cards.length === 0 ? (
            <Card><CardBody className="text-center py-5">
              <i className="ri-bank-card-line fs-1 text-muted"></i>
              <p className="text-muted mt-2">No credit cards added yet.</p>
            </CardBody></Card>
          ) : (
            cards.map(card => {
              const bill = bills.find(b => b.account_id === card.id);
              const billPayments = bill ? (payments[bill.id] || []) : [];
              const daysUntil = bill?.due_date ? getDaysUntil(bill.due_date) : null;
              const utilization = card.credit_limit > 0 ? (card.balance / card.credit_limit) * 100 : 0;
              const stmtAmt = bill?.statement_amount || 0;
              const totalPaid = bill?.total_paid || 0;
              const remaining = Math.max(0, stmtAmt - totalPaid);
              const paidPct = stmtAmt > 0 ? Math.min(100, (totalPaid / stmtAmt) * 100) : 0;

              return (
                <Card key={card.id} className="mb-4 border">
                  <CardHeader className="d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-3">
                      <div>
                        <h5 className="mb-0">{card.name}</h5>
                        <small className="text-muted">{card.bank_name} •••• {card.last_four} — Bills {ordinal(card.billing_date)}, Due {ordinal(card.due_date)} every month</small>
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <Button color="soft-info" size="sm" onClick={() => setReconCard(card)}>
                        <i className="ri-file-search-line me-1"></i>Reconcile
                      </Button>
                      <Badge color={getStatusColor(bill?.status || 'pending')} pill className="fs-12 px-3 py-2">
                        {bill?.status === 'paid' ? '✓ Fully Paid' : bill?.status === 'partial' ? '⟳ Partially Paid' : '○ Pending'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardBody>
                    <Row>
                      {/* Left — Card info */}
                      <Col md={4} className="border-end">
                        <p className="text-muted mb-1 fs-12">Current Outstanding (Card Balance)</p>
                        <h4 className="text-danger">{formatCurrency(card.balance)}</h4>
                        <Progress value={utilization} color={utilization > 80 ? 'danger' : utilization > 60 ? 'warning' : 'success'} style={{ height: 6 }} className="mb-1" />
                        <small className="text-muted">{utilization.toFixed(1)}% of {formatCurrency(card.credit_limit)} utilized</small>

                        {daysUntil !== null && bill?.due_date && bill.status !== 'paid' && (
                          <div className={`mt-3 p-2 rounded bg-${daysUntil < 0 ? 'danger' : daysUntil <= 3 ? 'warning' : 'info'}-subtle`}>
                            <small className={`text-${daysUntil < 0 ? 'danger' : daysUntil <= 3 ? 'warning' : 'info'} fw-semibold`}>
                              {daysUntil < 0 ? `Overdue by ${Math.abs(daysUntil)} days` : daysUntil === 0 ? 'Due Today!' : `Due in ${daysUntil} days`}
                              {' — '}{new Date(bill.due_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </small>
                          </div>
                        )}
                      </Col>

                      {/* Middle — Statement info */}
                      <Col md={4} className="border-end">
                        <p className="text-muted mb-2 fs-12">Statement — {getMonthLabel(selectedMonth)}</p>
                        {stmtAmt > 0 ? (
                          <>
                            <div className="d-flex justify-content-between mb-1">
                              <span className="text-muted fs-12">Statement Amount</span>
                              <span className="fw-semibold">{formatCurrency(stmtAmt)}</span>
                            </div>
                            {bill?.minimum_due ? (
                              <div className="d-flex justify-content-between mb-1">
                                <span className="text-muted fs-12">Minimum Due</span>
                                <span className="fw-semibold text-warning">{formatCurrency(bill.minimum_due)}</span>
                              </div>
                            ) : null}
                            <div className="d-flex justify-content-between mb-1">
                              <span className="text-muted fs-12">Total Paid</span>
                              <span className="fw-semibold text-success">{formatCurrency(totalPaid)}</span>
                            </div>
                            <div className="d-flex justify-content-between mb-2">
                              <span className="text-muted fs-12">Remaining</span>
                              <span className={`fw-semibold ${remaining > 0 ? 'text-danger' : 'text-success'}`}>{formatCurrency(remaining)}</span>
                            </div>
                            <Progress value={paidPct} color={paidPct >= 100 ? 'success' : paidPct > 50 ? 'warning' : 'danger'} style={{ height: 8 }} className="mb-1" />
                            <small className="text-muted">{paidPct.toFixed(0)}% paid</small>
                          </>
                        ) : (
                          <div className="text-center py-3">
                            <p className="text-muted mb-2 fs-12">Statement not entered yet</p>
                            <Button color="soft-primary" size="sm" onClick={() => bill && openStatementModal(bill)}>
                              <i className="ri-file-list-line me-1"></i> Enter Statement
                            </Button>
                          </div>
                        )}
                        {stmtAmt > 0 && (
                          <Button color="soft-secondary" size="sm" className="mt-2 w-100" onClick={() => bill && openStatementModal(bill)}>
                            <i className="ri-edit-line me-1"></i> Edit Statement
                          </Button>
                        )}
                      </Col>

                      {/* Right — Payments */}
                      <Col md={4}>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <p className="text-muted mb-0 fs-12">Payments Made</p>
                          {bill && bill.status !== 'paid' && (
                            <Button color="success" size="sm" onClick={() => bill && openPaymentModal(bill)}>
                              <i className="ri-add-line me-1"></i> Add Payment
                            </Button>
                          )}
                        </div>
                        {billPayments.length === 0 ? (
                          <p className="text-muted fs-12 text-center py-2">No payments yet</p>
                        ) : (
                          <div className="table-responsive">
                            <Table size="sm" className="mb-0">
                              <thead><tr>
                                <th className="fs-12">Date</th>
                                <th className="fs-12">From</th>
                                <th className="fs-12 text-end">Amount</th>
                                <th></th>
                              </tr></thead>
                              <tbody>
                                {billPayments.map(p => (
                                  <tr key={p.id}>
                                    <td className="fs-12">{new Date(p.paid_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })}</td>
                                    <td className="fs-12 text-muted">{p.accounts?.name || <span className="text-muted fst-italic">pre-existing</span>}</td>
                                    <td className="fs-12 text-end text-success fw-semibold">{formatCurrency(p.amount)}</td>
                                    <td className="text-end">
                                      <button
                                        className="btn btn-sm btn-ghost-danger p-0 px-1"
                                        title="Remove payment"
                                        onClick={() => bill && handleDeletePayment(p, bill)}
                                      >
                                        <i className="ri-delete-bin-line"></i>
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                          </div>
                        )}
                        {bill && bill.status !== 'paid' && stmtAmt === 0 && billPayments.length === 0 && (
                          <p className="text-muted fs-12 text-center">No statement yet — you can still log pre-payments</p>
                        )}
                      </Col>
                    </Row>
                  </CardBody>
                </Card>
              );
            })
          )}
        </Container>
      </div>

      {/* Statement Modal */}
      <Modal isOpen={statementModal} toggle={() => setStatementModal(false)} centered>
        <ModalHeader toggle={() => setStatementModal(false)}>
          Enter Statement Details
        </ModalHeader>
        <ModalBody>
          {error && <Alert color="danger">{error}</Alert>}
          {selectedBill && (
            <div className="mb-3 p-2 bg-light rounded">
              <small className="text-muted">{cards.find(c => c.id === selectedBill.account_id)?.name} — {getMonthLabel(selectedBill.month)}</small>
            </div>
          )}
          <Form>
            <FormGroup>
              <Label>Statement Amount (PKR) <span className="text-danger">*</span></Label>
              <Input type="number" value={stmtAmount} onChange={e => setStmtAmount(e.target.value)} placeholder="Total bill amount from statement" />
            </FormGroup>
            <FormGroup>
              <Label>Minimum Due (PKR)</Label>
              <Input type="number" value={stmtMinDue} onChange={e => setStmtMinDue(e.target.value)} placeholder="Minimum payment required" />
            </FormGroup>
            <FormGroup>
              <Label>Due Date</Label>
              <Input type="date" value={stmtDueDate} onChange={e => setStmtDueDate(e.target.value)} />
            </FormGroup>

            {/* Already paid section — only shown on first entry (no existing payments) */}
            {selectedBill && (selectedBill.total_paid || 0) === 0 && (
              <div className="mt-3 border rounded p-3">
                <div className="form-check form-switch mb-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="alreadyPaidToggle"
                    checked={showAlreadyPaid}
                    onChange={e => setShowAlreadyPaid(e.target.checked)}
                  />
                  <label className="form-check-label fw-semibold fs-13" htmlFor="alreadyPaidToggle">
                    Already paid some/all before adding this?
                  </label>
                </div>
                {showAlreadyPaid && (
                  <div className="bg-light rounded p-2">
                    <div className="alert alert-info py-2 px-3 mb-2 fs-12">
                      Bank and card balances <strong>won't change</strong> — your current balances already reflect this payment.
                    </div>
                    <Row>
                      <Col md={6}>
                        <FormGroup className="mb-2">
                          <Label className="fs-12">Amount Paid (PKR)</Label>
                          <Input type="number" value={stmtAlreadyPaid} onChange={e => setStmtAlreadyPaid(e.target.value)} placeholder="0" />
                        </FormGroup>
                      </Col>
                      <Col md={6}>
                        <FormGroup className="mb-2">
                          <Label className="fs-12">Payment Date</Label>
                          <Input type="date" value={stmtAlreadyPaidDate} onChange={e => setStmtAlreadyPaidDate(e.target.value)} />
                        </FormGroup>
                      </Col>
                    </Row>
                    <FormGroup className="mb-0">
                      <Label className="fs-12">Note (optional)</Label>
                      <Input type="text" value={stmtAlreadyPaidNote} onChange={e => setStmtAlreadyPaidNote(e.target.value)} placeholder="e.g. Paid via mobile banking on 20 Apr" />
                    </FormGroup>
                  </div>
                )}
              </div>
            )}
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="light" onClick={() => setStatementModal(false)}>Cancel</Button>
          <Button color="success" onClick={handleSaveStatement} disabled={saving}>
            {saving && <Spinner size="sm" className="me-2" />}
            Save Statement
          </Button>
        </ModalFooter>
      </Modal>

      {/* Statement Reconciliation Modal */}
      {reconCard && (
        <StatementRecon
          card={reconCard}
          userId={user?.id || ''}
          onClose={() => setReconCard(null)}
          onDone={() => { setReconCard(null); fetchData(true); }}
        />
      )}

      {/* Payment Modal */}
      <Modal isOpen={paymentModal} toggle={() => setPaymentModal(false)} centered>
        <ModalHeader toggle={() => setPaymentModal(false)}>
          Log Payment
        </ModalHeader>
        <ModalBody>
          {error && <Alert color="danger">{error}</Alert>}
          {selectedBill && (
            <div className="mb-3 p-2 bg-light rounded">
              {selectedBill.statement_amount > 0 ? (
                <>
                  <div className="d-flex justify-content-between">
                    <small className="text-muted">Statement</small>
                    <small className="fw-semibold">{formatCurrency(selectedBill.statement_amount)}</small>
                  </div>
                  <div className="d-flex justify-content-between">
                    <small className="text-muted">Paid so far</small>
                    <small className="fw-semibold text-success">{formatCurrency(selectedBill.total_paid)}</small>
                  </div>
                  <div className="d-flex justify-content-between">
                    <small className="text-muted">Remaining</small>
                    <small className="fw-semibold text-danger">{formatCurrency(Math.max(0, selectedBill.statement_amount - selectedBill.total_paid))}</small>
                  </div>
                </>
              ) : (
                <small className="text-muted">No statement entered yet — recording as pre-payment</small>
              )}
            </div>
          )}
          <Form>
            <FormGroup>
              <Label>Payment Date <span className="text-danger">*</span></Label>
              <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
            </FormGroup>
            <FormGroup>
              <Label>Amount (PKR) <span className="text-danger">*</span></Label>
              <Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="Amount paid" />
            </FormGroup>
            <FormGroup>
              <Label>Pay From <span className="text-danger">*</span></Label>
              <Input type="select" value={payAccount} onChange={e => setPayAccount(e.target.value)}>
                <option value="">Select bank account...</option>
                {bankAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name} — {formatCurrency(a.balance)}</option>
                ))}
              </Input>
            </FormGroup>
            <FormGroup>
              <Label>Note</Label>
              <Input type="text" value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="e.g. Partial payment, minimum due..." />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="light" onClick={() => setPaymentModal(false)}>Cancel</Button>
          <Button color="success" onClick={handleLogPayment} disabled={saving}>
            {saving && <Spinner size="sm" className="me-2" />}
            Log Payment
          </Button>
        </ModalFooter>
      </Modal>
    </React.Fragment>
  );
};

export default CreditCards;
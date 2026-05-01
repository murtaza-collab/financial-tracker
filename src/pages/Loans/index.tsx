import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, CardBody, CardHeader, Button, Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Input, Alert, Badge, Spinner, Table, Nav, NavItem, NavLink, Progress } from 'reactstrap';
import * as Yup from 'yup';
import { useFormik } from 'formik';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/currency';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import { useLocation } from 'react-router-dom';

interface Account { id: string; name: string; type: string; balance: number; }
interface Loan {
  id: string; direction: string; person_name: string; principal: number;
  date: string; due_date: string; account_id: string; outstanding: number;
  status: string; notes: string;
}
interface LoanRepayment {
  id: string; loan_id: string; amount: number; date: string;
  transaction_id: string;
}

const Loans = () => {
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [repayments, setRepayments] = useState<Record<string, LoanRepayment[]>>({});
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('given');
  const [modal, setModal] = useState(false);
  const [repayModal, setRepayModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Repayment form
  const [repayAmount, setRepayAmount] = useState('');
  const [repayAccount, setRepayAccount] = useState('');
  const [repayDate, setRepayDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [repayNote, setRepayNote] = useState('');

  document.title = 'Loans | Finance Portal';

  const location = useLocation();
useEffect(() => {
  if (location.pathname === '/loans-taken') {
    setActiveTab('taken');
  }
}, [location.pathname]);
  const fetchData = async () => {
    setLoading(true);
    const { data: accData } = await supabase
      .from('accounts').select('id, name, type, balance')
      .eq('user_id', user?.id).eq('is_archived', false);

    const { data: loanData } = await supabase
      .from('loans').select('*')
      .eq('user_id', user?.id)
      .order('date', { ascending: false });

    if (accData) setAccounts(accData);
    if (loanData) {
      setLoans(loanData);
      const repayMap: Record<string, LoanRepayment[]> = {};
      for (const loan of loanData) {
        const { data: repays } = await supabase
          .from('loan_repayments').select('*')
          .eq('loan_id', loan.id)
          .order('date', { ascending: true });
        if (repays) repayMap[loan.id] = repays;
      }
      setRepayments(repayMap);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loanForm = useFormik({
    initialValues: {
      direction: 'given',
      person_name: '',
      principal: '',
      date: new Date().toLocaleDateString('en-CA'),
      due_date: '',
      account_id: '',
      notes: '',
    },
    validationSchema: Yup.object({
      person_name: Yup.string().required('Please enter person name'),
      principal: Yup.number().positive().required('Please enter amount'),
      account_id: Yup.string().required('Please select account'),
    }),
    onSubmit: async (values) => {
      setSaving(true);
      setError('');
      try {
        const amount = Number(values.principal);
        const acc = accounts.find(a => a.id === values.account_id);

        // Create transaction
        await supabase.from('transactions').insert({
          user_id: user?.id,
          date: new Date(values.date).toISOString(),
          amount,
          type: values.direction === 'given' ? 'loan_given' : 'loan_received',
          account_id: values.account_id,
          category: values.direction === 'given' ? 'Loan Given' : 'Loan Received',
          note: `${values.direction === 'given' ? 'Lent to' : 'Borrowed from'} ${values.person_name}`,
        });

        // Update account balance
        if (acc) {
          const newBalance = values.direction === 'given'
            ? acc.balance - amount
            : acc.balance + amount;
          await supabase.from('accounts').update({ balance: newBalance }).eq('id', values.account_id);
        }

        // Create loan record
        await supabase.from('loans').insert({
          user_id: user?.id,
          direction: values.direction,
          person_name: values.person_name,
          principal: amount,
          date: values.date,
          due_date: values.due_date || null,
          account_id: values.account_id,
          outstanding: amount,
          status: 'active',
          notes: values.notes || null,
        });

        setModal(false);
        loanForm.resetForm();
        fetchData();
      } catch (err: any) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
    }
  });

  const openRepayModal = (loan: Loan) => {
    setSelectedLoan(loan);
    setRepayAmount(String(loan.outstanding));
    setRepayAccount('');
    setRepayDate(new Date().toLocaleDateString('en-CA'));
    setRepayNote('');
    setError('');
    setRepayModal(true);
  };

  const handleRepayment = async () => {
    if (!selectedLoan || !repayAmount || !repayAccount) {
      setError('Please fill all required fields');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const amount = Number(repayAmount);
      const { data: freshAcc } = await supabase
        .from('accounts').select('balance').eq('id', repayAccount).single();

      // Create transaction
      const { data: tx } = await supabase.from('transactions').insert({
        user_id: user?.id,
        date: new Date(repayDate).toISOString(),
        amount,
        type: selectedLoan.direction === 'given' ? 'reimbursement_received' : 'expense',
        account_id: repayAccount,
        loan_id: selectedLoan.id,
        category: 'Loan Repayment',
        note: repayNote || `Repayment ${selectedLoan.direction === 'given' ? 'from' : 'to'} ${selectedLoan.person_name}`,
      }).select().single();

      // Update account balance
      if (freshAcc) {
        const newBalance = selectedLoan.direction === 'given'
          ? freshAcc.balance + amount
          : freshAcc.balance - amount;
        await supabase.from('accounts').update({ balance: newBalance }).eq('id', repayAccount);
      }

      // Create repayment record
      await supabase.from('loan_repayments').insert({
        loan_id: selectedLoan.id,
        user_id: user?.id,
        amount,
        date: repayDate,
        transaction_id: tx?.id || null,
      });

      // Update loan outstanding
      const newOutstanding = Math.max(0, selectedLoan.outstanding - amount);
      const newStatus = newOutstanding === 0 ? 'fully_repaid' : 'active';
      await supabase.from('loans').update({
        outstanding: newOutstanding,
        status: newStatus,
      }).eq('id', selectedLoan.id);

      setRepayModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const givenLoans = loans.filter(l => l.direction === 'given');
  const takenLoans = loans.filter(l => l.direction === 'taken');
  const activeGiven = givenLoans.filter(l => l.status === 'active');
  const activeTaken = takenLoans.filter(l => l.status === 'active');
  const totalToReceive = activeGiven.reduce((s, l) => s + Number(l.outstanding), 0);
  const totalToPayBack = activeTaken.reduce((s, l) => s + Number(l.outstanding), 0);

  const displayLoans = activeTab === 'given' ? givenLoans : takenLoans;

  const getDaysUntil = (dateStr: string) => {
    if (!dateStr) return null;
    const days = Math.ceil((new Date(dateStr).getTime() - new Date().setHours(0,0,0,0)) / 86400000);
    if (days < 0) return { text: `Overdue ${Math.abs(days)}d`, color: 'danger' };
    if (days === 0) return { text: 'Due Today', color: 'danger' };
    if (days <= 7) return { text: `${days}d left`, color: 'warning' };
    return { text: `${days}d left`, color: 'info' };
  };

  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>
          <BreadCrumb title="Loans" pageTitle="Finance Portal" />

          <Row className="mb-4">
            <Col md={4}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1">Money to Receive</p>
                      <h4 className="text-success">{formatCurrency(totalToReceive)}</h4>
                      <small className="text-muted">{activeGiven.length} active loans given</small>
                    </div>
                    <div className="avatar-sm"><span className="avatar-title bg-success-subtle rounded-circle fs-3"><i className="ri-hand-coin-line text-success"></i></span></div>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1">Money to Pay Back</p>
                      <h4 className="text-danger">{formatCurrency(totalToPayBack)}</h4>
                      <small className="text-muted">{activeTaken.length} active loans taken</small>
                    </div>
                    <div className="avatar-sm"><span className="avatar-title bg-danger-subtle rounded-circle fs-3"><i className="ri-money-dollar-circle-line text-danger"></i></span></div>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col md={4} className="d-flex align-items-center">
              <Button color="success" className="w-100" onClick={() => setModal(true)}>
                <i className="ri-add-line me-2"></i> Add Loan
              </Button>
            </Col>
          </Row>

          <Card>
            <CardHeader>
              <Nav tabs className="card-header-tabs">
                <NavItem>
                  <NavLink active={activeTab === 'given'} onClick={() => setActiveTab('given')} style={{ cursor: 'pointer' }}>
                    Loans Given <Badge color="success" className="ms-1">{activeGiven.length} active</Badge>
                  </NavLink>
                </NavItem>
                <NavItem>
                  <NavLink active={activeTab === 'taken'} onClick={() => setActiveTab('taken')} style={{ cursor: 'pointer' }}>
                    Loans Taken <Badge color="danger" className="ms-1">{activeTaken.length} active</Badge>
                  </NavLink>
                </NavItem>
              </Nav>
            </CardHeader>
            <CardBody>
              {loading ? (
                <div className="text-center py-5"><Spinner color="primary" /></div>
              ) : displayLoans.length === 0 ? (
                <div className="text-center py-5">
                  <i className="ri-hand-coin-line fs-1 text-muted"></i>
                  <p className="text-muted mt-2">No {activeTab === 'given' ? 'loans given' : 'loans taken'} yet.</p>
                </div>
              ) : (
                <Row>
                  {displayLoans.map(loan => {
                    const loanRepayments = repayments[loan.id] || [];
                    const paidAmount = loan.principal - loan.outstanding;
                    const paidPct = loan.principal > 0 ? Math.min(100, (paidAmount / loan.principal) * 100) : 0;
                    const due = loan.due_date ? getDaysUntil(loan.due_date) : null;

                    return (
                      <Col md={6} xl={4} key={loan.id} className="mb-3">
                        <Card className="border h-100">
                          <CardBody>
                            <div className="d-flex justify-content-between align-items-start mb-3">
                              <div className="d-flex align-items-center gap-2">
                                <div className="avatar-sm">
                                  <span className={`avatar-title rounded-circle fs-4 bg-${activeTab === 'given' ? 'success' : 'danger'}-subtle`}>
                                    <span className={`fw-bold text-${activeTab === 'given' ? 'success' : 'danger'} fs-14`}>
                                      {loan.person_name.charAt(0).toUpperCase()}
                                    </span>
                                  </span>
                                </div>
                                <div>
                                  <h6 className="mb-0">{loan.person_name}</h6>
                                  <small className="text-muted">{new Date(loan.date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}</small>
                                </div>
                              </div>
                              <Badge color={loan.status === 'fully_repaid' ? 'success' : loan.status === 'overdue' ? 'danger' : 'warning'} pill>
                                {loan.status === 'fully_repaid' ? '✓ Repaid' : loan.status === 'overdue' ? 'Overdue' : 'Active'}
                              </Badge>
                            </div>

                            <div className="mb-3">
                              <div className="d-flex justify-content-between mb-1">
                                <small className="text-muted">Principal</small>
                                <small className="fw-semibold">{formatCurrency(loan.principal)}</small>
                              </div>
                              <div className="d-flex justify-content-between mb-1">
                                <small className="text-muted">Paid Back</small>
                                <small className="fw-semibold text-success">{formatCurrency(paidAmount)}</small>
                              </div>
                              <div className="d-flex justify-content-between mb-2">
                                <small className="text-muted">Outstanding</small>
                                <small className={`fw-semibold ${loan.outstanding > 0 ? 'text-danger' : 'text-success'}`}>
                                  {loan.outstanding > 0 ? formatCurrency(loan.outstanding) : 'Fully Repaid ✓'}
                                </small>
                              </div>
                              <Progress value={paidPct} color={paidPct >= 100 ? 'success' : paidPct > 50 ? 'warning' : 'danger'} style={{ height: 6 }} />
                              <small className="text-muted">{paidPct.toFixed(0)}% repaid</small>
                            </div>

                            {due && loan.status !== 'fully_repaid' && (
                              <div className={`p-2 rounded bg-${due.color}-subtle mb-3`}>
                                <small className={`text-${due.color} fw-semibold`}>
                                  <i className="ri-time-line me-1"></i>{due.text}
                                  {' — '}{new Date(loan.due_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </small>
                              </div>
                            )}

                            {loan.notes && (
                              <p className="text-muted fs-12 mb-3">{loan.notes}</p>
                            )}

                            {/* Repayment history */}
                            {loanRepayments.length > 0 && (
                              <div className="mb-3">
                                <small className="text-muted d-block mb-1">Repayment History</small>
                                <div className="table-responsive">
                                  <Table size="sm" className="mb-0">
                                    <tbody>
                                      {loanRepayments.map(r => (
                                        <tr key={r.id}>
                                          <td className="fs-11">{new Date(r.date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })}</td>
                                          <td className="fs-11 text-end text-success fw-semibold">{formatCurrency(r.amount)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </Table>
                                </div>
                              </div>
                            )}

                            {loan.status !== 'fully_repaid' && (
                              <Button color="success" size="sm" className="w-100" onClick={() => openRepayModal(loan)}>
                                <i className="ri-money-dollar-circle-line me-1"></i>
                                {activeTab === 'given' ? 'Log Repayment Received' : 'Log Repayment Made'}
                              </Button>
                            )}
                          </CardBody>
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
              )}
            </CardBody>
          </Card>
        </Container>
      </div>

      {/* Add Loan Modal */}
      <Modal isOpen={modal} toggle={() => { setModal(false); loanForm.resetForm(); }} centered size="md">
        <ModalHeader toggle={() => { setModal(false); loanForm.resetForm(); }}>Add Loan</ModalHeader>
        <ModalBody>
          {error && <Alert color="danger">{error}</Alert>}
          <Form>
            <FormGroup>
              <Label>Direction</Label>
              <Input type="select" name="direction" value={loanForm.values.direction} onChange={loanForm.handleChange}>
                <option value="given">I gave money (Loan Given)</option>
                <option value="taken">I borrowed money (Loan Taken)</option>
              </Input>
            </FormGroup>
            <FormGroup>
              <Label>{loanForm.values.direction === 'given' ? 'Lent To' : 'Borrowed From'} <span className="text-danger">*</span></Label>
              <Input
                name="person_name"
                placeholder="Person name"
                value={loanForm.values.person_name}
                onChange={loanForm.handleChange} onBlur={loanForm.handleBlur}
                invalid={loanForm.touched.person_name && !!loanForm.errors.person_name}
              />
            </FormGroup>
            <Row>
              <Col md={6}>
                <FormGroup>
                  <Label>Amount (PKR) <span className="text-danger">*</span></Label>
                  <Input
                    type="number" name="principal" placeholder="0.00"
                    value={loanForm.values.principal}
                    onChange={loanForm.handleChange} onBlur={loanForm.handleBlur}
                    invalid={loanForm.touched.principal && !!loanForm.errors.principal}
                  />
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup>
                  <Label>Date <span className="text-danger">*</span></Label>
                  <Input type="date" name="date" value={loanForm.values.date} onChange={loanForm.handleChange} />
                </FormGroup>
              </Col>
            </Row>
            <FormGroup>
              <Label>Due / Return Date</Label>
              <Input type="date" name="due_date" value={loanForm.values.due_date} onChange={loanForm.handleChange} />
              <small className="text-muted">Leave blank if no fixed date</small>
            </FormGroup>
            <FormGroup>
              <Label>{loanForm.values.direction === 'given' ? 'Paid From' : 'Received In'} <span className="text-danger">*</span></Label>
              <Input
                type="select" name="account_id"
                value={loanForm.values.account_id}
                onChange={loanForm.handleChange} onBlur={loanForm.handleBlur}
                invalid={loanForm.touched.account_id && !!loanForm.errors.account_id}
              >
                <option value="">Select account...</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} — {formatCurrency(a.balance)}</option>)}
              </Input>
            </FormGroup>
            <FormGroup>
              <Label>Notes</Label>
              <Input
                type="textarea" name="notes" rows={2}
                placeholder="e.g. Return in 3 months, monthly Rs. 5,000..."
                value={loanForm.values.notes} onChange={loanForm.handleChange}
              />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="light" onClick={() => { setModal(false); loanForm.resetForm(); }}>Cancel</Button>
          <Button color="success" onClick={() => loanForm.handleSubmit()} disabled={saving}>
            {saving && <Spinner size="sm" className="me-2" />}
            Add Loan
          </Button>
        </ModalFooter>
      </Modal>

      {/* Repayment Modal */}
      <Modal isOpen={repayModal} toggle={() => setRepayModal(false)} centered>
        <ModalHeader toggle={() => setRepayModal(false)}>
          {selectedLoan?.direction === 'given' ? 'Log Repayment Received' : 'Log Repayment Made'}
        </ModalHeader>
        <ModalBody>
          {error && <Alert color="danger">{error}</Alert>}
          {selectedLoan && (
            <div className="bg-light rounded p-3 mb-3">
              <div className="d-flex justify-content-between">
                <small className="text-muted">Person</small>
                <small className="fw-semibold">{selectedLoan.person_name}</small>
              </div>
              <div className="d-flex justify-content-between mt-1">
                <small className="text-muted">Principal</small>
                <small className="fw-semibold">{formatCurrency(selectedLoan.principal)}</small>
              </div>
              <div className="d-flex justify-content-between mt-1">
                <small className="text-muted">Outstanding</small>
                <small className="fw-semibold text-danger">{formatCurrency(selectedLoan.outstanding)}</small>
              </div>
            </div>
          )}
          <Form>
            <FormGroup>
              <Label>Date <span className="text-danger">*</span></Label>
              <Input type="date" value={repayDate} onChange={e => setRepayDate(e.target.value)} />
            </FormGroup>
            <FormGroup>
              <Label>Amount (PKR) <span className="text-danger">*</span></Label>
              <Input type="number" value={repayAmount} onChange={e => setRepayAmount(e.target.value)} />
            </FormGroup>
            <FormGroup>
              <Label>{selectedLoan?.direction === 'given' ? 'Received In' : 'Paid From'} <span className="text-danger">*</span></Label>
              <Input type="select" value={repayAccount} onChange={e => setRepayAccount(e.target.value)}>
                <option value="">Select account...</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} — {formatCurrency(a.balance)}</option>)}
              </Input>
            </FormGroup>
            <FormGroup>
              <Label>Note</Label>
              <Input type="text" value={repayNote} onChange={e => setRepayNote(e.target.value)} placeholder="e.g. Bank transfer, partial payment..." />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="light" onClick={() => setRepayModal(false)}>Cancel</Button>
          <Button color="success" onClick={handleRepayment} disabled={saving}>
            {saving && <Spinner size="sm" className="me-2" />}
            Log Repayment
          </Button>
        </ModalFooter>
      </Modal>
    </React.Fragment>
  );
};

export default Loans;
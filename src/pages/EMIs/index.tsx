import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, CardBody, CardHeader, Button, Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Input, Alert, Badge, Spinner, Progress, Table, Nav, NavItem, NavLink } from 'reactstrap';
import * as Yup from 'yup';
import { useFormik } from 'formik';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/currency';
import BreadCrumb from '../../Components/Common/BreadCrumb';

interface Account { id: string; name: string; type: string; balance: number; }
interface EMI {
  id: string; loan_name: string; principal: number; emi_amount: number;
  start_date: string; tenure_months: number; account_id: string;
  interest_rate: number; paid_count: number; is_active: boolean;
  accounts?: { name: string };
}
interface EMIPayment {
  id: string; emi_id: string; month: number; due_date: string;
  paid_date: string; is_prepayment: boolean;
}

const EMIs = () => {
  const { user } = useAuth();
  const [emis, setEmis] = useState<EMI[]>([]);
  const [payments, setPayments] = useState<Record<string, EMIPayment[]>>({});
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');
  const [modal, setModal] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [selectedEMI, setSelectedEMI] = useState<EMI | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<EMIPayment | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [payAccount, setPayAccount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toLocaleDateString('en-CA'));

  document.title = 'EMI Tracker | Finance Portal';

  const fetchData = async () => {
    setLoading(true);
    const { data: accData } = await supabase
      .from('accounts').select('id, name, type, balance')
      .eq('user_id', user?.id).eq('is_archived', false).order('name', { ascending: true });

    const { data: emiData } = await supabase
      .from('emis').select('*, accounts!emis_account_id_fkey(name)')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });

    if (accData) setAccounts(accData);
    if (emiData) {
      setEmis(emiData);
      const payMap: Record<string, EMIPayment[]> = {};
      for (const emi of emiData) {
        const { data: pmts } = await supabase
          .from('emi_payments').select('*')
          .eq('emi_id', emi.id)
          .order('month', { ascending: true });
        if (pmts) payMap[emi.id] = pmts;
      }
      setPayments(payMap);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Generate EMI schedule
  const generateSchedule = async (emiId: string, startDate: string, tenure: number, emiAmount: number, accountId: string) => {
    const scheduleRows = [];
    const start = new Date(startDate);
    for (let i = 1; i <= tenure; i++) {
      const dueDate = new Date(start);
      dueDate.setMonth(dueDate.getMonth() + (i - 1));
      scheduleRows.push({
        emi_id: emiId,
        user_id: user?.id,
        month: i,
        due_date: dueDate.toLocaleDateString('en-CA'),
        paid_date: null,
        is_prepayment: false,
      });
    }
    await supabase.from('emi_payments').insert(scheduleRows);
  };

  const emiForm = useFormik({
    initialValues: {
      loan_name: '',
      principal: '',
      emi_amount: '',
      start_date: new Date().toLocaleDateString('en-CA'),
      tenure_months: '',
      account_id: '',
      interest_rate: '',
    },
    validationSchema: Yup.object({
      loan_name: Yup.string().required('Please enter loan name'),
      principal: Yup.number().positive().required('Please enter principal amount'),
      emi_amount: Yup.number().positive().required('Please enter EMI amount'),
      start_date: Yup.string().required('Please select start date'),
      tenure_months: Yup.number().positive().integer().required('Please enter tenure'),
      account_id: Yup.string().required('Please select account'),
    }),
    onSubmit: async (values) => {
      setSaving(true);
      setError('');
      try {
        const { data: emi, error: emiErr } = await supabase.from('emis').insert({
          user_id: user?.id,
          loan_name: values.loan_name,
          principal: Number(values.principal),
          emi_amount: Number(values.emi_amount),
          start_date: values.start_date,
          tenure_months: Number(values.tenure_months),
          account_id: values.account_id,
          interest_rate: Number(values.interest_rate) || null,
          paid_count: 0,
          is_active: true,
        }).select().single();

        if (emiErr) throw emiErr;

        // Generate full schedule
        await generateSchedule(
          emi.id,
          values.start_date,
          Number(values.tenure_months),
          Number(values.emi_amount),
          values.account_id
        );

        setModal(false);
        emiForm.resetForm();
        fetchData();
      } catch (err: any) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
    }
  });

  const openPayModal = (emi: EMI, payment: EMIPayment) => {
    setSelectedEMI(emi);
    setSelectedPayment(payment);
    setPayAccount(emi.account_id || '');
    setPayDate(new Date().toLocaleDateString('en-CA'));
    setError('');
    setPayModal(true);
  };

  const handleMarkPaid = async () => {
    if (!selectedEMI || !selectedPayment || !payAccount) {
      setError('Please select account');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { data: freshAcc } = await supabase
        .from('accounts').select('balance').eq('id', payAccount).single();

      // Create transaction
      const { data: tx } = await supabase.from('transactions').insert({
        user_id: user?.id,
        date: new Date(payDate).toISOString(),
        amount: selectedEMI.emi_amount,
        type: 'emi_payment',
        account_id: payAccount,
        emi_id: selectedEMI.id,
        category: 'EMI Payment',
        note: `${selectedEMI.loan_name} — Month ${selectedPayment.month}`,
      }).select().single();

      // Debit account
      if (freshAcc) {
        await supabase.from('accounts')
          .update({ balance: freshAcc.balance - selectedEMI.emi_amount })
          .eq('id', payAccount);
      }

      // Mark EMI payment as paid
      await supabase.from('emi_payments').update({
        paid_date: payDate,
        transaction_id: tx?.id || null,
      }).eq('id', selectedPayment.id);

      // Update paid count
      await supabase.from('emis').update({
        paid_count: selectedEMI.paid_count + 1,
      }).eq('id', selectedEMI.id);

      setPayModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getNextDuePayment = (emiId: string) => {
    const emiPayments = payments[emiId] || [];
    return emiPayments.find(p => !p.paid_date);
  };

  const getDaysUntil = (dateStr: string) => {
    const days = Math.ceil((new Date(dateStr).getTime() - new Date().setHours(0,0,0,0)) / 86400000);
    if (days < 0) return { text: `Overdue ${Math.abs(days)}d`, color: 'danger' };
    if (days === 0) return { text: 'Due Today!', color: 'danger' };
    if (days <= 7) return { text: `Due in ${days}d`, color: 'warning' };
    return { text: `Due in ${days}d`, color: 'info' };
  };

  const activeEMIs = emis.filter(e => e.is_active);
  const completedEMIs = emis.filter(e => !e.is_active);
  const totalMonthlyEMI = activeEMIs.reduce((s, e) => s + Number(e.emi_amount), 0);
  const totalOutstanding = activeEMIs.reduce((s, e) => {
    const remaining = e.tenure_months - e.paid_count;
    return s + (remaining * e.emi_amount);
  }, 0);

  const displayEMIs = activeTab === 'active' ? activeEMIs : completedEMIs;

  // Calculate simple interest split
  const getInterestSplit = (emi: EMI) => {
    if (!emi.interest_rate) return null;
    const monthlyRate = emi.interest_rate / 12 / 100;
    const principal = emi.principal;
    const n = emi.tenure_months;
    const emiAmt = emi.emi_amount;
    const totalPayment = emiAmt * n;
    const totalInterest = totalPayment - principal;
    return { totalInterest, totalPayment };
  };

  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>
          <BreadCrumb title="EMI Tracker" pageTitle="Finance Portal" />

          <Row className="mb-4">
            <Col md={3}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1">Monthly EMI Load</p>
                      <h4 className="text-danger">{formatCurrency(totalMonthlyEMI)}</h4>
                      <small className="text-muted">Every month committed</small>
                    </div>
                    <div className="avatar-sm"><span className="avatar-title bg-danger-subtle rounded-circle fs-3"><i className="ri-calendar-check-line text-danger"></i></span></div>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1">Total Outstanding</p>
                      <h4 className="text-warning">{formatCurrency(totalOutstanding)}</h4>
                      <small className="text-muted">All remaining EMIs</small>
                    </div>
                    <div className="avatar-sm"><span className="avatar-title bg-warning-subtle rounded-circle fs-3"><i className="ri-money-dollar-circle-line text-warning"></i></span></div>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1">Active Loans</p>
                      <h4>{activeEMIs.length}</h4>
                    </div>
                    <div className="avatar-sm"><span className="avatar-title bg-info-subtle rounded-circle fs-3"><i className="ri-bank-line text-info"></i></span></div>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col md={3} className="d-flex align-items-center">
              <Button color="success" className="w-100" onClick={() => setModal(true)}>
                <i className="ri-add-line me-2"></i> Add EMI Loan
              </Button>
            </Col>
          </Row>

          <Card>
            <CardHeader>
              <Nav tabs className="card-header-tabs">
                <NavItem>
                  <NavLink active={activeTab === 'active'} onClick={() => setActiveTab('active')} style={{ cursor: 'pointer' }}>
                    Active <Badge color="danger" className="ms-1">{activeEMIs.length}</Badge>
                  </NavLink>
                </NavItem>
                <NavItem>
                  <NavLink active={activeTab === 'completed'} onClick={() => setActiveTab('completed')} style={{ cursor: 'pointer' }}>
                    Completed <Badge color="success" className="ms-1">{completedEMIs.length}</Badge>
                  </NavLink>
                </NavItem>
              </Nav>
            </CardHeader>
            <CardBody>
              {loading ? (
                <div className="text-center py-5"><Spinner color="primary" /></div>
              ) : displayEMIs.length === 0 ? (
                <div className="text-center py-5">
                  <i className="ri-calendar-check-line fs-1 text-muted"></i>
                  <p className="text-muted mt-2">No EMI loans added yet.</p>
                </div>
              ) : (
                displayEMIs.map(emi => {
                  const emiPayments = payments[emi.id] || [];
                  const nextDue = getNextDuePayment(emi.id);
                  const remaining = emi.tenure_months - emi.paid_count;
                  const paidPct = emi.tenure_months > 0 ? (emi.paid_count / emi.tenure_months) * 100 : 0;
                  const due = nextDue?.due_date ? getDaysUntil(nextDue.due_date) : null;
                  const interestSplit = getInterestSplit(emi);

                  return (
                    <Card key={emi.id} className="mb-4 border">
                      <CardHeader className="d-flex justify-content-between align-items-center">
                        <div>
                          <h5 className="mb-0">{emi.loan_name}</h5>
                          <small className="text-muted">
                            {emi.accounts?.name} • {formatCurrency(emi.emi_amount)}/month • {emi.tenure_months} months
                            {emi.interest_rate ? ` • ${emi.interest_rate}% p.a.` : ''}
                          </small>
                        </div>
                        {due && (
                          <Badge color={due.color} pill className="fs-12 px-3 py-2">{due.text}</Badge>
                        )}
                      </CardHeader>
                      <CardBody>
                        <Row>
                          {/* Left — Progress */}
                          <Col md={3} className="border-end">
                            <p className="text-muted mb-1 fs-12">Progress</p>
                            <div className="d-flex justify-content-between mb-1">
                              <small className="text-muted">Paid</small>
                              <small className="fw-semibold text-success">{emi.paid_count} EMIs</small>
                            </div>
                            <div className="d-flex justify-content-between mb-1">
                              <small className="text-muted">Remaining</small>
                              <small className="fw-semibold text-danger">{remaining} EMIs</small>
                            </div>
                            <div className="d-flex justify-content-between mb-2">
                              <small className="text-muted">Amount paid</small>
                              <small className="fw-semibold">{formatCurrency(emi.paid_count * emi.emi_amount)}</small>
                            </div>
                            <Progress value={paidPct} color={paidPct >= 100 ? 'success' : 'primary'} style={{ height: 8 }} className="mb-1" />
                            <small className="text-muted">{paidPct.toFixed(0)}% complete</small>

                            {interestSplit && (
                              <div className="mt-3 pt-2 border-top">
                                <div className="d-flex justify-content-between">
                                  <small className="text-muted">Total payment</small>
                                  <small>{formatCurrency(interestSplit.totalPayment)}</small>
                                </div>
                                <div className="d-flex justify-content-between">
                                  <small className="text-muted">Total interest</small>
                                  <small className="text-danger">{formatCurrency(interestSplit.totalInterest)}</small>
                                </div>
                              </div>
                            )}
                          </Col>

                          {/* Middle — Next due + action */}
                          <Col md={3} className="border-end">
                            <p className="text-muted mb-2 fs-12">Next Due</p>
                            {nextDue ? (
                              <>
                                <h5 className="text-danger">{formatCurrency(emi.emi_amount)}</h5>
                                <p className="text-muted fs-12 mb-1">
                                  Month {nextDue.month} of {emi.tenure_months}
                                </p>
                                <p className="text-muted fs-12 mb-3">
                                  Due: {new Date(nextDue.due_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                                <Button color="success" size="sm" className="w-100" onClick={() => openPayModal(emi, nextDue)}>
                                  <i className="ri-checkbox-circle-line me-1"></i> Mark Paid
                                </Button>
                              </>
                            ) : (
                              <div className="text-center py-3">
                                <i className="ri-checkbox-circle-fill fs-3 text-success"></i>
                                <p className="text-success fs-12 mt-1">All EMIs paid!</p>
                              </div>
                            )}
                          </Col>

                          {/* Right — Schedule */}
                          <Col md={6}>
                            <p className="text-muted mb-2 fs-12">Payment Schedule</p>
                            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                              <Table size="sm" className="mb-0">
                                <thead className="table-light">
                                  <tr>
                                    <th className="fs-11">#</th>
                                    <th className="fs-11">Due Date</th>
                                    <th className="fs-11 text-end">Amount</th>
                                    <th className="fs-11 text-center">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {emiPayments.slice(0, 24).map(p => (
                                    <tr key={p.id}>
                                      <td className="fs-11">{p.month}</td>
                                      <td className="fs-11">{new Date(p.due_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                      <td className="fs-11 text-end">{formatCurrency(emi.emi_amount)}</td>
                                      <td className="fs-11 text-center">
                                        {p.paid_date ? (
                                          <Badge color="success" pill className="fs-10">✓ Paid</Badge>
                                        ) : (
                                          <Badge color="warning" pill className="fs-10">Pending</Badge>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                  {emiPayments.length > 24 && (
                                    <tr>
                                      <td colSpan={4} className="text-center text-muted fs-11">
                                        +{emiPayments.length - 24} more months
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </Table>
                            </div>
                          </Col>
                        </Row>
                      </CardBody>
                    </Card>
                  );
                })
              )}
            </CardBody>
          </Card>
        </Container>
      </div>

      {/* Add EMI Modal */}
      <Modal isOpen={modal} toggle={() => { setModal(false); emiForm.resetForm(); }} centered size="md">
        <ModalHeader toggle={() => { setModal(false); emiForm.resetForm(); }}>Add EMI Loan</ModalHeader>
        <ModalBody>
          {error && <Alert color="danger">{error}</Alert>}
          <Form>
            <FormGroup>
              <Label>Loan Name <span className="text-danger">*</span></Label>
              <Input
                name="loan_name" placeholder="e.g. Home Loan HBL, Car Loan MCB..."
                value={emiForm.values.loan_name}
                onChange={emiForm.handleChange} onBlur={emiForm.handleBlur}
                invalid={emiForm.touched.loan_name && !!emiForm.errors.loan_name}
              />
            </FormGroup>
            <Row>
              <Col md={6}>
                <FormGroup>
                  <Label>Principal Amount (PKR) <span className="text-danger">*</span></Label>
                  <Input
                    type="number" name="principal" placeholder="Total loan amount"
                    value={emiForm.values.principal}
                    onChange={emiForm.handleChange} onBlur={emiForm.handleBlur}
                    invalid={emiForm.touched.principal && !!emiForm.errors.principal}
                  />
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup>
                  <Label>Monthly EMI (PKR) <span className="text-danger">*</span></Label>
                  <Input
                    type="number" name="emi_amount" placeholder="Fixed monthly amount"
                    value={emiForm.values.emi_amount}
                    onChange={emiForm.handleChange} onBlur={emiForm.handleBlur}
                    invalid={emiForm.touched.emi_amount && !!emiForm.errors.emi_amount}
                  />
                </FormGroup>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <FormGroup>
                  <Label>First EMI Date <span className="text-danger">*</span></Label>
                  <Input
                    type="date" name="start_date"
                    value={emiForm.values.start_date}
                    onChange={emiForm.handleChange}
                  />
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup>
                  <Label>Tenure (months) <span className="text-danger">*</span></Label>
                  <Input
                    type="number" name="tenure_months" placeholder="e.g. 24, 36, 60..."
                    value={emiForm.values.tenure_months}
                    onChange={emiForm.handleChange} onBlur={emiForm.handleBlur}
                    invalid={emiForm.touched.tenure_months && !!emiForm.errors.tenure_months}
                  />
                </FormGroup>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <FormGroup>
                  <Label>Debit Account <span className="text-danger">*</span></Label>
                  <Input
                    type="select" name="account_id"
                    value={emiForm.values.account_id}
                    onChange={emiForm.handleChange} onBlur={emiForm.handleBlur}
                    invalid={emiForm.touched.account_id && !!emiForm.errors.account_id}
                  >
                    <option value="">Select account...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </Input>
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup>
                  <Label>Interest Rate (% p.a.)</Label>
                  <Input
                    type="number" name="interest_rate" placeholder="e.g. 18.5"
                    value={emiForm.values.interest_rate}
                    onChange={emiForm.handleChange}
                  />
                  <small className="text-muted">Optional — for interest calculation</small>
                </FormGroup>
              </Col>
            </Row>

            {emiForm.values.emi_amount && emiForm.values.tenure_months && (
              <div className="bg-light rounded p-3">
                <div className="d-flex justify-content-between">
                  <small className="text-muted">Total payment</small>
                  <small className="fw-semibold">{formatCurrency(Number(emiForm.values.emi_amount) * Number(emiForm.values.tenure_months))}</small>
                </div>
                {emiForm.values.principal && (
                  <div className="d-flex justify-content-between mt-1">
                    <small className="text-muted">Total interest</small>
                    <small className="fw-semibold text-danger">
                      {formatCurrency((Number(emiForm.values.emi_amount) * Number(emiForm.values.tenure_months)) - Number(emiForm.values.principal))}
                    </small>
                  </div>
                )}
              </div>
            )}
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="light" onClick={() => { setModal(false); emiForm.resetForm(); }}>Cancel</Button>
          <Button color="success" onClick={() => emiForm.handleSubmit()} disabled={saving}>
            {saving && <Spinner size="sm" className="me-2" />}
            Add EMI & Generate Schedule
          </Button>
        </ModalFooter>
      </Modal>

      {/* Mark Paid Modal */}
      <Modal isOpen={payModal} toggle={() => setPayModal(false)} centered>
        <ModalHeader toggle={() => setPayModal(false)}>Mark EMI as Paid</ModalHeader>
        <ModalBody>
          {error && <Alert color="danger">{error}</Alert>}
          {selectedEMI && selectedPayment && (
            <div className="bg-light rounded p-3 mb-3">
              <div className="d-flex justify-content-between">
                <small className="text-muted">Loan</small>
                <small className="fw-semibold">{selectedEMI.loan_name}</small>
              </div>
              <div className="d-flex justify-content-between mt-1">
                <small className="text-muted">Month</small>
                <small className="fw-semibold">{selectedPayment.month} of {selectedEMI.tenure_months}</small>
              </div>
              <div className="d-flex justify-content-between mt-1">
                <small className="text-muted">EMI Amount</small>
                <small className="fw-semibold text-danger">{formatCurrency(selectedEMI.emi_amount)}</small>
              </div>
              <div className="d-flex justify-content-between mt-1">
                <small className="text-muted">Due Date</small>
                <small className="fw-semibold">{new Date(selectedPayment.due_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' })}</small>
              </div>
            </div>
          )}
          <Form>
            <FormGroup>
              <Label>Payment Date <span className="text-danger">*</span></Label>
              <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
            </FormGroup>
            <FormGroup>
              <Label>Debit From <span className="text-danger">*</span></Label>
              <Input type="select" value={payAccount} onChange={e => setPayAccount(e.target.value)}>
                <option value="">Select account...</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} — {formatCurrency(a.balance)}</option>)}
              </Input>
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="light" onClick={() => setPayModal(false)}>Cancel</Button>
          <Button color="success" onClick={handleMarkPaid} disabled={saving}>
            {saving && <Spinner size="sm" className="me-2" />}
            Confirm Payment
          </Button>
        </ModalFooter>
      </Modal>
    </React.Fragment>
  );
};

export default EMIs;
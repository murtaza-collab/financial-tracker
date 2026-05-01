import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, CardBody, CardHeader, Button, Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Input, FormFeedback, Alert, Badge, Spinner, Table } from 'reactstrap';
import * as Yup from 'yup';
import { useFormik } from 'formik';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/currency';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import DeleteModal from '../../Components/Common/DeleteModal';
import { useCategories } from '../../hooks/useCategories';

interface Account { id: string; name: string; type: string; balance: number; }
interface Transaction {
  id: string; date: string; amount: number; type: string;
  account_id: string; to_account_id?: string; category: string;
  note: string; accounts?: { name: string };
}

const TRANSACTION_TYPES = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'atm_withdrawal', label: 'ATM Withdrawal' },
  { value: 'reimbursement_received', label: 'Reimbursement Received' },
  { value: 'loan_given', label: 'Loan Given' },
  { value: 'loan_received', label: 'Loan Received' },
  { value: 'emi_payment', label: 'EMI Payment' },
  { value: 'goal_contribution', label: 'Goal Contribution' },
];

const TYPE_COLORS: Record<string, string> = {
  expense: 'danger', income: 'success', transfer: 'info',
  atm_withdrawal: 'warning', credit_card_payment: 'primary',
  reimbursement_received: 'success', loan_given: 'warning',
  loan_received: 'info', emi_payment: 'danger', goal_contribution: 'success',
};

const Transactions = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cashAccounts, setCashAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterAccount, setFilterAccount] = useState('');
  const [deleteModal, setDeleteModal] = useState(false);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Split state
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [peopleList, setPeopleList] = useState<any[]>([]);

  // Recurring state
const [recurringEnabled, setRecurringEnabled] = useState(false);
const [recurringFrequency, setRecurringFrequency] = useState('monthly');
const [recurringStartDate, setRecurringStartDate] = useState(new Date().toISOString().split('T')[0]);

  document.title = 'Transactions | Finance Portal';

  const categories = useCategories(user?.id);

  const fetchAccounts = async () => {
    const { data } = await supabase
      .from('accounts').select('id, name, type, balance')
      .eq('user_id', user?.id).eq('is_archived', false);
    if (data) {
      setAccounts(data);
      setCashAccounts(data.filter(a => a.type === 'cash' || a.type === 'custom_wallet'));
    }
  };

  const fetchPeople = async () => {
    const { data } = await supabase
      .from('split_people').select('*')
      .eq('user_id', user?.id).order('name');
    if (data) setPeopleList(data);
  };

  const fetchTransactions = async () => {
    setLoading(true);
    let query = supabase
      .from('transactions')
      .select('*, accounts!transactions_account_id_fkey(name)')
      .eq('user_id', user?.id)
      .order('date', { ascending: false })
      .limit(100);
    if (filterType) query = query.eq('type', filterType);
    if (filterAccount) query = query.eq('account_id', filterAccount);
    const { data } = await query;
    if (data) setTransactions(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchAccounts();
    fetchPeople();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchTransactions(); }, [filterType, filterAccount]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteClick = (tx: Transaction) => {
    setTxToDelete(tx);
    setDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!txToDelete) return;
    setDeleting(true);
    try {
      const tx = txToDelete;
      const amount = Number(tx.amount);

      // Fetch fresh balances so reversals are accurate
      const accountIds = [tx.account_id, tx.to_account_id].filter(Boolean) as string[];
      const { data: freshAccounts } = await supabase
        .from('accounts').select('id, balance').in('id', accountIds);
      const bal = (id: string) => freshAccounts?.find(a => a.id === id)?.balance ?? 0;

      // Reverse account balance(s)
      if (['expense', 'loan_given', 'emi_payment', 'goal_contribution'].includes(tx.type)) {
        // These debited the source → add back
        await supabase.from('accounts').update({ balance: bal(tx.account_id) + amount }).eq('id', tx.account_id);
      } else if (['income', 'reimbursement_received', 'loan_received'].includes(tx.type)) {
        // These credited the source → subtract back
        await supabase.from('accounts').update({ balance: bal(tx.account_id) - amount }).eq('id', tx.account_id);
      } else if (tx.type === 'transfer' && tx.to_account_id) {
        await supabase.from('accounts').update({ balance: bal(tx.account_id) + amount }).eq('id', tx.account_id);
        await supabase.from('accounts').update({ balance: bal(tx.to_account_id) - amount }).eq('id', tx.to_account_id);
      } else if (tx.type === 'atm_withdrawal') {
        await supabase.from('accounts').update({ balance: bal(tx.account_id) + amount }).eq('id', tx.account_id);
        if (tx.to_account_id) {
          await supabase.from('accounts').update({ balance: bal(tx.to_account_id) - amount }).eq('id', tx.to_account_id);
        }
      }

      // Reverse linked loan repayment (if this tx was logged as a repayment)
      const { data: repayments } = await supabase
        .from('loan_repayments').select('id, loan_id, amount').eq('transaction_id', tx.id);
      if (repayments && repayments.length > 0) {
        for (const rep of repayments) {
          const { data: loan } = await supabase.from('loans').select('outstanding').eq('id', rep.loan_id).single();
          if (loan) {
            await supabase.from('loans').update({ outstanding: loan.outstanding + rep.amount, status: 'active' }).eq('id', rep.loan_id);
          }
        }
        await supabase.from('loan_repayments').delete().eq('transaction_id', tx.id);
      }

      // Remove split outing linked to this transaction
      const { data: outings } = await supabase
        .from('outings').select('id').eq('transaction_id', tx.id);
      if (outings && outings.length > 0) {
        const outingIds = outings.map(o => o.id);
        await supabase.from('outing_participants').delete().in('outing_id', outingIds);
        await supabase.from('outings').delete().eq('transaction_id', tx.id);
      }

      // Delete the transaction
      await supabase.from('transactions').delete().eq('id', tx.id);

      setDeleteModal(false);
      setTxToDelete(null);
      fetchTransactions();
      fetchAccounts();
    } catch (err: any) {
      alert(err.message || 'Failed to delete transaction');
    } finally {
      setDeleting(false);
    }
  };

  const toggleModal = () => {
  setModal(!modal);
  setError('');
  setSplitEnabled(false);
  setSelectedPeople([]);
  setRecurringEnabled(false);
  setRecurringFrequency('monthly');
  setRecurringStartDate(new Date().toISOString().split('T')[0]);
  validation.resetForm();
};

  const validation = useFormik({
    initialValues: {
      date: new Date().toISOString().slice(0, 16),
      amount: '',
      type: 'expense',
      account_id: '',
      to_account_id: '',
      category: '',
      note: '',
    },
    validationSchema: Yup.object({
      amount: Yup.number().positive('Must be positive').required('Please enter amount'),
      type: Yup.string().required('Please select type'),
      account_id: Yup.string().required('Please select account'),
      to_account_id: Yup.string().when('type', {
        is: (val: string) => ['transfer'].includes(val),
        then: (s) => s.required('Please select destination account'),
        otherwise: (s) => s.nullable(),
      }),
    }),
    onSubmit: async (values) => {
      setSaving(true);
      setError('');
      try {
        const amount = Number(values.amount);
        const sourceAccount = accounts.find(a => a.id === values.account_id);

        // Insert transaction
        const { data: tx, error: txError } = await supabase.from('transactions').insert({
          user_id: user?.id,
          date: new Date(values.date).toISOString(),
          amount,
          type: values.type,
          account_id: values.account_id,
          to_account_id: values.to_account_id || null,
          category: values.category || null,
          note: values.note || null,
        }).select().single();
        if (txError) throw txError;

        // Update account balances
        if (['expense', 'loan_given', 'emi_payment', 'goal_contribution'].includes(values.type)) {
          await supabase.from('accounts').update({ balance: (sourceAccount!.balance - amount) }).eq('id', values.account_id);
        } else if (['income', 'reimbursement_received', 'loan_received'].includes(values.type)) {
          await supabase.from('accounts').update({ balance: (sourceAccount!.balance + amount) }).eq('id', values.account_id);
        } else if (values.type === 'transfer') {
          const destAccount = accounts.find(a => a.id === values.to_account_id);
          await supabase.from('accounts').update({ balance: (sourceAccount!.balance - amount) }).eq('id', values.account_id);
          await supabase.from('accounts').update({ balance: (destAccount!.balance + amount) }).eq('id', values.to_account_id);
        } else if (values.type === 'atm_withdrawal') {
          await supabase.from('accounts').update({ balance: (sourceAccount!.balance - amount) }).eq('id', values.account_id);
          if (values.to_account_id) {
            const cashAccount = accounts.find(a => a.id === values.to_account_id);
            await supabase.from('accounts').update({ balance: (cashAccount!.balance + amount) }).eq('id', values.to_account_id);
          }
        }

        // Handle split
        if (splitEnabled && selectedPeople.length > 0 && values.type === 'expense') {
          const totalPeople = selectedPeople.length + 1;
          const perPersonShare = amount / totalPeople;

          const { data: outing } = await supabase.from('outings').insert({
            user_id: user?.id,
            transaction_id: tx.id,
            place_name: values.note || values.category || 'Outing',
            date: new Date(values.date).toISOString().split('T')[0],
            total_amount: amount,
            paid_by: 'me',
            total_people: totalPeople,
            your_share: perPersonShare,
            notes: values.note || null,
          }).select().single();

          // Handle recurring
if (recurringEnabled) {
  const intervalDays = recurringFrequency === 'daily' ? 1
    : recurringFrequency === 'weekly' ? 7 : 30;

  await supabase.from('recurring_rules').insert({
    user_id: user?.id,
    name: values.note || values.category || 'Recurring Transaction',
    amount,
    type: values.type,
    account_id: values.account_id,
    category: values.category || null,
    note: values.note || null,
    frequency: recurringFrequency,
    interval_days: intervalDays,
    next_date: recurringStartDate,
    is_active: true,
  });
}

          if (outing) {
            const participants = selectedPeople.map(personId => ({
              outing_id: outing.id,
              user_id: user?.id,
              person_id: personId,
              share_amount: perPersonShare,
            }));
            await supabase.from('outing_participants').insert(participants);
          }
        }

        toggleModal();
        fetchTransactions();
        fetchAccounts();
      } catch (err: any) {
        setError(err.message || 'Failed to save transaction');
      } finally {
        setSaving(false);
      }
    }
  });

  const txType = validation.values.type;
  const needsToAccount = ['transfer', 'atm_withdrawal'].includes(txType);
  const toAccountLabel: Record<string, string> = {
    transfer: 'Transfer To',
    atm_withdrawal: 'Credit To Cash Wallet',
  };
  const toAccountOptions = txType === 'atm_withdrawal'
    ? cashAccounts
    : accounts.filter(a => a.id !== validation.values.account_id);

  const totalIn = transactions.filter(t => ['income', 'reimbursement_received', 'loan_received'].includes(t.type)).reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = transactions.filter(t => ['expense', 'loan_given', 'emi_payment', 'atm_withdrawal', 'goal_contribution'].includes(t.type)).reduce((s, t) => s + Number(t.amount), 0);

  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>
          <BreadCrumb title="Transactions" pageTitle="Finance Portal" />

          <Row className="mb-4">
            <Col md={4}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1">Money In (This View)</p>
                      <h4 className="text-success">{formatCurrency(totalIn)}</h4>
                    </div>
                    <div className="avatar-sm"><span className="avatar-title bg-success-subtle rounded-circle fs-3"><i className="ri-arrow-down-circle-line text-success"></i></span></div>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1">Money Out (This View)</p>
                      <h4 className="text-danger">{formatCurrency(totalOut)}</h4>
                    </div>
                    <div className="avatar-sm"><span className="avatar-title bg-danger-subtle rounded-circle fs-3"><i className="ri-arrow-up-circle-line text-danger"></i></span></div>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1">Total Transactions</p>
                      <h4>{transactions.length}</h4>
                    </div>
                    <div className="avatar-sm"><span className="avatar-title bg-info-subtle rounded-circle fs-3"><i className="ri-exchange-line text-info"></i></span></div>
                  </div>
                </CardBody>
              </Card>
            </Col>
          </Row>

          <Card>
            <CardHeader className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <h5 className="mb-0">Transaction History</h5>
              <div className="d-flex gap-2 flex-wrap">
                <Input type="select" style={{ width: 160 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
                  <option value="">All Types</option>
                  {TRANSACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Input>
                <Input type="select" style={{ width: 160 }} value={filterAccount} onChange={e => setFilterAccount(e.target.value)}>
                  <option value="">All Accounts</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Input>
                <Button color="success" onClick={toggleModal}>
                  <i className="ri-add-line me-1"></i> Add Transaction
                </Button>
              </div>
            </CardHeader>
            <CardBody>
              {loading ? (
                <div className="text-center py-5"><Spinner color="primary" /></div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-5">
                  <i className="ri-exchange-line fs-1 text-muted"></i>
                  <p className="text-muted mt-2">No transactions yet.</p>
                  <Button color="success" onClick={toggleModal}>Add Transaction</Button>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table className="table-hover table-nowrap mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Account</th>
                        <th>Category</th>
                        <th>Note</th>
                        <th className="text-end">Amount</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map(tx => {
                        const isIn = ['income', 'reimbursement_received', 'loan_received'].includes(tx.type);
                        return (
                          <tr key={tx.id}>
                            <td>{new Date(tx.date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                            <td><Badge color={TYPE_COLORS[tx.type]} pill>{TRANSACTION_TYPES.find(t => t.value === tx.type)?.label || tx.type}</Badge></td>
                            <td>{tx.accounts?.name || '—'}</td>
                            <td>{tx.category || '—'}</td>
                            <td className="text-muted">{tx.note || '—'}</td>
                            <td className={`text-end fw-semibold ${isIn ? 'text-success' : 'text-danger'}`}>
                              {isIn ? '+' : '-'}{formatCurrency(tx.amount)}
                            </td>
                            <td className="text-end">
                              <button
                                className="btn btn-sm btn-ghost-danger p-1"
                                title="Delete & reverse"
                                onClick={() => handleDeleteClick(tx)}
                              >
                                <i className="ri-delete-bin-line fs-15"></i>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              )}
            </CardBody>
          </Card>
        </Container>
      </div>

      <DeleteModal
        show={deleteModal}
        onDeleteClick={handleDeleteConfirm}
        onCloseClick={() => { setDeleteModal(false); setTxToDelete(null); }}
      />

      {/* Add Transaction Modal */}
      <Modal isOpen={modal} toggle={toggleModal} size="md" centered>
        <ModalHeader toggle={toggleModal}>Add Transaction</ModalHeader>
        <ModalBody>
          {error && <Alert color="danger">{error}</Alert>}
          <Form>
            <Row>
              <Col md={6}>
                <FormGroup>
                  <Label>Date & Time <span className="text-danger">*</span></Label>
                  <Input type="datetime-local" name="date" value={validation.values.date} onChange={validation.handleChange} />
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup>
                  <Label>Amount (PKR) <span className="text-danger">*</span></Label>
                  <Input
                    type="number" name="amount" placeholder="0.00"
                    value={validation.values.amount}
                    onChange={validation.handleChange} onBlur={validation.handleBlur}
                    invalid={validation.touched.amount && !!validation.errors.amount}
                  />
                  {validation.touched.amount && validation.errors.amount && <FormFeedback>{validation.errors.amount}</FormFeedback>}
                </FormGroup>
              </Col>
            </Row>

            <FormGroup>
              <Label>Transaction Type <span className="text-danger">*</span></Label>
              <Input type="select" name="type" value={validation.values.type} onChange={validation.handleChange}>
                {TRANSACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Input>
            </FormGroup>

            <FormGroup>
              <Label>Account <span className="text-danger">*</span></Label>
              <Input
                type="select" name="account_id"
                value={validation.values.account_id}
                onChange={validation.handleChange} onBlur={validation.handleBlur}
                invalid={validation.touched.account_id && !!validation.errors.account_id}
              >
                <option value="">Select account...</option>
                {accounts
                  .filter(a => txType === 'atm_withdrawal' ? ['bank_savings', 'bank_current'].includes(a.type) : true)
                  .map(a => <option key={a.id} value={a.id}>{a.name} — {formatCurrency(a.balance)}</option>)
                }
              </Input>
              {validation.touched.account_id && validation.errors.account_id && <FormFeedback>{validation.errors.account_id}</FormFeedback>}
            </FormGroup>

            {needsToAccount && (
              <FormGroup>
                <Label>{toAccountLabel[txType]} <span className="text-danger">*</span></Label>
                <Input
                  type="select" name="to_account_id"
                  value={validation.values.to_account_id}
                  onChange={validation.handleChange} onBlur={validation.handleBlur}
                  invalid={validation.touched.to_account_id && !!validation.errors.to_account_id}
                >
                  <option value="">Select account...</option>
                  {toAccountOptions.map(a => <option key={a.id} value={a.id}>{a.name} — {formatCurrency(a.balance)}</option>)}
                </Input>
                {validation.touched.to_account_id && validation.errors.to_account_id && <FormFeedback>{validation.errors.to_account_id}</FormFeedback>}
              </FormGroup>
            )}

            <FormGroup>
  <Label>Category</Label>
  <Input type="select" name="category" value={validation.values.category} onChange={validation.handleChange}>
    <option value="">Select category...</option>
    {categories.map((c: string) => <option key={c} value={c}>{c}</option>)}
  </Input>
</FormGroup>

            <FormGroup>
              <Label>Note / Description</Label>
              <Input
                type="textarea" name="note" rows={2}
                placeholder="e.g. Cocochan, BBQ Tonight, Kolachi..."
                value={validation.values.note}
                onChange={validation.handleChange}
              />
            </FormGroup>

            {/* Split Toggle — only for expenses */}
            {txType === 'expense' && (
              <div className="mt-2">
                <div className="form-check form-switch mb-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="splitToggle"
                    checked={splitEnabled}
                    onChange={e => {
                      setSplitEnabled(e.target.checked);
                      setSelectedPeople([]);
                    }}
                  />
                  <label className="form-check-label fw-semibold" htmlFor="splitToggle">
                    Split this expense?
                  </label>
                </div>

                {splitEnabled && (
                  <div className="border rounded p-3 bg-light">
                    <Label className="mb-2 fs-12">Who was there? (tap to select)</Label>
                    {peopleList.length === 0 ? (
                      <p className="text-muted fs-12 mb-0">
                        No contacts yet. <a href="/splits">Add people in Splits page</a> first.
                      </p>
                    ) : (
                      <>
                        <div className="d-flex flex-wrap gap-2 mb-3">
                          {peopleList.map(person => (
                            <span
                              key={person.id}
                              onClick={() => setSelectedPeople(prev =>
                                prev.includes(person.id)
                                  ? prev.filter(id => id !== person.id)
                                  : [...prev, person.id]
                              )}
                              className={`badge px-3 py-2 fs-12 ${selectedPeople.includes(person.id) ? 'bg-success' : 'bg-secondary'}`}
                              style={{ cursor: 'pointer' }}
                            >
                              {selectedPeople.includes(person.id) ? '✓ ' : ''}{person.name}
                            </span>
                          ))}
                        </div>

                        {selectedPeople.length > 0 && validation.values.amount && (
                          <div className="bg-white rounded p-2 border">
                            <div className="d-flex justify-content-between">
                              <small className="text-muted">Total people (incl. you)</small>
                              <small className="fw-semibold">{selectedPeople.length + 1}</small>
                            </div>
                            <div className="d-flex justify-content-between">
                              <small className="text-muted">Per person share</small>
                              <small className="fw-semibold text-primary">
                                {formatCurrency(Number(validation.values.amount) / (selectedPeople.length + 1))}
                              </small>
                            </div>
                            <div className="d-flex justify-content-between">
                              <small className="text-muted">To recover from others</small>
                              <small className="fw-semibold text-warning">
                                {formatCurrency(Number(validation.values.amount) - (Number(validation.values.amount) / (selectedPeople.length + 1)))}
                              </small>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
            {/* Recurring Toggle */}
<div className="mt-2">
  <div className="form-check form-switch mb-2">
    <input
      className="form-check-input"
      type="checkbox"
      id="recurringToggle"
      checked={recurringEnabled}
      onChange={e => setRecurringEnabled(e.target.checked)}
    />
    <label className="form-check-label fw-semibold" htmlFor="recurringToggle">
      Make this recurring?
    </label>
  </div>
  {recurringEnabled && (
    <div className="border rounded p-3 bg-light">
      <Row>
        <Col md={6}>
          <FormGroup className="mb-2">
            <Label className="fs-12">Frequency</Label>
            <Input type="select" value={recurringFrequency} onChange={e => setRecurringFrequency(e.target.value)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </Input>
          </FormGroup>
        </Col>
        <Col md={6}>
          <FormGroup className="mb-2">
            <Label className="fs-12">Next Due Date</Label>
            <Input type="date" value={recurringStartDate} onChange={e => setRecurringStartDate(e.target.value)} />
          </FormGroup>
        </Col>
      </Row>
      <small className="text-muted">This will appear in Recurring page for confirmation each cycle.</small>
    </div>
  )}
</div>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="light" onClick={toggleModal}>Cancel</Button>
          <Button color="success" onClick={() => validation.handleSubmit()} disabled={saving}>
            {saving && <Spinner size="sm" className="me-2" />}
            Save Transaction
          </Button>
        </ModalFooter>
      </Modal>
    </React.Fragment>
  );
};

export default Transactions;
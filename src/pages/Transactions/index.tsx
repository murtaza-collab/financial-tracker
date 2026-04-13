import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, CardBody, CardHeader, Button, Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Input, FormFeedback, Alert, Badge, Spinner, Table } from 'reactstrap';
import * as Yup from 'yup';
import { useFormik } from 'formik';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/currency';
import BreadCrumb from '../../Components/Common/BreadCrumb';

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
  { value: 'credit_card_payment', label: 'Credit Card Payment' },
  { value: 'reimbursement_received', label: 'Reimbursement Received' },
  { value: 'loan_given', label: 'Loan Given' },
  { value: 'loan_received', label: 'Loan Received' },
  { value: 'emi_payment', label: 'EMI Payment' },
  { value: 'goal_contribution', label: 'Goal Contribution' },
];

const CATEGORIES = [
  'Grocery', 'Restaurant & Food', 'Fuel', 'Utility Bills',
  'Mobile & Internet', 'Medical', 'Transport', 'Shopping',
  'Education', 'Rent', 'Salary', 'Freelance Income',
  'Business Income', 'Reimbursement', 'Family',
  'Entertainment', 'Travel', 'Office Expense', 'Other',
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

  document.title = 'Transactions | Finance Portal';

  const fetchAccounts = async () => {
    const { data } = await supabase
      .from('accounts').select('id, name, type, balance')
      .eq('user_id', user?.id).eq('is_archived', false);
    if (data) {
      setAccounts(data);
      setCashAccounts(data.filter(a => a.type === 'cash' || a.type === 'custom_wallet'));
    }
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

  useEffect(() => { fetchAccounts(); }, []);
  useEffect(() => { fetchTransactions(); }, [filterType, filterAccount]);

  const toggleModal = () => {
    setModal(!modal);
    setError('');
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
        is: (val: string) => ['transfer', 'credit_card_payment'].includes(val),
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

        // Insert the transaction
        const { error: txError } = await supabase.from('transactions').insert({
          user_id: user?.id,
          date: new Date(values.date).toISOString(),
          amount,
          type: values.type,
          account_id: values.account_id,
          to_account_id: values.to_account_id || null,
          category: values.category || null,
          note: values.note || null,
        });
        if (txError) throw txError;

        // Update account balances
        if (values.type === 'expense' || values.type === 'loan_given' || values.type === 'emi_payment' || values.type === 'goal_contribution') {
          await supabase.from('accounts').update({ balance: (sourceAccount!.balance - amount) }).eq('id', values.account_id);
        }
        else if (values.type === 'income' || values.type === 'reimbursement_received' || values.type === 'loan_received') {
          await supabase.from('accounts').update({ balance: (sourceAccount!.balance + amount) }).eq('id', values.account_id);
        }
        else if (values.type === 'transfer' || values.type === 'credit_card_payment') {
          const destAccount = accounts.find(a => a.id === values.to_account_id);
          await supabase.from('accounts').update({ balance: (sourceAccount!.balance - amount) }).eq('id', values.account_id);
          await supabase.from('accounts').update({ balance: (destAccount!.balance - amount) }).eq('id', values.to_account_id);
        }
        else if (values.type === 'atm_withdrawal') {
          // Debit bank, credit cash wallet
          await supabase.from('accounts').update({ balance: (sourceAccount!.balance - amount) }).eq('id', values.account_id);
          if (values.to_account_id) {
            const cashAccount = accounts.find(a => a.id === values.to_account_id);
            await supabase.from('accounts').update({ balance: (cashAccount!.balance + amount) }).eq('id', values.to_account_id);
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
  const needsToAccount = ['transfer', 'credit_card_payment', 'atm_withdrawal'].includes(txType);
  const toAccountLabel: Record<string, string> = {
    transfer: 'Transfer To',
    credit_card_payment: 'Pay Credit Card',
    atm_withdrawal: 'Credit To Cash Wallet',
  };
  const toAccountOptions = txType === 'credit_card_payment'
    ? accounts.filter(a => a.type === 'credit_card')
    : txType === 'atm_withdrawal'
    ? cashAccounts
    : accounts.filter(a => a.id !== validation.values.account_id);

  const totalIn = transactions.filter(t => ['income', 'reimbursement_received', 'loan_received'].includes(t.type)).reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = transactions.filter(t => ['expense', 'loan_given', 'emi_payment', 'credit_card_payment', 'atm_withdrawal', 'goal_contribution'].includes(t.type)).reduce((s, t) => s + Number(t.amount), 0);
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
                  <p className="text-muted mt-2">No transactions yet. Add your first transaction.</p>
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
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map(tx => {
                        const isIn = ['income', 'reimbursement_received', 'loan_received'].includes(tx.type);
                        return (
                          <tr key={tx.id}>
                            <td>{new Date(tx.date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                            <td><Badge color={TYPE_COLORS[tx.type]} pill>{TRANSACTION_TYPES.find(t => t.value === tx.type)?.label}</Badge></td>
                            <td>{tx.accounts?.name || '—'}</td>
                            <td>{tx.category || '—'}</td>
                            <td className="text-muted">{tx.note || '—'}</td>
                            <td className={`text-end fw-semibold ${isIn ? 'text-success' : 'text-danger'}`}>
                              {isIn ? '+' : '-'}{formatCurrency(tx.amount)}
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
              <Label>{txType === 'atm_withdrawal' ? 'Debit From Bank' : txType === 'transfer' ? 'Transfer From' : txType === 'credit_card_payment' ? 'Pay From Account' : 'Account'} <span className="text-danger">*</span></Label>
              <Input
                type="select" name="account_id"
                value={validation.values.account_id}
                onChange={validation.handleChange} onBlur={validation.handleBlur}
                invalid={validation.touched.account_id && !!validation.errors.account_id}
              >
                <option value="">Select account...</option>
                {accounts
                  .filter(a => txType === 'atm_withdrawal' ? ['bank_savings', 'bank_current'].includes(a.type) : txType === 'credit_card_payment' ? ['bank_savings', 'bank_current'].includes(a.type) : true)
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
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </Input>
            </FormGroup>

            <FormGroup>
              <Label>Note / Description</Label>
              <Input
                type="textarea" name="note" rows={2}
                placeholder="e.g. Groceries from Imtiaz, Fuel at PSO..."
                value={validation.values.note}
                onChange={validation.handleChange}
              />
            </FormGroup>
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
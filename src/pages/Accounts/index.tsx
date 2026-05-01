import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, CardBody, CardHeader, Button, Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Input, FormFeedback, Alert, Badge, Spinner } from 'reactstrap';
import * as Yup from 'yup';
import { useFormik } from 'formik';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/currency';
import BreadCrumb from '../../Components/Common/BreadCrumb';

interface Account {
  id: string;
  name: string;
  bank_name: string;
  type: string;
  balance: number;
  credit_limit?: number;
  billing_date?: number;
  due_date?: number;
  last_four?: string;
  is_archived: boolean;
}

const accountTypeLabels: Record<string, string> = {
  bank_savings: 'Savings Account',
  bank_current: 'Current Account',
  credit_card: 'Credit Card',
  cash: 'Cash Wallet',
  custom_wallet: 'Custom Wallet',
};

const accountTypeColors: Record<string, string> = {
  bank_savings: 'success',
  bank_current: 'info',
  credit_card: 'danger',
  cash: 'warning',
  custom_wallet: 'secondary',
};

const PAKISTAN_BANKS = [
  'AlBaraka Bank (Pakistan) Limited',
  'Allied Bank Limited',
  'Askari Bank Limited',
  'Bank AL Habib Limited',
  'Bank Alfalah Limited',
  'The Bank of Khyber',
  'The Bank of Punjab',
  'BankIslami Pakistan Limited',
  'Citibank N.A.',
  'Deutsche Bank AG',
  'Dubai Islamic Bank Pakistan Limited',
  'Faysal Bank Limited',
  'First Women Bank Limited',
  'Habib Bank Limited',
  'Habib Metropolitan Bank Limited',
  'Industrial and Commercial Bank of China Limited',
  'JS Bank Limited',
  'Meezan Bank Limited',
  'MCB Bank Limited',
  'MCB Islamic Bank',
  'National Bank of Pakistan',
  'Samba Bank Limited',
  'Sindh Bank Limited',
  'Easypaisa Bank Limited',
  'SME Bank Limited',
  'Soneri Bank Limited',
  'Standard Chartered Bank (Pakistan) Ltd',
  'United Bank Limited',
];

const accountTypeIcons: Record<string, string> = {
  bank_savings: 'ri-bank-line',
  bank_current: 'ri-bank-line',
  credit_card: 'ri-bank-card-line',
  cash: 'ri-money-dollar-circle-line',
  custom_wallet: 'ri-wallet-3-line',
};

const Accounts = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  document.title = 'Accounts | Finance Portal';

  const fetchAccounts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user?.id)
      .eq('is_archived', false)
      .order('created_at', { ascending: true });
    if (!error && data) setAccounts(data);
    setLoading(false);
  };

  useEffect(() => { fetchAccounts(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleModal = () => {
    setModal(!modal);
    setEditAccount(null);
    setError('');
    validation.resetForm();
  };

  const openEdit = (account: Account) => {
    setEditAccount(account);
    setModal(true);
  };

  const handleArchive = async (id: string) => {
    await supabase.from('accounts').update({ is_archived: true }).eq('id', id);
    fetchAccounts();
  };

  const validation = useFormik({
    enableReinitialize: true,
    initialValues: {
      name: editAccount?.name || '',
      bank_name: editAccount?.bank_name || '',
      type: editAccount?.type || 'bank_savings',
      balance: editAccount?.balance ?? 0,
      credit_limit: editAccount?.credit_limit ?? '',
      billing_date: editAccount?.billing_date ?? '',
      due_date: editAccount?.due_date ?? '',
      last_four: editAccount?.last_four || '',
    },
    validationSchema: Yup.object({
      name: Yup.string().required('Please enter an account name'),
      type: Yup.string().required('Please select account type'),
      balance: Yup.number().required('Please enter opening balance'),
      credit_limit: Yup.number().when('type', {
        is: 'credit_card',
        then: (s) => s.required('Please enter credit limit'),
        otherwise: (s) => s.nullable(),
      }),
      billing_date: Yup.number().when('type', {
        is: 'credit_card',
        then: (s) => s.min(1).max(31).required('Please enter billing date'),
        otherwise: (s) => s.nullable(),
      }),
      due_date: Yup.number().when('type', {
        is: 'credit_card',
        then: (s) => s.min(1).max(31).required('Please enter due date'),
        otherwise: (s) => s.nullable(),
      }),
      last_four: Yup.string().when('type', {
        is: (val: string) => ['bank_savings', 'bank_current', 'credit_card'].includes(val),
        then: (s) => s.length(4, 'Must be 4 digits').matches(/^\d{4}$/, 'Digits only'),
        otherwise: (s) => s.nullable(),
      }),
    }),
    onSubmit: async (values) => {
      setSaving(true);
      setError('');
      const payload = {
        user_id: user?.id,
        name: values.name,
        bank_name: values.bank_name || null,
        type: values.type,
        balance: Number(values.balance),
        credit_limit: values.credit_limit ? Number(values.credit_limit) : null,
        billing_date: values.billing_date ? Number(values.billing_date) : null,
        due_date: values.due_date ? Number(values.due_date) : null,
        last_four: values.last_four || null,
      };
      let err;
      if (editAccount) {
        ({ error: err } = await supabase.from('accounts').update(payload).eq('id', editAccount.id));
      } else {
        ({ error: err } = await supabase.from('accounts').insert(payload));
      }
      if (err) { setError(err.message); } 
      else { toggleModal(); fetchAccounts(); }
      setSaving(false);
    }
  });

  const isCreditCard = validation.values.type === 'credit_card';
  const hasAccountNumber = ['bank_savings', 'bank_current', 'credit_card'].includes(validation.values.type);

  const totalBalance = accounts
    .filter(a => a.type !== 'credit_card')
    .reduce((sum, a) => sum + Number(a.balance), 0);

  const totalCreditOutstanding = accounts
    .filter(a => a.type === 'credit_card')
    .reduce((sum, a) => sum + Number(a.balance), 0);

  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>
          <BreadCrumb title="Accounts & Cards" pageTitle="Finance Portal" />

          {/* Summary Row */}
          <Row className="mb-4">
            <Col md={4}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1">Total Balance</p>
                      <h4 className="text-success">{formatCurrency(totalBalance)}</h4>
                    </div>
                    <div className="avatar-sm"><span className="avatar-title bg-success-subtle rounded-circle fs-3"><i className="ri-money-dollar-circle-line text-success"></i></span></div>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1">Credit Card Outstanding</p>
                      <h4 className="text-danger">{formatCurrency(totalCreditOutstanding)}</h4>
                    </div>
                    <div className="avatar-sm"><span className="avatar-title bg-danger-subtle rounded-circle fs-3"><i className="ri-bank-card-line text-danger"></i></span></div>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1">Total Accounts</p>
                      <h4>{accounts.length}</h4>
                    </div>
                    <div className="avatar-sm"><span className="avatar-title bg-info-subtle rounded-circle fs-3"><i className="ri-bank-line text-info"></i></span></div>
                  </div>
                </CardBody>
              </Card>
            </Col>
          </Row>

          {/* Accounts List */}
          <Row>
            <Col>
              <Card>
                <CardHeader className="d-flex align-items-center justify-content-between">
                  <h5 className="mb-0">My Accounts & Cards</h5>
                  <Button color="success" size="sm" onClick={toggleModal}>
                    <i className="ri-add-line me-1"></i> Add Account
                  </Button>
                </CardHeader>
                <CardBody>
                  {loading ? (
                    <div className="text-center py-5"><Spinner color="primary" /></div>
                  ) : accounts.length === 0 ? (
                    <div className="text-center py-5">
                      <i className="ri-bank-line fs-1 text-muted"></i>
                      <p className="text-muted mt-2">No accounts yet. Add your first account to get started.</p>
                      <Button color="success" onClick={toggleModal}>Add Account</Button>
                    </div>
                  ) : (
                    <Row>
                      {accounts.map((account) => (
                        <Col md={6} xl={4} key={account.id} className="mb-3">
                          <Card className="border mb-0 h-100">
                            <CardBody>
                              <div className="d-flex align-items-center mb-3">
                                <div className={`avatar-sm me-3`}>
                                  <span className={`avatar-title bg-${accountTypeColors[account.type]}-subtle rounded-circle fs-4`}>
                                    <i className={`${accountTypeIcons[account.type]} text-${accountTypeColors[account.type]}`}></i>
                                  </span>
                                </div>
                                <div className="flex-grow-1">
                                  <h6 className="mb-0">{account.name}</h6>
                                  <small className="text-muted">{account.bank_name || accountTypeLabels[account.type]}</small>
                                </div>
                                <Badge color={accountTypeColors[account.type]} pill>
                                  {accountTypeLabels[account.type]}
                                </Badge>
                              </div>

                              <div className="mb-3">
                                <p className="text-muted mb-1 fs-12">
                                  {account.type === 'credit_card' ? 'Outstanding Balance' : 'Current Balance'}
                                </p>
                                <h5 className={account.type === 'credit_card' ? 'text-danger' : 'text-success'}>
                                  {formatCurrency(Number(account.balance))}
                                </h5>
                                {account.type === 'credit_card' && account.credit_limit && (
                                  <small className="text-muted">Limit: {formatCurrency(Number(account.credit_limit))}</small>
                                )}
                              </div>

                              {account.last_four && (
                                <p className="text-muted fs-12 mb-3">
                                  <i className="ri-bank-card-line me-1"></i> •••• {account.last_four}
                                </p>
                              )}

                              {account.type === 'credit_card' && (
                                <div className="d-flex gap-3 mb-3">
                                  {account.billing_date && <small className="text-muted"><i className="ri-calendar-line me-1"></i>Bills on {account.billing_date}th</small>}
                                  {account.due_date && <small className="text-muted"><i className="ri-time-line me-1"></i>Due on {account.due_date}th</small>}
                                </div>
                              )}

                              <div className="d-flex gap-2">
                                <Button color="soft-primary" size="sm" className="flex-grow-1" onClick={() => openEdit(account)}>
                                  <i className="ri-edit-line me-1"></i> Edit
                                </Button>
                                <Button color="soft-danger" size="sm" onClick={() => handleArchive(account.id)}>
                                  <i className="ri-archive-line"></i>
                                </Button>
                              </div>
                            </CardBody>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  )}
                </CardBody>
              </Card>
            </Col>
          </Row>
        </Container>
      </div>

      {/* Add / Edit Modal */}
      <Modal isOpen={modal} toggle={toggleModal} size="md" centered>
        <ModalHeader toggle={toggleModal}>
          {editAccount ? 'Edit Account' : 'Add New Account'}
        </ModalHeader>
        <ModalBody>
          {error && <Alert color="danger">{error}</Alert>}
          <Form>
            <FormGroup>
              <Label>Account Type <span className="text-danger">*</span></Label>
              <Input type="select" name="type" value={validation.values.type} onChange={validation.handleChange}>
                <option value="bank_savings">Savings Account</option>
                <option value="bank_current">Current Account</option>
                <option value="credit_card">Credit Card</option>
                <option value="cash">Cash Wallet</option>
                <option value="custom_wallet">Custom Wallet</option>
              </Input>
            </FormGroup>

            <FormGroup>
              <Label>Account Nickname <span className="text-danger">*</span></Label>
              <Input
                name="name"
                placeholder={isCreditCard ? 'e.g. HDFC Regalia' : 'e.g. SBI Savings'}
                value={validation.values.name}
                onChange={validation.handleChange}
                onBlur={validation.handleBlur}
                invalid={validation.touched.name && !!validation.errors.name}
              />
              {validation.touched.name && validation.errors.name && <FormFeedback>{validation.errors.name}</FormFeedback>}
            </FormGroup>

            {['bank_savings', 'bank_current', 'credit_card'].includes(validation.values.type) && (
  <FormGroup>
    <Label>Bank Name</Label>
    <Input
      type="select"
      name="bank_name"
      value={validation.values.bank_name}
      onChange={validation.handleChange}
    >
      <option value="">Select bank...</option>
      {PAKISTAN_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
      <option value="Other">Other</option>
    </Input>
  </FormGroup>
)}

            <FormGroup>
              <Label>{isCreditCard ? 'Current Outstanding (PKR)' : 'Opening Balance (PKR)'} <span className="text-danger">*</span></Label>
              <Input
                type="number"
                name="balance"
                placeholder="0.00"
                value={validation.values.balance}
                onChange={validation.handleChange}
                onBlur={validation.handleBlur}
                invalid={validation.touched.balance && !!validation.errors.balance}
              />
              {validation.touched.balance && validation.errors.balance && <FormFeedback>{validation.errors.balance}</FormFeedback>}
            </FormGroup>

            {isCreditCard && (
              <>
                <FormGroup>
                  <Label>Credit Limit (PKR) <span className="text-danger">*</span></Label>
                  <Input
                    type="number"
                    name="credit_limit"
                    placeholder="e.g. 100000"
                    value={validation.values.credit_limit}
                    onChange={validation.handleChange}
                    onBlur={validation.handleBlur}
                    invalid={validation.touched.credit_limit && !!validation.errors.credit_limit}
                  />
                  {validation.touched.credit_limit && validation.errors.credit_limit && <FormFeedback>{validation.errors.credit_limit as string}</FormFeedback>}
                </FormGroup>
                <Row>
                  <Col md={6}>
                    <FormGroup>
                      <Label>Billing Date <span className="text-danger">*</span></Label>
                      <Input
                        type="number"
                        name="billing_date"
                        placeholder="e.g. 15"
                        min={1} max={31}
                        value={validation.values.billing_date}
                        onChange={validation.handleChange}
                        onBlur={validation.handleBlur}
                        invalid={validation.touched.billing_date && !!validation.errors.billing_date}
                      />
                      {validation.touched.billing_date && validation.errors.billing_date && <FormFeedback>{validation.errors.billing_date as string}</FormFeedback>}
                    </FormGroup>
                  </Col>
                  <Col md={6}>
                    <FormGroup>
                      <Label>Due Date <span className="text-danger">*</span></Label>
                      <Input
                        type="number"
                        name="due_date"
                        placeholder="e.g. 5"
                        min={1} max={31}
                        value={validation.values.due_date}
                        onChange={validation.handleChange}
                        onBlur={validation.handleBlur}
                        invalid={validation.touched.due_date && !!validation.errors.due_date}
                      />
                      {validation.touched.due_date && validation.errors.due_date && <FormFeedback>{validation.errors.due_date as string}</FormFeedback>}
                    </FormGroup>
                  </Col>
                </Row>
              </>
            )}

            {hasAccountNumber && (
              <FormGroup>
                <Label>Last 4 Digits</Label>
                <Input
                  name="last_four"
                  placeholder="e.g. 4242"
                  maxLength={4}
                  value={validation.values.last_four}
                  onChange={validation.handleChange}
                  onBlur={validation.handleBlur}
                  invalid={validation.touched.last_four && !!validation.errors.last_four}
                />
                {validation.touched.last_four && validation.errors.last_four && <FormFeedback>{validation.errors.last_four as string}</FormFeedback>}
              </FormGroup>
            )}
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="light" onClick={toggleModal}>Cancel</Button>
          <Button color="success" onClick={() => validation.handleSubmit()} disabled={saving}>
            {saving && <Spinner size="sm" className="me-2" />}
            {editAccount ? 'Save Changes' : 'Add Account'}
          </Button>
        </ModalFooter>
      </Modal>
    </React.Fragment>
  );
};

export default Accounts;
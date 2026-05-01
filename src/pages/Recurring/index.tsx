import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, CardBody, CardHeader, Button, Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Input, Alert, Badge, Spinner, Table, Nav, NavItem, NavLink } from 'reactstrap';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/currency';
import BreadCrumb from '../../Components/Common/BreadCrumb';
import { useCategories } from '../../hooks/useCategories';

interface Account { id: string; name: string; type: string; balance: number; }
interface RecurringRule {
  id: string; name: string; amount: number; type: string;
  account_id: string; category: string; note: string;
  frequency: string; interval_days: number; next_date: string;
  end_date: string; is_active: boolean;
  accounts?: { name: string };
}
interface RecurringInstance {
  id: string; rule_id: string; due_date: string; status: string;
  recurring_rules?: RecurringRule;
}

const TRANSACTION_TYPES = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
];

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom (every N days)' },
];

const Recurring = () => {
  const { user } = useAuth();
  const categories = useCategories(user?.id);
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [instances, setInstances] = useState<RecurringInstance[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [modal, setModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<RecurringInstance | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // New rule form
  const [ruleName, setRuleName] = useState('');
  const [ruleAmount, setRuleAmount] = useState('');
  const [ruleType, setRuleType] = useState('expense');
  const [ruleAccount, setRuleAccount] = useState('');
  const [ruleCategory, setRuleCategory] = useState('');
  const [ruleNote, setRuleNote] = useState('');
  const [ruleFrequency, setRuleFrequency] = useState('monthly');
  const [ruleIntervalDays, setRuleIntervalDays] = useState('30');
  const [ruleStartDate, setRuleStartDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [ruleEndDate, setRuleEndDate] = useState('');

  // Confirm form
  const [confirmAmount, setConfirmAmount] = useState('');
  const [confirmAccount, setConfirmAccount] = useState('');
  const [confirmDate, setConfirmDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [confirmNote, setConfirmNote] = useState('');

  document.title = 'Recurring Transactions | Finance Portal';

  const fetchData = async () => {
    setLoading(true);
    const { data: accData } = await supabase
      .from('accounts').select('id, name, type, balance')
      .eq('user_id', user?.id).eq('is_archived', false);

    const { data: rulesData } = await supabase
      .from('recurring_rules')
      .select('*, accounts!recurring_rules_account_id_fkey(name)')
      .eq('user_id', user?.id)
      .eq('is_active', true)
      .order('next_date', { ascending: true });

    const { data: instancesData } = await supabase
      .from('recurring_instances')
      .select('*, recurring_rules(*, accounts!recurring_rules_account_id_fkey(name))')
      .eq('user_id', user?.id)
      .eq('status', 'pending')
      .order('due_date', { ascending: true });

    if (accData) setAccounts(accData);
    if (rulesData) {
      setRules(rulesData);
      // Auto-generate pending instances for overdue rules
      await generatePendingInstances(rulesData);
    }
    if (instancesData) setInstances(instancesData);
    setLoading(false);
  };

  const generatePendingInstances = async (rulesData: RecurringRule[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const rule of rulesData) {
      let nextDate = new Date(rule.next_date);
      nextDate.setHours(0, 0, 0, 0);

      // Generate instances for all overdue dates
      while (nextDate <= today) {
        // Check if instance already exists
        const { data: existing } = await supabase
          .from('recurring_instances')
          .select('id')
          .eq('rule_id', rule.id)
          .eq('due_date', nextDate.toLocaleDateString('en-CA'))
          .single();

        if (!existing) {
          await supabase.from('recurring_instances').insert({
            rule_id: rule.id,
            user_id: user?.id,
            due_date: nextDate.toLocaleDateString('en-CA'),
            status: 'pending',
          });
        }

        // Move to next date
        const intervalDays = getIntervalDays(rule.frequency, rule.interval_days);
        nextDate.setDate(nextDate.getDate() + intervalDays);
      }

      // Update rule's next_date
      await supabase.from('recurring_rules').update({
        next_date: nextDate.toLocaleDateString('en-CA'),
      }).eq('id', rule.id);
    }
  };

  const getIntervalDays = (frequency: string, intervalDays: number) => {
    if (frequency === 'daily') return 1;
    if (frequency === 'weekly') return 7;
    if (frequency === 'monthly') return 30;
    return intervalDays || 30;
  };

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddRule = async () => {
    if (!ruleName || !ruleAmount || !ruleAccount) {
      setError('Please fill all required fields');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const intervalDays = ruleFrequency === 'daily' ? 1
        : ruleFrequency === 'weekly' ? 7
        : ruleFrequency === 'monthly' ? 30
        : Number(ruleIntervalDays);

      await supabase.from('recurring_rules').insert({
        user_id: user?.id,
        name: ruleName,
        amount: Number(ruleAmount),
        type: ruleType,
        account_id: ruleAccount,
        category: ruleCategory || null,
        note: ruleNote || null,
        frequency: ruleFrequency,
        interval_days: intervalDays,
        next_date: ruleStartDate,
        end_date: ruleEndDate || null,
        is_active: true,
      });

      setModal(false);
      resetRuleForm();
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const resetRuleForm = () => {
    setRuleName(''); setRuleAmount(''); setRuleType('expense');
    setRuleAccount(''); setRuleCategory(''); setRuleNote('');
    setRuleFrequency('monthly'); setRuleIntervalDays('30');
    setRuleStartDate(new Date().toLocaleDateString('en-CA'));
    setRuleEndDate(''); setError('');
  };

  const openConfirmModal = (instance: RecurringInstance) => {
    setSelectedInstance(instance);
    setConfirmAmount(String(instance.recurring_rules?.amount || ''));
    setConfirmAccount(instance.recurring_rules?.account_id || '');
    setConfirmDate(new Date().toLocaleDateString('en-CA'));
    setConfirmNote(instance.recurring_rules?.note || '');
    setError('');
    setConfirmModal(true);
  };

  const handleConfirm = async () => {
    if (!selectedInstance || !confirmAmount || !confirmAccount) {
      setError('Please fill all required fields');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const amount = Number(confirmAmount);
      const rule = selectedInstance.recurring_rules!;
      const { data: freshAcc } = await supabase
        .from('accounts').select('balance').eq('id', confirmAccount).single();

      // Create transaction
      const { data: tx } = await supabase.from('transactions').insert({
        user_id: user?.id,
        date: new Date(confirmDate).toISOString(),
        amount,
        type: rule.type,
        account_id: confirmAccount,
        category: rule.category || null,
        note: confirmNote || rule.name,
      }).select().single();

      // Update account balance
      if (freshAcc) {
        const isIncome = ['income', 'reimbursement_received', 'loan_received'].includes(rule.type);
        const newBalance = isIncome
          ? freshAcc.balance + amount
          : freshAcc.balance - amount;
        await supabase.from('accounts').update({ balance: newBalance }).eq('id', confirmAccount);
      }

      // Mark instance as confirmed
      await supabase.from('recurring_instances').update({
        status: 'confirmed',
        transaction_id: tx?.id || null,
      }).eq('id', selectedInstance.id);

      setConfirmModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async (instanceId: string) => {
    if (!window.confirm('Skip this occurrence? It will be marked as skipped.')) return;
    await supabase.from('recurring_instances').update({ status: 'skipped' }).eq('id', instanceId);
    fetchData();
  };

  const handleDeactivateRule = async (ruleId: string) => {
    if (!window.confirm('Stop this recurring transaction?')) return;
    await supabase.from('recurring_rules').update({ is_active: false }).eq('id', ruleId);
    fetchData();
  };

  const getDaysOverdue = (dateStr: string) => {
    const days = Math.ceil((new Date().setHours(0,0,0,0) - new Date(dateStr).getTime()) / 86400000);
    return days;
  };

  const pendingInstances = instances.filter(i => i.status === 'pending');

  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>
          <BreadCrumb title="Recurring Transactions" pageTitle="Finance Portal" />

          <Row className="mb-4">
            <Col md={4}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1">Pending Confirmations</p>
                      <h4 className={pendingInstances.length > 0 ? 'text-warning' : 'text-success'}>
                        {pendingInstances.length}
                      </h4>
                      <small className="text-muted">Awaiting your review</small>
                    </div>
                    <div className="avatar-sm"><span className="avatar-title bg-warning-subtle rounded-circle fs-3"><i className="ri-repeat-line text-warning"></i></span></div>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1">Active Rules</p>
                      <h4>{rules.length}</h4>
                    </div>
                    <div className="avatar-sm"><span className="avatar-title bg-info-subtle rounded-circle fs-3"><i className="ri-calendar-line text-info"></i></span></div>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col md={4} className="d-flex align-items-center">
              <Button color="success" className="w-100" onClick={() => setModal(true)}>
                <i className="ri-add-line me-2"></i> Add Recurring Transaction
              </Button>
            </Col>
          </Row>

          <Card>
            <CardHeader>
              <Nav tabs className="card-header-tabs">
                <NavItem>
                  <NavLink active={activeTab === 'pending'} onClick={() => setActiveTab('pending')} style={{ cursor: 'pointer' }}>
                    Pending <Badge color="warning" className="ms-1">{pendingInstances.length}</Badge>
                  </NavLink>
                </NavItem>
                <NavItem>
                  <NavLink active={activeTab === 'rules'} onClick={() => setActiveTab('rules')} style={{ cursor: 'pointer' }}>
                    All Rules <Badge color="info" className="ms-1">{rules.length}</Badge>
                  </NavLink>
                </NavItem>
              </Nav>
            </CardHeader>
            <CardBody>
              {loading ? (
                <div className="text-center py-5"><Spinner color="primary" /></div>
              ) : activeTab === 'pending' ? (
                pendingInstances.length === 0 ? (
                  <div className="text-center py-5">
                    <i className="ri-checkbox-circle-line fs-1 text-success"></i>
                    <p className="text-success mt-2 fw-semibold">All caught up! No pending recurring transactions.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <Table className="table-hover mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Transaction</th>
                          <th>Account</th>
                          <th>Due Date</th>
                          <th>Status</th>
                          <th className="text-end">Amount</th>
                          <th className="text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingInstances.map(instance => {
                          const rule = instance.recurring_rules;
                          const daysOverdue = getDaysOverdue(instance.due_date);
                          return (
                            <tr key={instance.id}>
                              <td>
                                <p className="mb-0 fw-semibold">{rule?.name}</p>
                                <small className="text-muted">{rule?.category} • {rule?.frequency}</small>
                              </td>
                              <td>{rule?.accounts?.name || '—'}</td>
                              <td>
                                <p className="mb-0">{new Date(instance.due_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                {daysOverdue > 0 && (
                                  <small className="text-danger">Overdue by {daysOverdue} day{daysOverdue > 1 ? 's' : ''}</small>
                                )}
                                {daysOverdue === 0 && <small className="text-warning">Due today</small>}
                              </td>
                              <td>
                                <Badge color={daysOverdue > 7 ? 'danger' : daysOverdue > 0 ? 'warning' : 'info'} pill>
                                  {daysOverdue > 0 ? 'Overdue' : 'Due Today'}
                                </Badge>
                              </td>
                              <td className="text-end fw-semibold">
                                {formatCurrency(rule?.amount || 0)}
                              </td>
                              <td className="text-center">
                                <div className="d-flex justify-content-center gap-2">
                                  <Button color="success" size="sm" onClick={() => openConfirmModal(instance)}>
                                    <i className="ri-checkbox-circle-line me-1"></i> Confirm
                                  </Button>
                                  <Button color="soft-danger" size="sm" onClick={() => handleSkip(instance.id)}>
                                    Skip
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>
                )
              ) : (
                // Rules tab
                rules.length === 0 ? (
                  <div className="text-center py-5">
                    <i className="ri-repeat-line fs-1 text-muted"></i>
                    <p className="text-muted mt-2">No recurring rules yet.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <Table className="table-hover mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Name</th>
                          <th>Type</th>
                          <th>Account</th>
                          <th>Frequency</th>
                          <th>Next Due</th>
                          <th className="text-end">Amount</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {rules.map(rule => (
                          <tr key={rule.id}>
                            <td>
                              <p className="mb-0 fw-semibold">{rule.name}</p>
                              <small className="text-muted">{rule.category}</small>
                            </td>
                            <td><Badge color={rule.type === 'income' ? 'success' : 'danger'} pill>{rule.type}</Badge></td>
                            <td>{rule.accounts?.name || '—'}</td>
                            <td className="text-capitalize">{rule.frequency}</td>
                            <td>{new Date(rule.next_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                            <td className="text-end fw-semibold">{formatCurrency(rule.amount)}</td>
                            <td>
                              <Button color="soft-danger" size="sm" onClick={() => handleDeactivateRule(rule.id)}>
                                <i className="ri-stop-circle-line me-1"></i> Stop
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )
              )}
            </CardBody>
          </Card>
        </Container>
      </div>

      {/* Add Rule Modal */}
      <Modal isOpen={modal} toggle={() => { setModal(false); resetRuleForm(); }} centered size="md">
        <ModalHeader toggle={() => { setModal(false); resetRuleForm(); }}>Add Recurring Transaction</ModalHeader>
        <ModalBody>
          {error && <Alert color="danger">{error}</Alert>}
          <Form>
            <FormGroup>
              <Label>Name <span className="text-danger">*</span></Label>
              <Input value={ruleName} onChange={e => setRuleName(e.target.value)} placeholder="e.g. Internet Bill, House Rent, Netflix..." />
            </FormGroup>
            <Row>
              <Col md={6}>
                <FormGroup>
                  <Label>Type <span className="text-danger">*</span></Label>
                  <Input type="select" value={ruleType} onChange={e => setRuleType(e.target.value)}>
                    {TRANSACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </Input>
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup>
                  <Label>Amount (PKR) <span className="text-danger">*</span></Label>
                  <Input type="number" value={ruleAmount} onChange={e => setRuleAmount(e.target.value)} placeholder="0.00" />
                </FormGroup>
              </Col>
            </Row>
            <FormGroup>
              <Label>Account <span className="text-danger">*</span></Label>
              <Input type="select" value={ruleAccount} onChange={e => setRuleAccount(e.target.value)}>
                <option value="">Select account...</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} — {formatCurrency(a.balance)}</option>)}
              </Input>
            </FormGroup>
            <Row>
              <Col md={6}>
                <FormGroup>
                  <Label>Category</Label>
                  <Input type="select" value={ruleCategory} onChange={e => setRuleCategory(e.target.value)}>
                    <option value="">Select category...</option>
                    {categories.map((c: string) => <option key={c} value={c}>{c}</option>)}
                  </Input>
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup>
                  <Label>Frequency <span className="text-danger">*</span></Label>
                  <Input type="select" value={ruleFrequency} onChange={e => setRuleFrequency(e.target.value)}>
                    {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </Input>
                </FormGroup>
              </Col>
            </Row>
            {ruleFrequency === 'custom' && (
              <FormGroup>
                <Label>Every how many days? <span className="text-danger">*</span></Label>
                <Input type="number" value={ruleIntervalDays} onChange={e => setRuleIntervalDays(e.target.value)} placeholder="e.g. 14 for every 2 weeks" />
              </FormGroup>
            )}
            <Row>
              <Col md={6}>
                <FormGroup>
                  <Label>First Due Date <span className="text-danger">*</span></Label>
                  <Input type="date" value={ruleStartDate} onChange={e => setRuleStartDate(e.target.value)} />
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup>
                  <Label>End Date</Label>
                  <Input type="date" value={ruleEndDate} onChange={e => setRuleEndDate(e.target.value)} />
                  <small className="text-muted">Leave blank for no end</small>
                </FormGroup>
              </Col>
            </Row>
            <FormGroup>
              <Label>Note</Label>
              <Input type="text" value={ruleNote} onChange={e => setRuleNote(e.target.value)} placeholder="Optional note" />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="light" onClick={() => { setModal(false); resetRuleForm(); }}>Cancel</Button>
          <Button color="success" onClick={handleAddRule} disabled={saving}>
            {saving && <Spinner size="sm" className="me-2" />}
            Add Recurring
          </Button>
        </ModalFooter>
      </Modal>

      {/* Confirm Modal */}
      <Modal isOpen={confirmModal} toggle={() => setConfirmModal(false)} centered>
        <ModalHeader toggle={() => setConfirmModal(false)}>
          Confirm — {selectedInstance?.recurring_rules?.name}
        </ModalHeader>
        <ModalBody>
          {error && <Alert color="danger">{error}</Alert>}
          {selectedInstance && (
            <div className="bg-light rounded p-3 mb-3">
              <div className="d-flex justify-content-between">
                <small className="text-muted">Due Date</small>
                <small className="fw-semibold">{new Date(selectedInstance.due_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' })}</small>
              </div>
              <div className="d-flex justify-content-between mt-1">
                <small className="text-muted">Default Amount</small>
                <small className="fw-semibold">{formatCurrency(selectedInstance.recurring_rules?.amount || 0)}</small>
              </div>
            </div>
          )}
          <Form>
            <FormGroup>
              <Label>Payment Date <span className="text-danger">*</span></Label>
              <Input type="date" value={confirmDate} onChange={e => setConfirmDate(e.target.value)} />
            </FormGroup>
            <FormGroup>
              <Label>Amount (PKR) <span className="text-danger">*</span></Label>
              <Input type="number" value={confirmAmount} onChange={e => setConfirmAmount(e.target.value)} />
              <small className="text-muted">You can adjust if amount changed this month</small>
            </FormGroup>
            <FormGroup>
              <Label>Account <span className="text-danger">*</span></Label>
              <Input type="select" value={confirmAccount} onChange={e => setConfirmAccount(e.target.value)}>
                <option value="">Select account...</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} — {formatCurrency(a.balance)}</option>)}
              </Input>
            </FormGroup>
            <FormGroup>
              <Label>Note</Label>
              <Input type="text" value={confirmNote} onChange={e => setConfirmNote(e.target.value)} />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="light" onClick={() => setConfirmModal(false)}>Cancel</Button>
          <Button color="success" onClick={handleConfirm} disabled={saving}>
            {saving && <Spinner size="sm" className="me-2" />}
            Confirm & Add Transaction
          </Button>
        </ModalFooter>
      </Modal>
    </React.Fragment>
  );
};

export default Recurring;
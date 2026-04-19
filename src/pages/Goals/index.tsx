import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, CardBody, CardHeader, Button, Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Input, Alert, Badge, Spinner, Progress } from 'reactstrap';
import * as Yup from 'yup';
import { useFormik } from 'formik';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/currency';
import BreadCrumb from '../../Components/Common/BreadCrumb';

interface Account { id: string; name: string; type: string; balance: number; }
interface Goal {
  id: string; name: string; target_amount: number; target_date: string;
  account_id: string; current_amount: number; status: string;
  accounts?: { name: string };
}

const Goals = () => {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [contributeModal, setContributeModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Contribution form
  const [contribAmount, setContribAmount] = useState('');
  const [contribAccount, setContribAccount] = useState('');
  const [contribDate, setContribDate] = useState(new Date().toISOString().split('T')[0]);
  const [contribNote, setContribNote] = useState('');

  document.title = 'Savings Goals | Finance Portal';

  const fetchData = async () => {
    setLoading(true);
    const { data: accData } = await supabase
      .from('accounts').select('id, name, type, balance')
      .eq('user_id', user?.id).eq('is_archived', false);

    const { data: goalData } = await supabase
      .from('goals').select('*, accounts!goals_account_id_fkey(name)')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });

    if (accData) setAccounts(accData);
    if (goalData) setGoals(goalData);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const goalForm = useFormik({
    initialValues: {
      name: '',
      target_amount: '',
      target_date: '',
      account_id: '',
    },
    validationSchema: Yup.object({
      name: Yup.string().required('Please enter goal name'),
      target_amount: Yup.number().positive().required('Please enter target amount'),
      account_id: Yup.string().required('Please select savings account'),
    }),
    onSubmit: async (values) => {
      setSaving(true);
      setError('');
      try {
        await supabase.from('goals').insert({
          user_id: user?.id,
          name: values.name,
          target_amount: Number(values.target_amount),
          target_date: values.target_date || null,
          account_id: values.account_id,
          current_amount: 0,
          status: 'active',
        });
        setModal(false);
        goalForm.resetForm();
        fetchData();
      } catch (err: any) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
    }
  });

  const openContributeModal = (goal: Goal) => {
    setSelectedGoal(goal);
    setContribAmount('');
    setContribAccount('');
    setContribDate(new Date().toISOString().split('T')[0]);
    setContribNote('');
    setError('');
    setContributeModal(true);
  };

  const handleDeleteGoal = async (goal: Goal) => {
  const confirmMsg = goal.current_amount > 0
    ? `Delete "${goal.name}"? Rs. ${goal.current_amount.toLocaleString()} has already been saved. The money remains in ${goal.accounts?.name} — only the goal tracker will be deleted.`
    : `Delete "${goal.name}"?`;

  if (!window.confirm(confirmMsg)) return;

  await supabase.from('goal_contributions').delete().eq('goal_id', goal.id);
  await supabase.from('goals').delete().eq('id', goal.id);
  fetchData();
};

  const handleContribute = async () => {
    if (!selectedGoal || !contribAmount || !contribAccount) {
      setError('Please fill all required fields');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const amount = Number(contribAmount);

      const { data: freshFrom } = await supabase
        .from('accounts').select('balance, name').eq('id', contribAccount).single();
      const { data: freshTo } = await supabase
        .from('accounts').select('balance').eq('id', selectedGoal.account_id).single();

      if (!freshFrom || freshFrom.balance < amount) {
        setError('Insufficient balance in selected account');
        setSaving(false);
        return;
      }

      // Create goal contribution transaction
      const { data: tx } = await supabase.from('transactions').insert({
        user_id: user?.id,
        date: new Date(contribDate).toISOString(),
        amount,
        type: 'goal_contribution',
        account_id: contribAccount,
        to_account_id: selectedGoal.account_id,
        goal_id: selectedGoal.id,
        category: 'Savings',
        note: contribNote || `${selectedGoal.name} contribution`,
      }).select().single();

      // Debit from account
      await supabase.from('accounts')
        .update({ balance: freshFrom.balance - amount })
        .eq('id', contribAccount);

      // Credit to savings account
      await supabase.from('accounts')
        .update({ balance: (freshTo?.balance || 0) + amount })
        .eq('id', selectedGoal.account_id);

      // Create goal contribution record
      await supabase.from('goal_contributions').insert({
        goal_id: selectedGoal.id,
        user_id: user?.id,
        amount,
        date: contribDate,
        transaction_id: tx?.id || null,
      });

      // Update goal current amount and status
      const newAmount = selectedGoal.current_amount + amount;
      const newStatus = newAmount >= selectedGoal.target_amount ? 'achieved' : 'active';
      await supabase.from('goals').update({
        current_amount: newAmount,
        status: newStatus,
      }).eq('id', selectedGoal.id);

      setContributeModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getDaysUntil = (dateStr: string) => {
    if (!dateStr) return null;
    const days = Math.ceil((new Date(dateStr).getTime() - new Date().setHours(0,0,0,0)) / 86400000);
    return days;
  };

  const getMonthlyNeeded = (goal: Goal) => {
    if (!goal.target_date) return null;
    const days = getDaysUntil(goal.target_date);
    if (!days || days <= 0) return null;
    const months = Math.ceil(days / 30);
    const remaining = goal.target_amount - goal.current_amount;
    return remaining / months;
  };

  const activeGoals = goals.filter(g => g.status === 'active');
  const achievedGoals = goals.filter(g => g.status === 'achieved');
  const totalSaved = goals.reduce((s, g) => s + Number(g.current_amount), 0);
  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0);

  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>
          <BreadCrumb title="Savings Goals" pageTitle="Finance Portal" />

          <Row className="mb-4">
            <Col md={3}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1">Total Saved</p>
                      <h4 className="text-success">{formatCurrency(totalSaved)}</h4>
                    </div>
                    <div className="avatar-sm"><span className="avatar-title bg-success-subtle rounded-circle fs-3"><i className="ri-safe-line text-success"></i></span></div>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1">Total Target</p>
                      <h4 className="text-primary">{formatCurrency(totalTarget)}</h4>
                    </div>
                    <div className="avatar-sm"><span className="avatar-title bg-primary-subtle rounded-circle fs-3"><i className="ri-target-line text-primary"></i></span></div>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1">Goals Achieved</p>
                      <h4 className="text-success">{achievedGoals.length}</h4>
                      <small className="text-muted">{activeGoals.length} in progress</small>
                    </div>
                    <div className="avatar-sm"><span className="avatar-title bg-warning-subtle rounded-circle fs-3"><i className="ri-trophy-line text-warning"></i></span></div>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col md={3} className="d-flex align-items-center">
              <Button color="success" className="w-100" onClick={() => setModal(true)}>
                <i className="ri-add-line me-2"></i> New Goal
              </Button>
            </Col>
          </Row>

          {loading ? (
            <div className="text-center py-5"><Spinner color="primary" /></div>
          ) : goals.length === 0 ? (
            <Card>
              <CardBody className="text-center py-5">
                <i className="ri-target-line fs-1 text-muted"></i>
                <p className="text-muted mt-2">No savings goals yet. Create your first goal!</p>
                <Button color="success" onClick={() => setModal(true)}>Create Goal</Button>
              </CardBody>
            </Card>
          ) : (
            <Row>
              {goals.map(goal => {
                const pct = goal.target_amount > 0
                  ? Math.min(100, (goal.current_amount / goal.target_amount) * 100)
                  : 0;
                const remaining = goal.target_amount - goal.current_amount;
                const daysLeft = goal.target_date ? getDaysUntil(goal.target_date) : null;
                const monthlyNeeded = getMonthlyNeeded(goal);

                return (
                  <Col md={6} xl={4} key={goal.id} className="mb-4">
                    <Card className="border h-100">
                      <CardBody>
                        <div className="d-flex justify-content-between align-items-start mb-3">
  <div>
    <h6 className="mb-0">{goal.name}</h6>
    {goal.accounts && (
      <small className="text-muted">
        <i className="ri-bank-line me-1"></i>{goal.accounts.name}
      </small>
    )}
  </div>
  <div className="d-flex align-items-center gap-2">
    <Button
      color="soft-danger"
      size="sm"
      onClick={() => handleDeleteGoal(goal)}
      title="Delete goal"
    >
      <i className="ri-delete-bin-line"></i>
    </Button>
    <Badge
      color={goal.status === 'achieved' ? 'success' : pct >= 75 ? 'warning' : 'primary'}
      pill
    >
      {goal.status === 'achieved' ? '🏆 Achieved!' : `${pct.toFixed(0)}%`}
    </Badge>
  </div>
</div>

                        <div className="mb-3">
                          <div className="d-flex justify-content-between mb-1">
                            <small className="text-muted">Saved</small>
                            <small className="fw-semibold text-success">{formatCurrency(goal.current_amount)}</small>
                          </div>
                          <div className="d-flex justify-content-between mb-1">
                            <small className="text-muted">Target</small>
                            <small className="fw-semibold">{formatCurrency(goal.target_amount)}</small>
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <small className="text-muted">Remaining</small>
                            <small className={`fw-semibold ${remaining > 0 ? 'text-danger' : 'text-success'}`}>
                              {remaining > 0 ? formatCurrency(remaining) : 'Goal Achieved! 🎉'}
                            </small>
                          </div>
                          <Progress
                            value={pct}
                            color={pct >= 100 ? 'success' : pct >= 75 ? 'warning' : 'primary'}
                            style={{ height: 10 }}
                            className="mb-1"
                          />
                        </div>

                        {goal.target_date && (
                          <div className="mb-3 p-2 bg-light rounded">
                            <div className="d-flex justify-content-between">
                              <small className="text-muted">Target Date</small>
                              <small className="fw-semibold">
                                {new Date(goal.target_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </small>
                            </div>
                            {daysLeft !== null && daysLeft > 0 && (
                              <div className="d-flex justify-content-between mt-1">
                                <small className="text-muted">Days left</small>
                                <small className={`fw-semibold ${daysLeft < 30 ? 'text-danger' : 'text-info'}`}>{daysLeft} days</small>
                              </div>
                            )}
                            {monthlyNeeded && monthlyNeeded > 0 && (
                              <div className="d-flex justify-content-between mt-1">
                                <small className="text-muted">Need per month</small>
                                <small className="fw-semibold text-warning">{formatCurrency(monthlyNeeded)}/month</small>
                              </div>
                            )}
                          </div>
                        )}

                        {goal.status !== 'achieved' && (
                          <Button color="success" size="sm" className="w-100" onClick={() => openContributeModal(goal)}>
                            <i className="ri-add-line me-1"></i> Add Contribution
                          </Button>
                        )}
                      </CardBody>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          )}
        </Container>
      </div>

      {/* New Goal Modal */}
      <Modal isOpen={modal} toggle={() => { setModal(false); goalForm.resetForm(); }} centered>
        <ModalHeader toggle={() => { setModal(false); goalForm.resetForm(); }}>Create Savings Goal</ModalHeader>
        <ModalBody>
          {error && <Alert color="danger">{error}</Alert>}
          <Form>
            <FormGroup>
              <Label>Goal Name <span className="text-danger">*</span></Label>
              <Input
                name="name"
                placeholder="e.g. Europe Trip 2026, Emergency Fund, New Car..."
                value={goalForm.values.name}
                onChange={goalForm.handleChange} onBlur={goalForm.handleBlur}
                invalid={goalForm.touched.name && !!goalForm.errors.name}
              />
            </FormGroup>
            <Row>
              <Col md={6}>
                <FormGroup>
                  <Label>Target Amount (PKR) <span className="text-danger">*</span></Label>
                  <Input
                    type="number" name="target_amount" placeholder="0.00"
                    value={goalForm.values.target_amount}
                    onChange={goalForm.handleChange} onBlur={goalForm.handleBlur}
                    invalid={goalForm.touched.target_amount && !!goalForm.errors.target_amount}
                  />
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup>
                  <Label>Target Date</Label>
                  <Input
                    type="date" name="target_date"
                    value={goalForm.values.target_date}
                    onChange={goalForm.handleChange}
                  />
                  <small className="text-muted">Optional</small>
                </FormGroup>
              </Col>
            </Row>
            <FormGroup>
              <Label>Savings Account (where money goes) <span className="text-danger">*</span></Label>
              <Input
                type="select" name="account_id"
                value={goalForm.values.account_id}
                onChange={goalForm.handleChange} onBlur={goalForm.handleBlur}
                invalid={goalForm.touched.account_id && !!goalForm.errors.account_id}
              >
                <option value="">Select dedicated savings account...</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} — {formatCurrency(a.balance)}</option>)}
              </Input>
              <small className="text-muted">This is where your saved money will be transferred to</small>
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="light" onClick={() => { setModal(false); goalForm.resetForm(); }}>Cancel</Button>
          <Button color="success" onClick={() => goalForm.handleSubmit()} disabled={saving}>
            {saving && <Spinner size="sm" className="me-2" />}
            Create Goal
          </Button>
        </ModalFooter>
      </Modal>

      {/* Contribute Modal */}
      <Modal isOpen={contributeModal} toggle={() => setContributeModal(false)} centered>
        <ModalHeader toggle={() => setContributeModal(false)}>
          Add Contribution — {selectedGoal?.name}
        </ModalHeader>
        <ModalBody>
          {error && <Alert color="danger">{error}</Alert>}
          {selectedGoal && (
            <div className="bg-light rounded p-3 mb-3">
              <div className="d-flex justify-content-between">
                <small className="text-muted">Goal Target</small>
                <small className="fw-semibold">{formatCurrency(selectedGoal.target_amount)}</small>
              </div>
              <div className="d-flex justify-content-between mt-1">
                <small className="text-muted">Saved so far</small>
                <small className="fw-semibold text-success">{formatCurrency(selectedGoal.current_amount)}</small>
              </div>
              <div className="d-flex justify-content-between mt-1">
                <small className="text-muted">Remaining</small>
                <small className="fw-semibold text-danger">{formatCurrency(selectedGoal.target_amount - selectedGoal.current_amount)}</small>
              </div>
              <div className="d-flex justify-content-between mt-1 pt-1 border-top">
                <small className="text-muted">Transfers to</small>
                <small className="fw-semibold text-primary">
                  <i className="ri-arrow-right-line me-1"></i>{selectedGoal.accounts?.name}
                </small>
              </div>
            </div>
          )}
          <Form>
            <FormGroup>
              <Label>Date <span className="text-danger">*</span></Label>
              <Input type="date" value={contribDate} onChange={e => setContribDate(e.target.value)} />
            </FormGroup>
            <FormGroup>
              <Label>Amount (PKR) <span className="text-danger">*</span></Label>
              <Input
                type="number" value={contribAmount}
                onChange={e => setContribAmount(e.target.value)}
                placeholder="Amount to contribute"
              />
            </FormGroup>
            <FormGroup>
              <Label>Transfer From <span className="text-danger">*</span></Label>
              <Input type="select" value={contribAccount} onChange={e => setContribAccount(e.target.value)}>
                <option value="">Select account to transfer from...</option>
                {accounts
                  .filter(a => a.id !== selectedGoal?.account_id)
                  .map(a => <option key={a.id} value={a.id}>{a.name} — {formatCurrency(a.balance)}</option>)}
              </Input>
              {selectedGoal && (
                <small className="text-muted">
                  → Money will transfer to: <strong>{selectedGoal.accounts?.name}</strong>
                </small>
              )}
            </FormGroup>
            <FormGroup>
              <Label>Note</Label>
              <Input
                type="text" value={contribNote}
                onChange={e => setContribNote(e.target.value)}
                placeholder="Optional note"
              />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="light" onClick={() => setContributeModal(false)}>Cancel</Button>
          <Button color="success" onClick={handleContribute} disabled={saving}>
            {saving && <Spinner size="sm" className="me-2" />}
            Transfer & Save
          </Button>
        </ModalFooter>
      </Modal>
    </React.Fragment>
  );
};

export default Goals;
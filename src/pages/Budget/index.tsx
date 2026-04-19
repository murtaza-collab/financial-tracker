import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, CardBody, CardHeader, Button, Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Input, Alert, Badge, Spinner, Progress, Table } from 'reactstrap';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/currency';
import BreadCrumb from '../../Components/Common/BreadCrumb';

interface BudgetRule {
  id: string; category: string; monthly_limit: number; month: string;
}
interface SpendData { category: string; spent: number; }

const CATEGORIES = [
  'Grocery', 'Restaurant & Food', 'Fuel', 'Utility Bills',
  'Mobile & Internet', 'Medical', 'Transport', 'Shopping',
  'Education', 'Rent', 'Family', 'Entertainment', 'Travel',
  'Office Expense', 'Other',
];

const getMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const getMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-');
  return new Date(Number(year), Number(month) - 1).toLocaleDateString('en-PK', { month: 'long', year: 'numeric' });
};

const Budget = () => {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<BudgetRule[]>([]);
  const [spending, setSpending] = useState<SpendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey(new Date()));
  const [editBudget, setEditBudget] = useState<BudgetRule | null>(null);
  const [category, setCategory] = useState('');
  const [limit, setLimit] = useState('');

  document.title = 'Budget | Finance Portal';

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    return getMonthKey(d);
  });

  const fetchData = async () => {
    setLoading(true);

    const { data: budgetData } = await supabase
      .from('budget_rules').select('*')
      .eq('user_id', user?.id)
      .eq('month', selectedMonth)
      .order('category');

    // Fetch spending for selected month
    const startOfMonth = new Date(selectedMonth + '-01');
    const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0, 23, 59, 59);

    const { data: txData } = await supabase
      .from('transactions')
      .select('category, amount, type')
      .eq('user_id', user?.id)
      .eq('type', 'expense')
      .gte('date', startOfMonth.toISOString())
      .lte('date', endOfMonth.toISOString());

    if (budgetData) setBudgets(budgetData);

    if (txData) {
      const spendMap: Record<string, number> = {};
      txData.forEach(tx => {
        const cat = tx.category || 'Other';
        spendMap[cat] = (spendMap[cat] || 0) + Number(tx.amount);
      });
      setSpending(Object.entries(spendMap).map(([category, spent]) => ({ category, spent })));
    }

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [selectedMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  const openModal = (budget?: BudgetRule) => {
    setEditBudget(budget || null);
    setCategory(budget?.category || '');
    setLimit(budget?.monthly_limit ? String(budget.monthly_limit) : '');
    setError('');
    setModal(true);
  };

  const handleSave = async () => {
    if (!category || !limit) { setError('Please fill all fields'); return; }
    setSaving(true);
    setError('');
    try {
      if (editBudget) {
        await supabase.from('budget_rules')
          .update({ monthly_limit: Number(limit) })
          .eq('id', editBudget.id);
      } else {
        // Check if already exists
        const { data: existing } = await supabase
          .from('budget_rules').select('id')
          .eq('user_id', user?.id)
          .eq('category', category)
          .eq('month', selectedMonth)
          .single();

        if (existing) {
          await supabase.from('budget_rules')
            .update({ monthly_limit: Number(limit) })
            .eq('id', existing.id);
        } else {
          await supabase.from('budget_rules').insert({
            user_id: user?.id,
            category,
            monthly_limit: Number(limit),
            month: selectedMonth,
          });
        }
      }
      setModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('budget_rules').delete().eq('id', id);
    fetchData();
  };

  // Copy budgets from previous month
  const copyFromLastMonth = async () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevMonth = getMonthKey(prevDate);

    const { data: prevBudgets } = await supabase
      .from('budget_rules').select('*')
      .eq('user_id', user?.id)
      .eq('month', prevMonth);

    if (!prevBudgets || prevBudgets.length === 0) {
      alert('No budgets found for previous month');
      return;
    }

    for (const b of prevBudgets) {
      const { data: existing } = await supabase
        .from('budget_rules').select('id')
        .eq('user_id', user?.id)
        .eq('category', b.category)
        .eq('month', selectedMonth)
        .single();

      if (!existing) {
        await supabase.from('budget_rules').insert({
          user_id: user?.id,
          category: b.category,
          monthly_limit: b.monthly_limit,
          month: selectedMonth,
        });
      }
    }
    fetchData();
  };

  // Merge budgets with spending
  const allCategories = Array.from(new Set([
    ...budgets.map(b => b.category),
    ...spending.map(s => s.category),
  ]));

  const mergedData = allCategories.map(cat => {
    const budget = budgets.find(b => b.category === cat);
    const spend = spending.find(s => s.category === cat);
    const spent = spend?.spent || 0;
    const limit = budget?.monthly_limit || 0;
    const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
    const remaining = limit - spent;
    return { category: cat, budget, spent, limit, pct, remaining };
  }).sort((a, b) => b.spent - a.spent);

  const totalBudgeted = budgets.reduce((s, b) => s + Number(b.monthly_limit), 0);
  const totalSpent = spending.reduce((s, sp) => s + sp.spent, 0);
  const unbudgetedSpend = spending
    .filter(s => !budgets.find(b => b.category === s.category))
    .reduce((s, sp) => s + sp.spent, 0);

  const getBarColor = (pct: number) => {
    if (pct >= 100) return 'danger';
    if (pct >= 80) return 'warning';
    return 'success';
  };

  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>
          <BreadCrumb title="Budget" pageTitle="Finance Portal" />

          {/* Month Selector */}
          <Card className="mb-4">
            <CardBody className="py-2">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div className="d-flex gap-2 flex-wrap">
                  {months.map(m => (
                    <Button key={m} size="sm" color={selectedMonth === m ? 'success' : 'light'} onClick={() => setSelectedMonth(m)}>
                      {getMonthLabel(m)}
                    </Button>
                  ))}
                </div>
                <div className="d-flex gap-2">
                  <Button color="soft-secondary" size="sm" onClick={copyFromLastMonth}>
                    <i className="ri-file-copy-line me-1"></i> Copy Last Month
                  </Button>
                  <Button color="success" size="sm" onClick={() => openModal()}>
                    <i className="ri-add-line me-1"></i> Add Budget
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Summary */}
          <Row className="mb-4">
            <Col md={3}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1">Total Budgeted</p>
                      <h4 className="text-primary">{formatCurrency(totalBudgeted)}</h4>
                    </div>
                    <div className="avatar-sm"><span className="avatar-title bg-primary-subtle rounded-circle fs-3"><i className="ri-pie-chart-line text-primary"></i></span></div>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1">Total Spent</p>
                      <h4 className={totalSpent > totalBudgeted ? 'text-danger' : 'text-warning'}>{formatCurrency(totalSpent)}</h4>
                    </div>
                    <div className="avatar-sm"><span className="avatar-title bg-warning-subtle rounded-circle fs-3"><i className="ri-shopping-bag-line text-warning"></i></span></div>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1">Remaining Budget</p>
                      <h4 className={totalBudgeted - totalSpent < 0 ? 'text-danger' : 'text-success'}>
                        {formatCurrency(totalBudgeted - totalSpent)}
                      </h4>
                    </div>
                    <div className="avatar-sm"><span className="avatar-title bg-success-subtle rounded-circle fs-3"><i className="ri-wallet-line text-success"></i></span></div>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1">Unbudgeted Spend</p>
                      <h4 className={unbudgetedSpend > 0 ? 'text-danger' : 'text-success'}>{formatCurrency(unbudgetedSpend)}</h4>
                      <small className="text-muted">Categories with no budget</small>
                    </div>
                    <div className="avatar-sm"><span className="avatar-title bg-danger-subtle rounded-circle fs-3"><i className="ri-error-warning-line text-danger"></i></span></div>
                  </div>
                </CardBody>
              </Card>
            </Col>
          </Row>

          {/* Overall Progress */}
          {totalBudgeted > 0 && (
            <Card className="mb-4">
              <CardBody>
                <div className="d-flex justify-content-between mb-2">
                  <span className="fw-semibold">Overall Budget Usage</span>
                  <span className="text-muted">{formatCurrency(totalSpent)} / {formatCurrency(totalBudgeted)}</span>
                </div>
                <Progress
                  value={totalBudgeted > 0 ? Math.min(100, (totalSpent / totalBudgeted) * 100) : 0}
                  color={getBarColor(totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0)}
                  style={{ height: 12 }}
                />
              </CardBody>
            </Card>
          )}

          {/* Category Budgets */}
          <Card>
            <CardHeader>
              <h5 className="mb-0">Category Breakdown — {getMonthLabel(selectedMonth)}</h5>
            </CardHeader>
            <CardBody>
              {loading ? (
                <div className="text-center py-5"><Spinner color="primary" /></div>
              ) : mergedData.length === 0 ? (
                <div className="text-center py-5">
                  <i className="ri-pie-chart-line fs-1 text-muted"></i>
                  <p className="text-muted mt-2">No budgets or spending yet for this month.</p>
                  <Button color="success" onClick={() => openModal()}>Add First Budget</Button>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table className="table-hover mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Category</th>
                        <th>Budget</th>
                        <th>Spent</th>
                        <th>Remaining</th>
                        <th style={{ width: 200 }}>Progress</th>
                        <th className="text-center">Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {mergedData.map(row => (
                        <tr key={row.category}>
                          <td className="fw-semibold">{row.category}</td>
                          <td>
                            {row.limit > 0
                              ? formatCurrency(row.limit)
                              : <span className="text-muted fs-12">No budget set</span>
                            }
                          </td>
                          <td className={row.spent > 0 ? 'text-danger fw-semibold' : 'text-muted'}>
                            {formatCurrency(row.spent)}
                          </td>
                          <td>
                            {row.limit > 0 ? (
                              <span className={row.remaining < 0 ? 'text-danger fw-semibold' : 'text-success'}>
                                {row.remaining < 0 ? `-${formatCurrency(Math.abs(row.remaining))}` : formatCurrency(row.remaining)}
                              </span>
                            ) : '—'}
                          </td>
                          <td>
                            {row.limit > 0 ? (
                              <div>
                                <Progress value={row.pct} color={getBarColor(row.pct)} style={{ height: 8 }} className="mb-1" />
                                <small className="text-muted">{row.pct.toFixed(0)}%</small>
                              </div>
                            ) : (
                              <small className="text-muted">—</small>
                            )}
                          </td>
                          <td className="text-center">
                            {row.limit === 0 ? (
                              <Badge color="secondary" pill>No Budget</Badge>
                            ) : row.pct >= 100 ? (
                              <Badge color="danger" pill>Over Budget</Badge>
                            ) : row.pct >= 80 ? (
                              <Badge color="warning" pill>80%+ Used</Badge>
                            ) : (
                              <Badge color="success" pill>On Track</Badge>
                            )}
                          </td>
                          <td>
                            <div className="d-flex gap-1">
                              <Button color="soft-primary" size="sm"
                                onClick={() => row.budget ? openModal(row.budget) : openModal()}>
                                <i className="ri-edit-line"></i>
                              </Button>
                              {row.budget && (
                                <Button color="soft-danger" size="sm" onClick={() => handleDelete(row.budget!.id)}>
                                  <i className="ri-delete-bin-line"></i>
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </CardBody>
          </Card>
        </Container>
      </div>

      {/* Add/Edit Budget Modal */}
      <Modal isOpen={modal} toggle={() => setModal(false)} centered>
        <ModalHeader toggle={() => setModal(false)}>
          {editBudget ? 'Edit Budget' : 'Add Budget'}
        </ModalHeader>
        <ModalBody>
          {error && <Alert color="danger">{error}</Alert>}
          <Form>
            <FormGroup>
              <Label>Category <span className="text-danger">*</span></Label>
              <Input
                type="select" value={category}
                onChange={e => setCategory(e.target.value)}
                disabled={!!editBudget}
              >
                <option value="">Select category...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </Input>
            </FormGroup>
            <FormGroup>
              <Label>Monthly Limit (PKR) <span className="text-danger">*</span></Label>
              <Input
                type="number" value={limit}
                onChange={e => setLimit(e.target.value)}
                placeholder="e.g. 15000"
              />
            </FormGroup>
            <small className="text-muted">Setting budget for: <strong>{getMonthLabel(selectedMonth)}</strong></small>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="light" onClick={() => setModal(false)}>Cancel</Button>
          <Button color="success" onClick={handleSave} disabled={saving}>
            {saving && <Spinner size="sm" className="me-2" />}
            {editBudget ? 'Update Budget' : 'Set Budget'}
          </Button>
        </ModalFooter>
      </Modal>
    </React.Fragment>
  );
};

export default Budget;
import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, CardBody, CardHeader, Button, Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Input, Alert, Badge, Spinner, Table, Nav, NavItem, NavLink, Progress } from 'reactstrap';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/currency';
import BreadCrumb from '../../Components/Common/BreadCrumb';

interface Person { id: string; name: string; phone: string; notes: string; }
interface Outing {
  id: string; place_name: string; date: string; total_amount: number;
  total_people: number; your_share: number; paid_by: string; notes: string;
  transaction_id: string;
  outing_participants: { person_id: string; share_amount: number; split_people: { name: string } }[];
}
interface Settlement {
  id: string; person_id: string; amount: number; date: string; notes: string;
  accounts?: { name: string };
}

const Splits = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('people');
  const [people, setPeople] = useState<Person[]>([]);
  const [outings, setOutings] = useState<Outing[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  // Modals
  const [personModal, setPersonModal] = useState(false);
  const [settlementModal, setSettlementModal] = useState(false);
  const [editPerson, setEditPerson] = useState<Person | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Person form
  const [personName, setPersonName] = useState('');
  const [personPhone, setPersonPhone] = useState('');
  const [personNotes, setPersonNotes] = useState('');

  // Settlement form
  const [settleAmount, setSettleAmount] = useState('');
  const [settleAccount, setSettleAccount] = useState('');
  const [settleDate, setSettleDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [settleNote, setSettleNote] = useState('');

  document.title = 'Splits & Recoveries | Finance Portal';

  const fetchData = async () => {
    setLoading(true);
    const [{ data: peopleData }, { data: outingData }, { data: settlementData }, { data: accData }] = await Promise.all([
      supabase.from('split_people').select('*').eq('user_id', user?.id).order('name'),
      supabase.from('outings').select('*, outing_participants(person_id, share_amount, split_people(name))').eq('user_id', user?.id).order('date', { ascending: false }),
      supabase.from('settlements').select('*, accounts!settlements_account_id_fkey(name)').eq('user_id', user?.id).order('date', { ascending: false }),
      supabase.from('accounts').select('id, name, balance, type').eq('user_id', user?.id).eq('is_archived', false).order('name', { ascending: true }),
    ]);
    if (peopleData) setPeople(peopleData);
    if (outingData) setOutings(outingData);
    if (settlementData) setSettlements(settlementData);
    if (accData) setAccounts(accData);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Person CRUD
  const openPersonModal = (person?: Person) => {
    setEditPerson(person || null);
    setPersonName(person?.name || '');
    setPersonPhone(person?.phone || '');
    setPersonNotes(person?.notes || '');
    setError('');
    setPersonModal(true);
  };

  const handleSavePerson = async () => {
    if (!personName) { setError('Please enter a name'); return; }
    setSaving(true);
    try {
      if (editPerson) {
        await supabase.from('split_people').update({ name: personName, phone: personPhone, notes: personNotes }).eq('id', editPerson.id);
      } else {
        await supabase.from('split_people').insert({ user_id: user?.id, name: personName, phone: personPhone, notes: personNotes });
      }
      setPersonModal(false);
      fetchData();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleDeletePerson = async (id: string) => {
    if (window.confirm('Delete this person? Their outing history will be kept.')) {
      await supabase.from('split_people').delete().eq('id', id);
      fetchData();
    }
  };

  // Per-person calculations
  const getPersonTab = (personId: string) => {
    const personOutings = outings.filter(o =>
      o.outing_participants.some(p => p.person_id === personId)
    );
    const totalOwed = personOutings.reduce((sum, o) => {
      const participant = o.outing_participants.find(p => p.person_id === personId);
      return sum + (participant?.share_amount || 0);
    }, 0);
    const totalSettled = settlements
      .filter(s => s.person_id === personId)
      .reduce((sum, s) => sum + Number(s.amount), 0);
    const balance = totalOwed - totalSettled;
    return { personOutings, totalOwed, totalSettled, balance };
  };

  // Settlement
  const openSettlementModal = (person: Person) => {
    setSelectedPerson(person);
    const { balance } = getPersonTab(person.id);
    setSettleAmount(String(balance > 0 ? balance.toFixed(2) : ''));
    setSettleAccount('');
    setSettleDate(new Date().toLocaleDateString('en-CA'));
    setSettleNote('');
    setError('');
    setSettlementModal(true);
  };

  const handleSettle = async () => {
    if (!selectedPerson || !settleAmount || !settleAccount) {
      setError('Please fill all required fields');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const amount = Number(settleAmount);
      const acc = accounts.find(a => a.id === settleAccount);

      // Create transaction
      await supabase.from('transactions').insert({
        user_id: user?.id,
        date: new Date(settleDate).toISOString(),
        amount,
        type: 'reimbursement_received',
        account_id: settleAccount,
        category: 'Reimbursement',
        note: settleNote || `Settlement from ${selectedPerson.name}`,
      });

      // Update account balance
      if (acc) {
        await supabase.from('accounts').update({ balance: acc.balance + amount }).eq('id', settleAccount);
      }

      // Create settlement record
      await supabase.from('settlements').insert({
        user_id: user?.id,
        person_id: selectedPerson.id,
        amount,
        date: settleDate,
        account_id: settleAccount,
        notes: settleNote || null,
      });

      setSettlementModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Generate summary text (WhatsApp ready)
  const generateSummary = (person: Person) => {
    const { personOutings, totalOwed, totalSettled, balance } = getPersonTab(person.id);
    let text = `*${person.name} - Outstanding Balance*\n\n`;
    personOutings.forEach(o => {
      const participant = o.outing_participants.find(p => p.person_id === person.id);
      const share = participant?.share_amount || 0;
      text += `${o.place_name} - ${formatCurrency(o.total_amount)}/${o.total_people} = ${formatCurrency(share)}\n`;
    });
    text += `\n*Total: ${formatCurrency(totalOwed)}*`;
    if (totalSettled > 0) text += `\nPaid: ${formatCurrency(totalSettled)}`;
    text += `\n*Balance: ${formatCurrency(balance)}*`;
    navigator.clipboard.writeText(text);
    alert('Summary copied to clipboard! Paste in WhatsApp.');
  };

  const totalPendingAll = people.reduce((sum, p) => {
    const { balance } = getPersonTab(p.id);
    return sum + (balance > 0 ? balance : 0);
  }, 0);

  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>
          <BreadCrumb title="Splits & Recoveries" pageTitle="Finance Portal" />

          {/* Summary */}
          <Row className="mb-4">
            <Col md={4}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1">Total Pending Recovery</p>
                      <h4 className="text-warning">{formatCurrency(totalPendingAll)}</h4>
                      <small className="text-muted">Across all people</small>
                    </div>
                    <div className="avatar-sm"><span className="avatar-title bg-warning-subtle rounded-circle fs-3"><i className="ri-group-line text-warning"></i></span></div>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1">Total Outings</p>
                      <h4>{outings.length}</h4>
                    </div>
                    <div className="avatar-sm"><span className="avatar-title bg-info-subtle rounded-circle fs-3"><i className="ri-restaurant-line text-info"></i></span></div>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1">People</p>
                      <h4>{people.length}</h4>
                    </div>
                    <div className="avatar-sm"><span className="avatar-title bg-success-subtle rounded-circle fs-3"><i className="ri-user-line text-success"></i></span></div>
                  </div>
                </CardBody>
              </Card>
            </Col>
          </Row>

          <Card>
            <CardHeader>
              <Nav tabs className="card-header-tabs">
                <NavItem>
                  <NavLink active={activeTab === 'people'} onClick={() => setActiveTab('people')} style={{ cursor: 'pointer' }}>
                    People & Balances
                  </NavLink>
                </NavItem>
                <NavItem>
                  <NavLink active={activeTab === 'outings'} onClick={() => setActiveTab('outings')} style={{ cursor: 'pointer' }}>
                    All Outings
                  </NavLink>
                </NavItem>
              </Nav>
            </CardHeader>
            <CardBody>
              {loading ? (
                <div className="text-center py-5"><Spinner color="primary" /></div>
              ) : activeTab === 'people' ? (
                <>
                  <div className="d-flex justify-content-end mb-3">
                    <Button color="success" size="sm" onClick={() => openPersonModal()}>
                      <i className="ri-user-add-line me-1"></i> Add Person
                    </Button>
                  </div>
                  {people.length === 0 ? (
                    <div className="text-center py-5">
                      <i className="ri-group-line fs-1 text-muted"></i>
                      <p className="text-muted mt-2">No people added yet. Add your contacts to start splitting.</p>
                    </div>
                  ) : (
                    <Row>
                      {people.map(person => {
                        const { personOutings, totalOwed, totalSettled, balance } = getPersonTab(person.id);
                        const pct = totalOwed > 0 ? Math.min(100, (totalSettled / totalOwed) * 100) : 100;
                        return (
                          <Col md={6} xl={4} key={person.id} className="mb-3">
                            <Card className="border h-100">
                              <CardBody>
                                <div className="d-flex justify-content-between align-items-start mb-3">
                                  <div className="d-flex align-items-center gap-2">
                                    <div className="avatar-sm">
                                      <span className="avatar-title bg-primary-subtle rounded-circle fs-4 fw-bold text-primary">
                                        {person.name.charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                    <div>
                                      <h6 className="mb-0">{person.name}</h6>
                                      {person.phone && <small className="text-muted">{person.phone}</small>}
                                    </div>
                                  </div>
                                  <div className="d-flex gap-1">
                                    <Button color="soft-primary" size="sm" onClick={() => openPersonModal(person)}>
                                      <i className="ri-edit-line"></i>
                                    </Button>
                                    <Button color="soft-danger" size="sm" onClick={() => handleDeletePerson(person.id)}>
                                      <i className="ri-delete-bin-line"></i>
                                    </Button>
                                  </div>
                                </div>

                                <div className="mb-2">
                                  <div className="d-flex justify-content-between mb-1">
                                    <small className="text-muted">Total Owed</small>
                                    <small className="fw-semibold">{formatCurrency(totalOwed)}</small>
                                  </div>
                                  <div className="d-flex justify-content-between mb-1">
                                    <small className="text-muted">Settled</small>
                                    <small className="fw-semibold text-success">{formatCurrency(totalSettled)}</small>
                                  </div>
                                  <div className="d-flex justify-content-between mb-2">
                                    <small className="text-muted">Balance</small>
                                    <small className={`fw-semibold ${balance > 0 ? 'text-danger' : 'text-success'}`}>
                                      {balance > 0 ? formatCurrency(balance) : 'Settled ✓'}
                                    </small>
                                  </div>
                                  <Progress value={pct} color={pct >= 100 ? 'success' : pct > 50 ? 'warning' : 'danger'} style={{ height: 6 }} />
                                  <small className="text-muted">{personOutings.length} outings</small>
                                </div>

                                <div className="d-flex gap-2 mt-3">
                                  {balance > 0 && (
                                    <Button color="success" size="sm" className="flex-grow-1" onClick={() => openSettlementModal(person)}>
                                      <i className="ri-money-dollar-circle-line me-1"></i> Settle
                                    </Button>
                                  )}
                                  <Button color="soft-info" size="sm" className="flex-grow-1" onClick={() => generateSummary(person)}>
                                    <i className="ri-whatsapp-line me-1"></i> Copy Summary
                                  </Button>
                                </div>
                              </CardBody>
                            </Card>
                          </Col>
                        );
                      })}
                    </Row>
                  )}
                </>
              ) : (
                // Outings tab
                outings.length === 0 ? (
                  <div className="text-center py-5">
                    <i className="ri-restaurant-line fs-1 text-muted"></i>
                    <p className="text-muted mt-2">No outings yet. Add a split expense from the Transactions page.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <Table className="table-hover mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Date</th>
                          <th>Place</th>
                          <th>People</th>
                          <th className="text-end">Total</th>
                          <th className="text-end">Your Share</th>
                          <th className="text-end">To Recover</th>
                        </tr>
                      </thead>
                      <tbody>
                        {outings.map(outing => (
                          <tr key={outing.id}>
                            <td>{new Date(outing.date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                            <td className="fw-semibold">{outing.place_name}</td>
                            <td>
                              <div className="d-flex flex-wrap gap-1">
                                {outing.outing_participants.map((p, i) => (
                                  <Badge key={i} color="soft-primary" className="text-primary fs-11">{p.split_people?.name}</Badge>
                                ))}
                                <Badge color="soft-success" className="text-success fs-11">You</Badge>
                              </div>
                            </td>
                            <td className="text-end">{formatCurrency(outing.total_amount)}</td>
                            <td className="text-end text-muted">{formatCurrency(outing.your_share)}</td>
                            <td className="text-end text-warning fw-semibold">
                              {formatCurrency(outing.total_amount - outing.your_share)}
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

      {/* Person Modal */}
      <Modal isOpen={personModal} toggle={() => setPersonModal(false)} centered>
        <ModalHeader toggle={() => setPersonModal(false)}>
          {editPerson ? 'Edit Person' : 'Add Person'}
        </ModalHeader>
        <ModalBody>
          {error && <Alert color="danger">{error}</Alert>}
          <Form>
            <FormGroup>
              <Label>Name <span className="text-danger">*</span></Label>
              <Input value={personName} onChange={e => setPersonName(e.target.value)} placeholder="e.g. Amir, Saud, Hozaifa" />
            </FormGroup>
            <FormGroup>
              <Label>Phone (optional)</Label>
              <Input value={personPhone} onChange={e => setPersonPhone(e.target.value)} placeholder="03XX-XXXXXXX" />
            </FormGroup>
            <FormGroup>
              <Label>Notes (optional)</Label>
              <Input value={personNotes} onChange={e => setPersonNotes(e.target.value)} placeholder="e.g. Office colleague" />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="light" onClick={() => setPersonModal(false)}>Cancel</Button>
          <Button color="success" onClick={handleSavePerson} disabled={saving}>
            {saving && <Spinner size="sm" className="me-2" />}
            {editPerson ? 'Save Changes' : 'Add Person'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Settlement Modal */}
      <Modal isOpen={settlementModal} toggle={() => setSettlementModal(false)} centered>
        <ModalHeader toggle={() => setSettlementModal(false)}>
          Log Settlement — {selectedPerson?.name}
        </ModalHeader>
        <ModalBody>
          {error && <Alert color="danger">{error}</Alert>}
          {selectedPerson && (() => {
            const { totalOwed, totalSettled, balance } = getPersonTab(selectedPerson.id);
            return (
              <div className="bg-light rounded p-3 mb-3">
                <div className="d-flex justify-content-between">
                  <small className="text-muted">Total owed by {selectedPerson.name}</small>
                  <small className="fw-semibold">{formatCurrency(totalOwed)}</small>
                </div>
                <div className="d-flex justify-content-between mt-1">
                  <small className="text-muted">Already settled</small>
                  <small className="fw-semibold text-success">{formatCurrency(totalSettled)}</small>
                </div>
                <div className="d-flex justify-content-between mt-1">
                  <small className="text-muted">Outstanding balance</small>
                  <small className="fw-semibold text-danger">{formatCurrency(balance)}</small>
                </div>
              </div>
            );
          })()}
          <Form>
            <FormGroup>
              <Label>Date <span className="text-danger">*</span></Label>
              <Input type="date" value={settleDate} onChange={e => setSettleDate(e.target.value)} />
            </FormGroup>
            <FormGroup>
              <Label>Amount Received (PKR) <span className="text-danger">*</span></Label>
              <Input type="number" value={settleAmount} onChange={e => setSettleAmount(e.target.value)} />
            </FormGroup>
            <FormGroup>
              <Label>Received In <span className="text-danger">*</span></Label>
              <Input type="select" value={settleAccount} onChange={e => setSettleAccount(e.target.value)}>
                <option value="">Select account...</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} — {formatCurrency(a.balance)}</option>)}
              </Input>
            </FormGroup>
            <FormGroup>
              <Label>Note</Label>
              <Input type="text" value={settleNote} onChange={e => setSettleNote(e.target.value)}
                placeholder="e.g. Bank transfer, cash..." />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="light" onClick={() => setSettlementModal(false)}>Cancel</Button>
          <Button color="success" onClick={handleSettle} disabled={saving}>
            {saving && <Spinner size="sm" className="me-2" />}
            Log Settlement
          </Button>
        </ModalFooter>
      </Modal>
    </React.Fragment>
  );
};

export default Splits;
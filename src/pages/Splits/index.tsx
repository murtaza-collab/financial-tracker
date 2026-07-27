import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Card, CardBody, CardHeader, Button, Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label, Input, Alert, Badge, Spinner, Table, Nav, NavItem, NavLink, Progress } from 'reactstrap';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../lib/currency';
import BreadCrumb from '../../Components/Common/BreadCrumb';

interface Person { id: string; name: string; phone: string; email: string | null; notes: string; opening_balance: number; linked_user_id: string | null; link_status: string | null; }
interface Outing {
  id: string; place_name: string; date: string; total_amount: number;
  total_people: number; your_share: number; paid_by: string; notes: string;
  transaction_id: string; paid_by_person_id: string | null;
  outing_participants: { person_id: string; share_amount: number; split_people: { name: string } }[];
}
interface Settlement {
  id: string; person_id: string; amount: number; date: string; notes: string;
  direction?: string;
  accounts?: { name: string };
}
interface PendingInvite {
  person_id: string; creator_id: string; creator_name: string | null;
  creator_email: string | null; invited_as: string;
}
// A split_people row where the current user is the *counterparty* (linked_user_id = me)
interface SharedPerson {
  id: string; user_id: string; name: string; opening_balance: number; notes: string | null;
}
interface SharedOuting {
  id: string; place_name: string; date: string; total_amount: number; total_people: number;
  your_share: number; paid_by_person_id: string | null;
  outing_participants: { person_id: string; share_amount: number }[];
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

  const [personModal, setPersonModal] = useState(false);
  const [settlementModal, setSettlementModal] = useState(false);
  const [outingModal, setOutingModal] = useState(false);
  const [editPerson, setEditPerson] = useState<Person | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [personName, setPersonName] = useState('');
  const [personPhone, setPersonPhone] = useState('');
  const [personEmail, setPersonEmail] = useState('');
  const [personNotes, setPersonNotes] = useState('');
  const [personOpeningBalance, setPersonOpeningBalance] = useState('');

  const [settleAmount, setSettleAmount] = useState('');
  const [settleAccount, setSettleAccount] = useState('');
  const [settleDate, setSettleDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [settleNote, setSettleNote] = useState('');
  const [settleDirection, setSettleDirection] = useState<'received' | 'paid'>('received');

  const [outingName, setOutingName] = useState('');
  const [outingDate, setOutingDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [outingAmount, setOutingAmount] = useState('');
  const [outingPayer, setOutingPayer] = useState('');
  const [outingParticipants, setOutingParticipants] = useState<string[]>([]);

  // Phase 2 — splits shared with ME (I'm the counterparty)
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [sharedPeople, setSharedPeople] = useState<SharedPerson[]>([]);
  const [sharedOutings, setSharedOutings] = useState<SharedOuting[]>([]);
  const [sharedSettlements, setSharedSettlements] = useState<Settlement[]>([]);
  const [creators, setCreators] = useState<{ id: string; name: string | null; email: string | null }[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  document.title = 'Splits & Recoveries | Finance Portal';

  const fetchData = async () => {
    setLoading(true);
    // Phase 1: flag which of your contacts are real app users (matched by email).
    // Foundation only — this shares nothing; it just sets linked_user_id / link_status.
    await supabase.rpc('refresh_split_links');
    const [{ data: peopleData }, { data: outingData }, { data: settlementData }, { data: accData }] = await Promise.all([
      supabase.from('split_people').select('*').eq('user_id', user?.id).order('name'),
      supabase.from('outings').select('*, outing_participants(person_id, share_amount, split_people(name))').eq('user_id', user?.id).order('date', { ascending: false }),
      supabase.from('settlements').select('*, accounts!settlements_account_id_fkey(name)').eq('user_id', user?.id).order('date', { ascending: false }),
      supabase.from('accounts').select('id, name, balance, type').eq('user_id', user?.id).eq('is_archived', false).order('name', { ascending: true }),
    ]);
    if (peopleData) setPeople(peopleData);
    if (outingData) setOutings(outingData as Outing[]);
    if (settlementData) setSettlements(settlementData);
    if (accData) setAccounts(accData);
    setLoading(false);
  };

  // Phase 2: discover & load splits where I'm the counterparty (read-only).
  const fetchShared = async () => {
    // Link any contact whose email matches my login, then read my pending invites.
    await supabase.rpc('claim_split_links');
    const { data: invites } = await supabase.rpc('my_pending_split_invites');
    setPendingInvites((invites as PendingInvite[]) || []);

    const { data: sp } = await supabase
      .from('split_people')
      .select('id, user_id, name, opening_balance, notes')
      .eq('linked_user_id', user?.id)
      .eq('link_status', 'accepted');
    const shared = (sp as SharedPerson[]) || [];
    setSharedPeople(shared);

    if (shared.length) {
      const creatorIds = Array.from(new Set(shared.map(p => p.user_id)));
      const personIds = shared.map(p => p.id);
      const [{ data: sOutings }, { data: sSettlements }, { data: sCreators }] = await Promise.all([
        supabase.from('outings').select('id, place_name, date, total_amount, total_people, your_share, paid_by_person_id, outing_participants(person_id, share_amount)').in('user_id', creatorIds),
        supabase.from('settlements').select('*').in('person_id', personIds),
        supabase.from('profiles').select('id, name, email').in('id', creatorIds),
      ]);
      setSharedOutings((sOutings as SharedOuting[]) || []);
      setSharedSettlements((sSettlements as Settlement[]) || []);
      setCreators(sCreators || []);
    } else {
      setSharedOutings([]);
      setSharedSettlements([]);
      setCreators([]);
    }
  };

  const resendInvite = async (personId: string) => {
    setRespondingId(personId);
    try {
      await supabase.rpc('resend_split_invite', { p_person_id: personId });
      await fetchData();
    } finally {
      setRespondingId(null);
    }
  };

  const respondInvite = async (personId: string, accept: boolean) => {
    setRespondingId(personId);
    try {
      await supabase.rpc('respond_to_split_invite', { p_person_id: personId, p_accept: accept });
      await fetchShared();
    } finally {
      setRespondingId(null);
    }
  };

  // Balance from the counterparty's side. balance > 0 => I owe the creator.
  const getSharedBalance = (personId: string) => {
    const person = sharedPeople.find(p => p.id === personId);
    const opening = Number(person?.opening_balance) || 0;
    const myOutings = sharedOutings.filter(o => o.outing_participants?.some(p => p.person_id === personId));
    const owedByMe = myOutings.reduce((sum, o) => sum + (o.outing_participants.find(p => p.person_id === personId)?.share_amount || 0), 0);
    const paidByMe = sharedOutings.filter(o => o.paid_by_person_id === personId);
    const creatorOwesMe = paidByMe.reduce((sum, o) => sum + (Number(o.your_share) || 0), 0);
    const ps = sharedSettlements.filter(s => s.person_id === personId);
    const received = ps.filter(s => !s.direction || s.direction === 'received').reduce((sum, s) => sum + Number(s.amount), 0);
    const paid = ps.filter(s => s.direction === 'paid').reduce((sum, s) => sum + Number(s.amount), 0);
    const balance = opening + owedByMe - creatorOwesMe - received + paid;
    return { opening, owedByMe, creatorOwesMe, received, paid, myOutings, paidByMe, balance };
  };

  useEffect(() => { fetchData(); fetchShared(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openPersonModal = (person?: Person) => {
    setEditPerson(person || null);
    setPersonName(person?.name || '');
    setPersonPhone(person?.phone || '');
    setPersonEmail(person?.email || '');
    setPersonNotes(person?.notes || '');
    setPersonOpeningBalance(person?.opening_balance ? String(person.opening_balance) : '');
    setError('');
    setPersonModal(true);
  };

  const handleSavePerson = async () => {
    if (!personName) { setError('Please enter a name'); return; }
    const trimmedEmail = personEmail.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address');
      return;
    }
    setSaving(true);
    try {
      const payload = { name: personName, phone: personPhone || null, email: trimmedEmail || null, notes: personNotes || null, opening_balance: Number(personOpeningBalance) || 0 };
      const { error: saveErr } = editPerson
        ? await supabase.from('split_people').update(payload).eq('id', editPerson.id)
        : await supabase.from('split_people').insert({ user_id: user?.id, ...payload });
      if (saveErr) throw new Error(saveErr.message);
      setPersonModal(false);
      fetchData();
    } catch (err: any) { setError(err.message || 'Could not save. Please try again.'); }
    finally { setSaving(false); }
  };

  const handleDeletePerson = async (id: string) => {
    if (window.confirm('Delete this person? Their outing history will be kept.')) {
      const { error: delErr } = await supabase.from('split_people').delete().eq('id', id);
      if (delErr) { alert(delErr.message); return; }
      fetchData();
    }
  };

  const getPersonTab = (personId: string) => {
    const person = people.find(p => p.id === personId);
    const openingBalance = Number(person?.opening_balance) || 0;

    // All outings where this person was a participant — they owe user their share
    const personOutings = outings.filter(o =>
      o.outing_participants.some(p => p.person_id === personId)
    );
    const outingOwed = personOutings.reduce((sum, o) => {
      const participant = o.outing_participants.find(p => p.person_id === personId);
      return sum + (participant?.share_amount || 0);
    }, 0);

    // Outings where this person paid — user owes them user's own share
    const paidByPersonOutings = outings.filter(o => o.paid_by_person_id === personId);
    const userOwesToPerson = paidByPersonOutings.reduce((sum, o) => sum + (Number(o.your_share) || 0), 0);

    const personSettlements = settlements.filter(s => s.person_id === personId);
    const receivedSettlements = personSettlements
      .filter(s => !s.direction || s.direction === 'received')
      .reduce((sum, s) => sum + Number(s.amount), 0);
    const paidSettlements = personSettlements
      .filter(s => s.direction === 'paid')
      .reduce((sum, s) => sum + Number(s.amount), 0);

    // positive = they owe user; negative = user owes them
    const balance = openingBalance + outingOwed - userOwesToPerson - receivedSettlements + paidSettlements;

    return { personOutings, paidByPersonOutings, openingBalance, outingOwed, userOwesToPerson, receivedSettlements, paidSettlements, balance };
  };

  const openOutingModal = () => {
    setOutingName('');
    setOutingDate(new Date().toLocaleDateString('en-CA'));
    setOutingAmount('');
    setOutingPayer('');
    setOutingParticipants([]);
    setError('');
    setOutingModal(true);
  };

  const toggleOutingParticipant = (id: string) => {
    setOutingParticipants(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const handleAddOuting = async () => {
    if (!outingName || !outingAmount || !outingPayer) {
      setError('Please fill all required fields');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const amount = Number(outingAmount);
      const payer = people.find(p => p.id === outingPayer);
      // total people = payer + user + other participants
      const totalPeople = outingParticipants.length + 2;
      const sharePerPerson = amount / totalPeople;

      const { data: newOuting, error: outingErr } = await supabase.from('outings').insert({
        user_id: user?.id,
        place_name: outingName,
        date: outingDate,
        total_amount: amount,
        total_people: totalPeople,
        your_share: sharePerPerson,
        paid_by: payer?.name || 'Someone else',
        paid_by_person_id: outingPayer,
        notes: null,
        transaction_id: null,
      }).select().single();

      if (outingErr) throw new Error(outingErr.message);

      if (outingParticipants.length > 0) {
        const rows = outingParticipants.map(personId => ({
          outing_id: newOuting.id,
          person_id: personId,
          share_amount: sharePerPerson,
        }));
        const { error: partErr } = await supabase.from('outing_participants').insert(rows);
        if (partErr) throw new Error(partErr.message);
      }

      setOutingModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openSettlementModal = (person: Person) => {
    setSelectedPerson(person);
    const { balance } = getPersonTab(person.id);
    const dir: 'received' | 'paid' = balance >= 0 ? 'received' : 'paid';
    setSettleDirection(dir);
    setSettleAmount(String(Math.abs(balance).toFixed(2)));
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

      if (settleDirection === 'received') {
        await supabase.from('transactions').insert({
          user_id: user?.id,
          date: new Date(settleDate).toISOString(),
          amount,
          type: 'reimbursement_received',
          account_id: settleAccount,
          category: 'Reimbursement',
          note: settleNote || `Settlement from ${selectedPerson.name}`,
        });
        if (acc) await supabase.from('accounts').update({ balance: acc.balance + amount }).eq('id', settleAccount);
      } else {
        await supabase.from('transactions').insert({
          user_id: user?.id,
          date: new Date(settleDate).toISOString(),
          amount,
          type: 'expense',
          account_id: settleAccount,
          category: 'Split Settlement',
          note: settleNote || `Payment to ${selectedPerson.name}`,
        });
        if (acc) await supabase.from('accounts').update({ balance: acc.balance - amount }).eq('id', settleAccount);
      }

      const { error: settleErr } = await supabase.from('settlements').insert({
        user_id: user?.id,
        person_id: selectedPerson.id,
        amount,
        date: settleDate,
        account_id: settleAccount,
        notes: settleNote || null,
        direction: settleDirection,
      });
      if (settleErr) throw new Error(settleErr.message);

      setSettlementModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Clear the oldest debits first (FIFO) using the settled pool; return only
  // what's still unpaid, with the first partially-paid item at its remainder.
  const fifoUnpaid = (items: { place: string; text: string; amount: number }[], pool: number) => {
    let remaining = pool;
    const unpaid: { place: string; text: string; show: number; partial: boolean }[] = [];
    items.forEach(it => {
      if (remaining >= it.amount) {
        remaining -= it.amount; // fully cleared — drop from list
      } else if (remaining > 0) {
        unpaid.push({ place: it.place, text: it.text, show: it.amount - remaining, partial: true });
        remaining = 0;
      } else {
        unpaid.push({ place: it.place, text: it.text, show: it.amount, partial: false });
      }
    });
    return { unpaid, cleared: pool - remaining };
  };

  const generateSummary = (person: Person) => {
    const { personOutings, paidByPersonOutings, openingBalance, receivedSettlements, paidSettlements, balance } = getPersonTab(person.id);

    // "they owe you" debits, oldest first
    const owedItems: { place: string; text: string; amount: number }[] = [];
    if (openingBalance > 0) owedItems.push({ place: 'Previous balance', text: `Previous balance - ${formatCurrency(openingBalance)}`, amount: openingBalance });
    [...personOutings].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).forEach(o => {
      const share = o.outing_participants.find(p => p.person_id === person.id)?.share_amount || 0;
      const isOnBehalf = o.your_share === 0 && !o.paid_by_person_id;
      const text = isOnBehalf
        ? `${o.place_name} - ${formatCurrency(share)}`
        : `${o.place_name} - ${formatCurrency(o.total_amount)}/${o.total_people} = ${formatCurrency(share)}`;
      owedItems.push({ place: o.place_name, text, amount: share });
    });

    // "you owe them" debits, oldest first
    const youOweItems: { place: string; text: string; amount: number }[] = [];
    [...paidByPersonOutings].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).forEach(o => {
      youOweItems.push({ place: o.place_name, text: `${o.place_name} - ${formatCurrency(o.total_amount)}/${o.total_people} = ${formatCurrency(o.your_share)}`, amount: Number(o.your_share) || 0 });
    });

    const owed = fifoUnpaid(owedItems, receivedSettlements);
    const youOwe = fifoUnpaid(youOweItems, paidSettlements);

    let text = `*${person.name} - Balance Summary*\n\n`;

    if (owed.unpaid.length > 0) {
      text += `*${person.name} owes you:*\n`;
      owed.unpaid.forEach(it => {
        text += it.partial ? `${it.place} - ${formatCurrency(it.show)} (partial)\n` : `${it.text}\n`;
      });
      const sub = owed.unpaid.reduce((s, it) => s + it.show, 0);
      text += `Subtotal: ${formatCurrency(sub)}\n`;
      if (owed.cleared > 0) text += `(${formatCurrency(owed.cleared)} already paid — older items cleared)\n`;
    }

    if (youOwe.unpaid.length > 0) {
      text += `\n*You owe ${person.name}:*\n`;
      youOwe.unpaid.forEach(it => {
        text += it.partial ? `${it.place} - ${formatCurrency(it.show)} (partial)\n` : `${it.text}\n`;
      });
      const sub = youOwe.unpaid.reduce((s, it) => s + it.show, 0);
      text += `Subtotal: ${formatCurrency(sub)}\n`;
      if (youOwe.cleared > 0) text += `(${formatCurrency(youOwe.cleared)} already paid — older items cleared)\n`;
    }

    const netLabel = balance > 0 ? `${person.name} owes you` : balance < 0 ? `You owe ${person.name}` : 'All settled';
    text += balance === 0
      ? `\n*Net: All settled ✓*`
      : `\n*Net: ${netLabel} ${formatCurrency(Math.abs(balance))}*`;
    navigator.clipboard.writeText(text);
    alert('Summary copied to clipboard! Paste in WhatsApp.');
  };

  const totalPendingAll = people.reduce((sum, p) => {
    const { balance } = getPersonTab(p.id);
    return sum + (balance > 0 ? balance : 0);
  }, 0);

  const totalYouOwe = people.reduce((sum, p) => {
    const { balance } = getPersonTab(p.id);
    return sum + (balance < 0 ? Math.abs(balance) : 0);
  }, 0);

  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>
          <BreadCrumb title="Splits & Recoveries" pageTitle="Finance Portal" />

          {pendingInvites.map(inv => (
            <Alert color="info" className="d-flex flex-wrap align-items-center justify-content-between gap-2" key={inv.person_id}>
              <div>
                <i className="ri-user-shared-line me-2"></i>
                <strong>{inv.creator_name || inv.creator_email || 'Someone'}</strong> added you to their splits
                {inv.invited_as ? <> as “{inv.invited_as}”</> : null}.
                Accept to see what you owe or are owed — read-only. Declining changes nothing.
              </div>
              <div className="d-flex gap-2">
                <Button color="success" size="sm" disabled={respondingId === inv.person_id}
                  onClick={() => respondInvite(inv.person_id, true)}>
                  {respondingId === inv.person_id && <Spinner size="sm" className="me-1" />}Accept
                </Button>
                <Button color="light" size="sm" disabled={respondingId === inv.person_id}
                  onClick={() => respondInvite(inv.person_id, false)}>
                  Decline
                </Button>
              </div>
            </Alert>
          ))}

          <Row className="mb-4">
            <Col md={3}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1">Pending Recovery</p>
                      <h4 className="text-warning">{formatCurrency(totalPendingAll)}</h4>
                      <small className="text-muted">They owe you</small>
                    </div>
                    <div className="avatar-sm"><span className="avatar-title bg-warning-subtle rounded-circle fs-3"><i className="ri-arrow-down-circle-line text-warning"></i></span></div>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="card-animate">
                <CardBody>
                  <div className="d-flex justify-content-between">
                    <div>
                      <p className="text-muted mb-1">You Owe</p>
                      <h4 className="text-danger">{formatCurrency(totalYouOwe)}</h4>
                      <small className="text-muted">To others</small>
                    </div>
                    <div className="avatar-sm"><span className="avatar-title bg-danger-subtle rounded-circle fs-3"><i className="ri-arrow-up-circle-line text-danger"></i></span></div>
                  </div>
                </CardBody>
              </Card>
            </Col>
            <Col md={3}>
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
            <Col md={3}>
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
                {sharedPeople.length > 0 && (
                  <NavItem>
                    <NavLink active={activeTab === 'owed'} onClick={() => setActiveTab('owed')} style={{ cursor: 'pointer' }}>
                      Shared With Me <Badge color="info" className="ms-1">{sharedPeople.length}</Badge>
                    </NavLink>
                  </NavItem>
                )}
              </Nav>
            </CardHeader>
            <CardBody>
              {loading ? (
                <div className="text-center py-5"><Spinner color="primary" /></div>
              ) : activeTab === 'people' ? (
                <>
                  <div className="d-flex justify-content-end gap-2 mb-3">
                    <Button color="primary" size="sm" onClick={openOutingModal}>
                      <i className="ri-bill-line me-1"></i> Someone Paid for Group
                    </Button>
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
                        const { personOutings, paidByPersonOutings, openingBalance, outingOwed, userOwesToPerson, receivedSettlements, paidSettlements, balance } = getPersonTab(person.id);
                        const grossOwed = openingBalance + outingOwed;
                        const totalActivity = grossOwed + userOwesToPerson;
                        const netSettled = receivedSettlements - paidSettlements;
                        const pct = totalActivity > 0 ? Math.min(100, Math.max(0, (netSettled / totalActivity) * 100)) : 100;
                        const totalOutings = personOutings.length + paidByPersonOutings.length;
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
                                      <h6 className="mb-0">
                                        {person.name}
                                        {person.linked_user_id && person.link_status === 'accepted' && (
                                          <Badge color="soft-success" className="text-success fs-11 ms-1" title="This person has accepted — they can see this split read-only.">
                                            <i className="ri-check-double-line me-1"></i>Sharing
                                          </Badge>
                                        )}
                                        {person.linked_user_id && person.link_status === 'pending' && (
                                          <Badge color="soft-info" className="text-info fs-11 ms-1" title="They have an app account and an invite is waiting for them to accept.">
                                            <i className="ri-mail-send-line me-1"></i>Invite sent
                                          </Badge>
                                        )}
                                        {person.linked_user_id && person.link_status === 'declined' && (
                                          <Badge color="soft-secondary" className="text-secondary fs-11 ms-1" title="They declined the invite. You can resend it.">
                                            <i className="ri-close-circle-line me-1"></i>Declined
                                          </Badge>
                                        )}
                                      </h6>
                                      {person.phone && <small className="text-muted d-block">{person.phone}</small>}
                                      {person.email && <small className="text-muted d-block">{person.email}</small>}
                                      {person.linked_user_id && person.link_status === 'declined' && (
                                        <Button color="link" size="sm" className="p-0 mt-1" disabled={respondingId === person.id}
                                          onClick={() => resendInvite(person.id)}>
                                          {respondingId === person.id && <Spinner size="sm" className="me-1" />}
                                          <i className="ri-refresh-line me-1"></i>Resend invite
                                        </Button>
                                      )}
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
                                  {openingBalance > 0 && (
                                    <div className="d-flex justify-content-between mb-1">
                                      <small className="text-muted">Previous balance</small>
                                      <small className="fw-semibold text-warning">{formatCurrency(openingBalance)}</small>
                                    </div>
                                  )}
                                  {outingOwed > 0 && (
                                    <div className="d-flex justify-content-between mb-1">
                                      <small className="text-muted">They owe you</small>
                                      <small className="fw-semibold text-primary">{formatCurrency(outingOwed)}</small>
                                    </div>
                                  )}
                                  {userOwesToPerson > 0 && (
                                    <div className="d-flex justify-content-between mb-1">
                                      <small className="text-muted">You owe them</small>
                                      <small className="fw-semibold text-danger">{formatCurrency(userOwesToPerson)}</small>
                                    </div>
                                  )}
                                  {receivedSettlements > 0 && (
                                    <div className="d-flex justify-content-between mb-1">
                                      <small className="text-muted">They settled</small>
                                      <small className="fw-semibold text-success">{formatCurrency(receivedSettlements)}</small>
                                    </div>
                                  )}
                                  {paidSettlements > 0 && (
                                    <div className="d-flex justify-content-between mb-1">
                                      <small className="text-muted">You paid them</small>
                                      <small className="fw-semibold text-info">{formatCurrency(paidSettlements)}</small>
                                    </div>
                                  )}
                                  <div className="d-flex justify-content-between mb-2 pt-1 border-top">
                                    <small className="fw-semibold text-muted">Net Balance</small>
                                    <small className={`fw-bold ${balance > 0 ? 'text-warning' : balance < 0 ? 'text-danger' : 'text-success'}`}>
                                      {balance > 0
                                        ? `They owe ${formatCurrency(balance)}`
                                        : balance < 0
                                        ? `You owe ${formatCurrency(Math.abs(balance))}`
                                        : 'Settled ✓'}
                                    </small>
                                  </div>
                                  <Progress value={pct} color={pct >= 100 ? 'success' : pct > 50 ? 'warning' : 'danger'} style={{ height: 6 }} />
                                  <small className="text-muted">{totalOutings} outing{totalOutings !== 1 ? 's' : ''}</small>
                                </div>

                                <div className="d-flex gap-2 mt-3">
                                  {balance !== 0 && (
                                    <Button
                                      color={balance > 0 ? 'success' : 'primary'}
                                      size="sm"
                                      className="flex-grow-1"
                                      onClick={() => openSettlementModal(person)}
                                    >
                                      <i className={`${balance > 0 ? 'ri-money-dollar-circle-line' : 'ri-send-plane-line'} me-1`}></i>
                                      {balance > 0 ? 'Settle' : 'Pay'}
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
              ) : activeTab === 'outings' ? (
                outings.length === 0 ? (
                  <div className="text-center py-5">
                    <i className="ri-restaurant-line fs-1 text-muted"></i>
                    <p className="text-muted mt-2">No outings yet.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <Table className="table-hover mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Date</th>
                          <th>Place</th>
                          <th>Paid By</th>
                          <th>People</th>
                          <th className="text-end">Total</th>
                          <th className="text-end">Your Share</th>
                          <th className="text-end">To Recover / You Owe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {outings.map(outing => {
                          const payerPerson = outing.paid_by_person_id
                            ? people.find(p => p.id === outing.paid_by_person_id)
                            : null;
                          const isPersonPaid = !!outing.paid_by_person_id;
                          return (
                            <tr key={outing.id}>
                              <td>{new Date(outing.date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                              <td className="fw-semibold">{outing.place_name}</td>
                              <td>
                                {isPersonPaid ? (
                                  <Badge color="soft-warning" className="text-warning fs-11">
                                    {payerPerson?.name || 'Someone else'}
                                  </Badge>
                                ) : (
                                  <Badge color="soft-success" className="text-success fs-11">You</Badge>
                                )}
                              </td>
                              <td>
                                <div className="d-flex flex-wrap gap-1">
                                  {outing.outing_participants.map((p, i) => (
                                    <Badge key={i} color="soft-primary" className="text-primary fs-11">{p.split_people?.name}</Badge>
                                  ))}
                                  {!isPersonPaid && <Badge color="soft-success" className="text-success fs-11">You</Badge>}
                                </div>
                              </td>
                              <td className="text-end">{formatCurrency(outing.total_amount)}</td>
                              <td className="text-end text-muted">{formatCurrency(outing.your_share)}</td>
                              <td className="text-end fw-semibold">
                                {isPersonPaid ? (
                                  <span className="text-danger">-{formatCurrency(outing.your_share)}</span>
                                ) : (
                                  <span className="text-warning">{formatCurrency(outing.total_amount - outing.your_share)}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>
                )
              ) : (
                // Shared With Me — read-only view of splits where I'm the counterparty
                sharedPeople.length === 0 ? (
                  <div className="text-center py-5">
                    <i className="ri-inbox-line fs-1 text-muted"></i>
                    <p className="text-muted mt-2">No splits have been shared with you yet.</p>
                  </div>
                ) : (
                  <Row>
                    {sharedPeople.map(person => {
                      const creator = creators.find(c => c.id === person.user_id);
                      const creatorName = creator?.name || creator?.email || 'Someone';
                      const { opening, owedByMe, creatorOwesMe, received, paid, myOutings, paidByMe, balance } = getSharedBalance(person.id);
                      return (
                        <Col md={6} xl={4} key={person.id} className="mb-3">
                          <Card className="border h-100">
                            <CardBody>
                              <div className="d-flex align-items-center gap-2 mb-3">
                                <div className="avatar-sm">
                                  <span className="avatar-title bg-info-subtle rounded-circle fs-4 fw-bold text-info">
                                    {creatorName.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <h6 className="mb-0">{creatorName}</h6>
                                  <small className="text-muted">Shared with you · read-only</small>
                                </div>
                              </div>

                              <div className="mb-2">
                                {opening > 0 && (
                                  <div className="d-flex justify-content-between mb-1">
                                    <small className="text-muted">Previous balance</small>
                                    <small className="fw-semibold text-warning">{formatCurrency(opening)}</small>
                                  </div>
                                )}
                                {owedByMe > 0 && (
                                  <div className="d-flex justify-content-between mb-1">
                                    <small className="text-muted">You owe them</small>
                                    <small className="fw-semibold text-danger">{formatCurrency(owedByMe)}</small>
                                  </div>
                                )}
                                {creatorOwesMe > 0 && (
                                  <div className="d-flex justify-content-between mb-1">
                                    <small className="text-muted">They owe you</small>
                                    <small className="fw-semibold text-primary">{formatCurrency(creatorOwesMe)}</small>
                                  </div>
                                )}
                                {received > 0 && (
                                  <div className="d-flex justify-content-between mb-1">
                                    <small className="text-muted">You paid them</small>
                                    <small className="fw-semibold text-success">{formatCurrency(received)}</small>
                                  </div>
                                )}
                                {paid > 0 && (
                                  <div className="d-flex justify-content-between mb-1">
                                    <small className="text-muted">They paid you</small>
                                    <small className="fw-semibold text-info">{formatCurrency(paid)}</small>
                                  </div>
                                )}
                                <div className="d-flex justify-content-between mb-2 pt-1 border-top">
                                  <small className="fw-semibold text-muted">Net Balance</small>
                                  <small className={`fw-bold ${balance > 0 ? 'text-danger' : balance < 0 ? 'text-warning' : 'text-success'}`}>
                                    {balance > 0
                                      ? `You owe ${formatCurrency(balance)}`
                                      : balance < 0
                                      ? `They owe you ${formatCurrency(Math.abs(balance))}`
                                      : 'Settled ✓'}
                                  </small>
                                </div>
                                <small className="text-muted">{myOutings.length + paidByMe.length} outing{(myOutings.length + paidByMe.length) !== 1 ? 's' : ''}</small>
                              </div>

                              {(myOutings.length > 0 || paidByMe.length > 0) && (
                                <div className="mt-2 pt-2 border-top">
                                  {myOutings.map(o => {
                                    const share = o.outing_participants.find(p => p.person_id === person.id)?.share_amount || 0;
                                    return (
                                      <div className="d-flex justify-content-between" key={o.id}>
                                        <small className="text-muted">{o.place_name}</small>
                                        <small className="text-danger">{formatCurrency(share)}</small>
                                      </div>
                                    );
                                  })}
                                  {paidByMe.map(o => (
                                    <div className="d-flex justify-content-between" key={o.id}>
                                      <small className="text-muted">{o.place_name} (you paid)</small>
                                      <small className="text-primary">{formatCurrency(o.your_share)}</small>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <Alert color="light" className="mt-3 mb-0 py-2">
                                <small className="text-muted">
                                  <i className="ri-lock-line me-1"></i>
                                  This is {creatorName}'s record. To settle, arrange payment with them directly.
                                </small>
                              </Alert>
                            </CardBody>
                          </Card>
                        </Col>
                      );
                    })}
                  </Row>
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
              <Label>Email (optional)</Label>
              <Input type="email" value={personEmail} onChange={e => setPersonEmail(e.target.value)} placeholder="name@example.com" />
              <small className="text-muted">
                If they sign up for the app with this email, you'll be able to share this split with them later. Adding it now does nothing on its own.
              </small>
            </FormGroup>
            <FormGroup>
              <Label>Notes (optional)</Label>
              <Input value={personNotes} onChange={e => setPersonNotes(e.target.value)} placeholder="e.g. Office colleague" />
            </FormGroup>
            <div className="border rounded p-3 bg-light">
              <FormGroup className="mb-0">
                <Label>Previous balance they owe you (PKR)</Label>
                <Input type="number" value={personOpeningBalance} onChange={e => setPersonOpeningBalance(e.target.value)} placeholder="0" />
                <small className="text-muted">Old debt from before you started tracking — no transaction created.</small>
              </FormGroup>
            </div>
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

      {/* Outing Modal — someone else paid */}
      <Modal isOpen={outingModal} toggle={() => setOutingModal(false)} centered size="lg">
        <ModalHeader toggle={() => setOutingModal(false)}>
          Add Group Outing — Paid by Someone Else
        </ModalHeader>
        <ModalBody>
          {error && <Alert color="danger">{error}</Alert>}
          <Form>
            <Row>
              <Col md={6}>
                <FormGroup>
                  <Label>Place / Description <span className="text-danger">*</span></Label>
                  <Input value={outingName} onChange={e => setOutingName(e.target.value)} placeholder="e.g. Team Lunch, Pizza Night" />
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup>
                  <Label>Date <span className="text-danger">*</span></Label>
                  <Input type="date" value={outingDate} onChange={e => setOutingDate(e.target.value)} />
                </FormGroup>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <FormGroup>
                  <Label>Total Bill (PKR) <span className="text-danger">*</span></Label>
                  <Input type="number" value={outingAmount} onChange={e => setOutingAmount(e.target.value)} placeholder="0" />
                </FormGroup>
              </Col>
              <Col md={6}>
                <FormGroup>
                  <Label>Paid By <span className="text-danger">*</span></Label>
                  <Input type="select" value={outingPayer} onChange={e => {
                    const newPayer = e.target.value;
                    setOutingPayer(newPayer);
                    setOutingParticipants(prev => prev.filter(id => id !== newPayer));
                  }}>
                    <option value="">Select person...</option>
                    {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Input>
                </FormGroup>
              </Col>
            </Row>
            <FormGroup>
              <Label>Other Participants</Label>
              <small className="text-muted d-block mb-2">
                Select everyone else who was there (excluding payer). You are always included.
              </small>
              <div className="border rounded p-3">
                {people.filter(p => p.id !== outingPayer).length === 0 ? (
                  <small className="text-muted">{outingPayer ? 'No other people to add.' : 'Select a payer first.'}</small>
                ) : (
                  <Row>
                    {people.filter(p => p.id !== outingPayer).map(p => (
                      <Col xs={6} key={p.id}>
                        <div className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`part-${p.id}`}
                            checked={outingParticipants.includes(p.id)}
                            onChange={() => toggleOutingParticipant(p.id)}
                          />
                          <label className="form-check-label" htmlFor={`part-${p.id}`}>{p.name}</label>
                        </div>
                      </Col>
                    ))}
                  </Row>
                )}
              </div>
            </FormGroup>
            {outingAmount && outingPayer && (
              <Alert color="info" className="py-2 mb-0">
                <small>
                  <strong>{outingParticipants.length + 2} people</strong> total (you + {people.find(p => p.id === outingPayer)?.name} + {outingParticipants.length} other{outingParticipants.length !== 1 ? 's' : ''})
                  {' → '}
                  <strong>Your share: {formatCurrency(Number(outingAmount) / (outingParticipants.length + 2))}</strong>
                  {' — you owe this to the payer'}
                </small>
              </Alert>
            )}
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="light" onClick={() => setOutingModal(false)}>Cancel</Button>
          <Button color="primary" onClick={handleAddOuting} disabled={saving}>
            {saving && <Spinner size="sm" className="me-2" />}
            Add Outing
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
            const { openingBalance, outingOwed, userOwesToPerson, receivedSettlements, paidSettlements, balance } = getPersonTab(selectedPerson.id);
            return (
              <div className="bg-light rounded p-3 mb-3">
                {openingBalance + outingOwed > 0 && (
                  <div className="d-flex justify-content-between">
                    <small className="text-muted">They owe you</small>
                    <small className="fw-semibold text-primary">{formatCurrency(openingBalance + outingOwed)}</small>
                  </div>
                )}
                {userOwesToPerson > 0 && (
                  <div className="d-flex justify-content-between mt-1">
                    <small className="text-muted">You owe them</small>
                    <small className="fw-semibold text-danger">{formatCurrency(userOwesToPerson)}</small>
                  </div>
                )}
                {(receivedSettlements > 0 || paidSettlements > 0) && (
                  <div className="d-flex justify-content-between mt-1">
                    <small className="text-muted">Net settled</small>
                    <small className="fw-semibold text-success">{formatCurrency(receivedSettlements - paidSettlements)}</small>
                  </div>
                )}
                <div className="d-flex justify-content-between mt-1 pt-1 border-top">
                  <small className="fw-semibold text-muted">Net balance</small>
                  <small className={`fw-bold ${balance > 0 ? 'text-warning' : balance < 0 ? 'text-danger' : 'text-success'}`}>
                    {balance > 0
                      ? `They owe you ${formatCurrency(balance)}`
                      : balance < 0
                      ? `You owe them ${formatCurrency(Math.abs(balance))}`
                      : 'Settled ✓'}
                  </small>
                </div>
              </div>
            );
          })()}
          <div className="mb-3">
            <Label className="d-block mb-2">Settlement Direction</Label>
            <div className="d-flex gap-2">
              <Button
                color={settleDirection === 'received' ? 'success' : 'light'}
                size="sm"
                onClick={() => setSettleDirection('received')}
              >
                <i className="ri-arrow-down-circle-line me-1"></i> They paid me
              </Button>
              <Button
                color={settleDirection === 'paid' ? 'primary' : 'light'}
                size="sm"
                onClick={() => setSettleDirection('paid')}
              >
                <i className="ri-arrow-up-circle-line me-1"></i> I paid them
              </Button>
            </div>
          </div>
          <Form>
            <FormGroup>
              <Label>Date <span className="text-danger">*</span></Label>
              <Input type="date" value={settleDate} onChange={e => setSettleDate(e.target.value)} />
            </FormGroup>
            <FormGroup>
              <Label>Amount (PKR) <span className="text-danger">*</span></Label>
              <Input type="number" value={settleAmount} onChange={e => setSettleAmount(e.target.value)} />
            </FormGroup>
            <FormGroup>
              <Label>{settleDirection === 'received' ? 'Received In' : 'Paid From'} <span className="text-danger">*</span></Label>
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
          <Button color={settleDirection === 'received' ? 'success' : 'primary'} onClick={handleSettle} disabled={saving}>
            {saving && <Spinner size="sm" className="me-2" />}
            {settleDirection === 'received' ? 'Log Receipt' : 'Log Payment'}
          </Button>
        </ModalFooter>
      </Modal>
    </React.Fragment>
  );
};

export default Splits;

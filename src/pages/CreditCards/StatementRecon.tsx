import React, { useState, useRef } from 'react';
import {
  Modal, ModalHeader, ModalBody, ModalFooter,
  Button, Spinner, Alert, Table, Badge, Input, FormGroup, Label,
} from 'reactstrap';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../lib/currency';
import { extractLinesFromPDF } from '../../lib/pdfExtract';
import { detectBankAndParse, SUPPORTED_BANKS } from '../../lib/statementParsers';
import type { ParsedStatement, ParsedTransaction } from '../../lib/statementParsers';

const CATEGORIES = [
  'Grocery', 'Restaurant & Food', 'Fuel', 'Utility Bills', 'Mobile & Internet',
  'Medical', 'Transport', 'Shopping', 'Education', 'Rent', 'Salary',
  'Freelance Income', 'Business Income', 'Reimbursement', 'Family',
  'Entertainment', 'Travel', 'Office Expense', 'Other',
];

const REPORT_EMAIL = 'murtazataiyeb92@gmail.com';

interface CreditCard {
  id: string; name: string; bank_name: string; balance: number;
  credit_limit: number; last_four: string;
}

type ReconStatus = 'matched' | 'other_account' | 'missing' | 'added' | 'credit';

interface ReconItem {
  parsed: ParsedTransaction;
  status: ReconStatus;
  adding: boolean;
}

interface Props {
  card: CreditCard;
  userId: string;
  onClose: () => void;
  onDone: () => void;
}

type Step = 'upload' | 'preview' | 'results';

const STATUS_COLOR: Record<ReconStatus, string> = {
  matched: 'success', missing: 'danger', other_account: 'info',
  credit: 'secondary', added: 'primary',
};
const STATUS_LABEL: Record<ReconStatus, string> = {
  matched: '✓ Matched', missing: 'Missing', other_account: 'Other Account',
  credit: 'Credit', added: 'Added ✓',
};

const StatementRecon: React.FC<Props> = ({ card, userId, onClose, onDone }) => {
  const [step, setStep] = useState<Step>('upload');
  const [parsing, setParsing] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [statement, setStatement] = useState<ParsedStatement | null>(null);
  const [isGeneric, setIsGeneric] = useState(false);
  const [editedCategories, setEditedCategories] = useState<Record<number, string>>({});
  const [items, setItems] = useState<ReconItem[]>([]);
  const [error, setError] = useState('');
  const [reportBankName, setReportBankName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleParse = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError('Please select a PDF file'); return; }
    setError('');
    setReportBankName('');
    setParsing(true);
    try {
      const lines = await extractLinesFromPDF(file);
      const parsed = detectBankAndParse(lines);

      if (!parsed) {
        setError('unsupported');
        return;
      }

      const { result, isGeneric: generic } = parsed;

      if (result.cardLastFour && result.cardLastFour !== card.last_four) {
        setError(`Card mismatch: statement is for card ending in ${result.cardLastFour}, but you selected card ending in ${card.last_four}.`);
        return;
      }
      if (result.transactions.length === 0) {
        setError('No transactions found. The PDF format may have changed — please report it using the button below.');
        return;
      }

      setStatement(result);
      setIsGeneric(generic);
      setEditedCategories({});
      setStep('preview');
    } catch (err: any) {
      setError(err.message || 'Failed to read PDF');
    } finally {
      setParsing(false);
    }
  };

  const handleReconcile = async () => {
    if (!statement) return;
    setError('');
    setReconciling(true);
    try {
      const txns: ParsedTransaction[] = statement.transactions.map((t, i) => ({
        ...t,
        category: editedCategories[i] ?? t.category,
      }));

      const dates = txns.map(t => t.date).filter(Boolean);
      if (!dates.length) { setError('No valid dates found in statement'); return; }
      const minDate = dates.reduce((a, b) => a < b ? a : b);
      const maxDate = dates.reduce((a, b) => a > b ? a : b);

      const from = new Date(minDate); from.setDate(from.getDate() - 2);
      const to = new Date(maxDate); to.setDate(to.getDate() + 2);

      const { data: dbTxns } = await supabase
        .from('transactions')
        .select('id, account_id, amount, date')
        .eq('user_id', userId)
        .gte('date', from.toISOString())
        .lte('date', to.toISOString());

      const db = dbTxns || [];

      const reconItems: ReconItem[] = txns.map(parsed => {
        if (parsed.isCredit) return { parsed, status: 'credit', adding: false };

        const parsedMs = new Date(parsed.date).getTime();
        const match = db.find(t => {
          const diff = Math.abs(new Date(t.date).getTime() - parsedMs) / 86400000;
          return Math.abs(Number(t.amount) - parsed.amount) < 0.01 && diff <= 1;
        });

        if (!match) return { parsed, status: 'missing', adding: false };
        if (match.account_id === card.id) return { parsed, status: 'matched', adding: false };
        return { parsed, status: 'other_account', adding: false };
      });

      setItems(reconItems);
      setStep('results');
    } catch (err: any) {
      setError(err.message || 'Reconciliation failed');
    } finally {
      setReconciling(false);
    }
  };

  const addOne = async (idx: number) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, adding: true } : it));
    try {
      const { parsed } = items[idx];
      const { data: freshCard } = await supabase.from('accounts').select('balance').eq('id', card.id).single();
      await supabase.from('transactions').insert({
        user_id: userId,
        account_id: card.id,
        date: new Date(parsed.date).toISOString(),
        amount: parsed.amount,
        type: 'expense',
        category: parsed.category,
        note: parsed.description,
      });
      await supabase.from('accounts')
        .update({ balance: (freshCard?.balance || 0) + parsed.amount })
        .eq('id', card.id);
      setItems(prev => prev.map((it, i) => i === idx ? { ...it, status: 'added', adding: false } : it));
    } catch {
      setItems(prev => prev.map((it, i) => i === idx ? { ...it, adding: false } : it));
    }
  };

  const addAll = async () => {
    const indices = items
      .map((it, i) => ({ it, i }))
      .filter(({ it }) => it.status === 'missing')
      .map(({ i }) => i);
    for (const i of indices) await addOne(i);
    onDone();
  };

  const openReportEmail = () => {
    const bank = reportBankName.trim() || 'Unknown';
    const subject = encodeURIComponent(`Unsupported Bank Statement: ${bank}`);
    const body = encodeURIComponent(
      `Bank Name: ${bank}\nCard: ${card.bank_name} (${card.name})\n\nPlease add support for this bank's statement format.\n\nNote: Attach a sample PDF (with sensitive data redacted) so the parser can be built.`
    );
    window.open(`mailto:${REPORT_EMAIL}?subject=${subject}&body=${body}`);
  };

  const counts = {
    matched: items.filter(i => i.status === 'matched').length,
    missing: items.filter(i => i.status === 'missing').length,
    other: items.filter(i => i.status === 'other_account').length,
    credits: items.filter(i => i.status === 'credit').length,
    added: items.filter(i => i.status === 'added').length,
  };

  return (
    <Modal isOpen toggle={onClose} size="xl" centered scrollable>
      <ModalHeader toggle={onClose}>
        Reconcile Statement — {card.name} •••• {card.last_four}
      </ModalHeader>

      <ModalBody>
        {/* ── Error states ── */}
        {error === 'unsupported' ? (
          <div className="text-center py-4">
            <i className="ri-error-warning-line fs-1 text-warning d-block mb-3"></i>
            <h5>Bank Not Supported Yet</h5>
            <p className="text-muted mb-1">
              Supported banks: <strong>{SUPPORTED_BANKS.join(', ')}</strong>
            </p>
            <p className="text-muted mb-4 fs-13">
              The generic parser also couldn't extract transactions from this PDF. Help us add support by reporting your bank.
            </p>
            <div style={{ maxWidth: 360, margin: '0 auto' }}>
              <FormGroup>
                <Label className="fs-13">Your Bank Name</Label>
                <Input
                  type="text"
                  placeholder="e.g. MCB, Meezan, Faysal Bank..."
                  value={reportBankName}
                  onChange={e => setReportBankName(e.target.value)}
                />
              </FormGroup>
              <Button color="warning" className="w-100" onClick={openReportEmail}>
                <i className="ri-mail-send-line me-2"></i>Report Unsupported Bank
              </Button>
              <p className="text-muted fs-12 mt-2">
                Opens your email app. Attach a sample statement (redact sensitive info) so the parser can be built quickly.
              </p>
            </div>
            <Button color="light" size="sm" className="mt-2" onClick={() => setError('')}>
              Try Another File
            </Button>
          </div>
        ) : error ? (
          <Alert color="danger" className="mb-3">
            {error}
            {error.includes('format') && (
              <div className="mt-2">
                <Button color="link" size="sm" className="p-0 text-danger" onClick={() => { setError('unsupported'); }}>
                  Report unsupported bank →
                </Button>
              </div>
            )}
          </Alert>
        ) : null}

        {/* ── Step 1: Upload ── */}
        {step === 'upload' && !error && (
          <div className="text-center py-4">
            <i className="ri-file-pdf-2-line fs-1 text-danger mb-3 d-block"></i>
            <h5 className="mb-1">Upload Bank Statement PDF</h5>
            <p className="text-muted mb-1 fs-13">
              Natively supported: <strong>{SUPPORTED_BANKS.join(', ')}</strong>
            </p>
            <p className="text-muted mb-4 fs-12">Other banks are attempted via a generic parser.</p>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="form-control mb-4"
              style={{ maxWidth: 420, margin: '0 auto 16px' }}
            />
            <Button color="primary" onClick={handleParse} disabled={parsing}>
              {parsing
                ? <><Spinner size="sm" className="me-2" />Parsing PDF...</>
                : <><i className="ri-scan-2-line me-2"></i>Parse Statement</>}
            </Button>
          </div>
        )}

        {/* ── Step 2: Preview ── */}
        {step === 'preview' && statement && (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h6 className="mb-0">
                  {statement.bank}
                  <Badge color="secondary" className="ms-2 fs-12">{statement.transactions.length} transactions</Badge>
                  {isGeneric && (
                    <Badge color="warning" className="ms-2 fs-11">Generic parser — verify results</Badge>
                  )}
                </h6>
                <small className="text-muted">Review categories before reconciling</small>
              </div>
              <Button color="link" size="sm" className="text-muted" onClick={() => { setStep('upload'); setError(''); }}>
                <i className="ri-arrow-left-line me-1"></i>Back
              </Button>
            </div>

            <div className="table-responsive" style={{ maxHeight: 460 }}>
              <Table size="sm" className="table-hover align-middle mb-0">
                <thead className="table-light" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th className="fs-12">Date</th>
                    <th className="fs-12">Description</th>
                    <th className="fs-12 text-end">Amount</th>
                    <th className="fs-12">Type</th>
                    <th className="fs-12" style={{ minWidth: 160 }}>Category</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.transactions.map((tx, i) => (
                    <tr key={i} className={tx.isCredit ? 'table-success' : ''}>
                      <td className="text-nowrap fs-12">{tx.date}</td>
                      <td className="fs-12" style={{ maxWidth: 260 }}>{tx.description}</td>
                      <td className="text-end text-nowrap fs-12">
                        {tx.isCredit
                          ? <span className="text-success fw-semibold">+{formatCurrency(tx.amount)}</span>
                          : formatCurrency(tx.amount)}
                      </td>
                      <td>
                        {tx.isCredit
                          ? <Badge color="success" pill className="fs-11">Credit</Badge>
                          : <Badge color="light" pill className="fs-11 text-dark">Debit</Badge>}
                      </td>
                      <td>
                        <Input
                          type="select"
                          bsSize="sm"
                          value={editedCategories[i] ?? tx.category}
                          onChange={e => setEditedCategories(p => ({ ...p, [i]: e.target.value }))}
                          disabled={tx.isCredit}
                          className="fs-12"
                        >
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </Input>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        )}

        {/* ── Step 3: Results ── */}
        {step === 'results' && (
          <div>
            <div className="d-flex gap-2 mb-3 flex-wrap">
              {counts.matched > 0 && <Badge color="success" className="fs-12 px-3 py-2">{counts.matched} Matched</Badge>}
              {counts.missing > 0 && <Badge color="danger" className="fs-12 px-3 py-2">{counts.missing} Missing</Badge>}
              {counts.other > 0 && <Badge color="info" className="fs-12 px-3 py-2">{counts.other} On Other Account</Badge>}
              {counts.credits > 0 && <Badge color="secondary" className="fs-12 px-3 py-2">{counts.credits} Credits</Badge>}
              {counts.added > 0 && <Badge color="primary" className="fs-12 px-3 py-2">{counts.added} Added</Badge>}
            </div>

            <div className="table-responsive" style={{ maxHeight: 480 }}>
              <Table size="sm" className="table-hover align-middle mb-0">
                <thead className="table-light" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th className="fs-12">Date</th>
                    <th className="fs-12">Description</th>
                    <th className="fs-12">Category</th>
                    <th className="fs-12 text-end">Amount</th>
                    <th className="fs-12 text-center">Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} className={
                      item.status === 'matched' ? 'table-success' :
                      item.status === 'missing' ? 'table-danger' :
                      item.status === 'added' ? 'table-primary' :
                      item.status === 'other_account' ? 'table-info' :
                      'table-secondary'
                    }>
                      <td className="text-nowrap fs-12">{item.parsed.date}</td>
                      <td className="fs-12" style={{ maxWidth: 220 }}>{item.parsed.description}</td>
                      <td className="fs-12">{item.parsed.category}</td>
                      <td className="text-end text-nowrap fs-12">
                        {item.parsed.isCredit
                          ? <span className="text-success">+{formatCurrency(item.parsed.amount)}</span>
                          : formatCurrency(item.parsed.amount)}
                      </td>
                      <td className="text-center">
                        <Badge color={STATUS_COLOR[item.status]} pill className="fs-11">
                          {STATUS_LABEL[item.status]}
                        </Badge>
                      </td>
                      <td>
                        {item.status === 'missing' && (
                          <Button color="success" size="sm" onClick={() => addOne(i)} disabled={item.adding}>
                            {item.adding ? <Spinner size="sm" /> : '+ Add'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        {step === 'upload' && !error && <Button color="light" onClick={onClose}>Cancel</Button>}
        {step === 'preview' && (
          <>
            <Button color="light" onClick={() => { setStep('upload'); setError(''); }}>Back</Button>
            <Button color="primary" onClick={handleReconcile} disabled={reconciling}>
              {reconciling
                ? <><Spinner size="sm" className="me-2" />Reconciling...</>
                : <><i className="ri-git-commit-line me-2"></i>Reconcile</>}
            </Button>
          </>
        )}
        {step === 'results' && (
          <>
            {counts.missing > 0 && (
              <Button color="success" onClick={addAll}>
                <i className="ri-add-circle-line me-1"></i>Add All {counts.missing} Missing
              </Button>
            )}
            <Button color="light" onClick={onClose}>Close</Button>
          </>
        )}
        {error && error !== 'unsupported' && (
          <Button color="light" onClick={() => setError('')}>Try Again</Button>
        )}
      </ModalFooter>
    </Modal>
  );
};

export default StatementRecon;

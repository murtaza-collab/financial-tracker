import type { ParsedStatement, ParsedTransaction } from './types';
import { detectCategory } from './categoryMap';

// UBL date: YYYY/MM/DD
function parseDate(str: string): string {
  const [y, m, d] = str.split('/').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-CA');
}

// A row that starts a new transaction: card_number  txn_date  post_date
const CARD_LINE_RE = /^(4\d{3}\*+\d{4})\s+(\d{4}\/\d{2}\/\d{2})\s+(\d{4}\/\d{2}\/\d{2})\s*$/;
// Reference number + amount on same line, or just amount alone
const REF_AMT_RE = /^(\d{10,})\s+([\d,]+\.\d{2})(CR)?\s*$/i;
const AMT_ONLY_RE = /^([\d,]+\.\d{2})(CR)?\s*$/i;
// Pure long reference number line (no amount)
const REF_ONLY_RE = /^\d{10,}\s*$/;

export function parseUBL(lines: string[]): ParsedStatement {
  const transactions: ParsedTransaction[] = [];
  let cardLastFour = '';

  // Extract last 4 from header
  for (const line of lines.slice(0, 15)) {
    const m = line.match(/\*+(\d{4})/);
    if (m) { cardLastFour = m[1]; break; }
  }

  type Pending = { txnDate: string; descLines: string[]; amount: number | null; isCredit: boolean };
  let cur: Pending | null = null;

  const flush = () => {
    if (cur?.amount !== null && cur?.txnDate) {
      const desc = cur!.descLines.join(' ').trim();
      transactions.push({
        date: parseDate(cur!.txnDate),
        description: desc,
        amount: cur!.amount!,
        isCredit: cur!.isCredit,
        category: detectCategory(desc),
      });
    }
    cur = null;
  };

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;

    const cardMatch = t.match(CARD_LINE_RE);
    if (cardMatch) {
      flush();
      cur = { txnDate: cardMatch[2], descLines: [], amount: null, isCredit: false };
      continue;
    }

    if (!cur) continue;

    // Ref + amount
    const refAmt = t.match(REF_AMT_RE);
    if (refAmt) {
      cur.amount = parseFloat(refAmt[2].replace(/,/g, ''));
      cur.isCredit = (refAmt[3] || '').toUpperCase() === 'CR';
      flush();
      continue;
    }

    // Amount only
    const amtOnly = t.match(AMT_ONLY_RE);
    if (amtOnly) {
      cur.amount = parseFloat(amtOnly[1].replace(/,/g, ''));
      cur.isCredit = (amtOnly[2] || '').toUpperCase() === 'CR';
      flush();
      continue;
    }

    // Skip pure reference number lines
    if (REF_ONLY_RE.test(t)) continue;

    cur.descLines.push(t);
  }

  flush();

  return { bank: 'UBL', cardLastFour, transactions };
}

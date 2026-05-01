import type { ParsedStatement, ParsedTransaction } from './types';
import { detectCategory } from './categoryMap';

// JS Bank: YYYY-MM-DD  YYYY-MM-DD  description  amount[-]
const TX_RE = /^(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})\s+(.+?)\s+([\d,]+\.\d{2})(-?)\s*$/;

const SKIP_RE = /^(previous\s+balance|sub\s+total|important|account\s+summary|cashback|payment\s+summary|credit\s+limit|transaction\s+date|opening\s+balance|closing\s+balance)/i;

export function parseJSBank(lines: string[]): ParsedStatement {
  const transactions: ParsedTransaction[] = [];
  let cardLastFour = '';

  // JS Bank shows full card number in header: "4770520044152640"
  for (const line of lines.slice(0, 30)) {
    const m = line.match(/\b(\d{16})\b/) || line.match(/(\d{4,6}X+(\d{4}))/i);
    if (m) {
      cardLastFour = m[1].slice(-4);
      break;
    }
  }

  for (const line of lines) {
    const t = line.trim();
    if (!t || SKIP_RE.test(t)) continue;

    const m = t.match(TX_RE);
    if (!m) continue;

    const desc = m[3].trim();
    transactions.push({
      date: m[1], // already YYYY-MM-DD
      description: desc,
      amount: parseFloat(m[4].replace(/,/g, '')),
      isCredit: m[5] === '-',
      category: detectCategory(desc),
    });
  }

  return { bank: 'JS Bank', cardLastFour, transactions };
}

import type { ParsedStatement, ParsedTransaction } from './types';
import { detectCategory } from './categoryMap';

const MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

function parseDate(str: string): string {
  const parts = str.trim().toUpperCase().split(/\s+/);
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return new Date(Number(y), MONTHS[m] ?? 0, Number(d)).toISOString().split('T')[0];
  }
  return '';
}

// Full single-line transaction: DD MMM YYYY  DD MMM YYYY  description  amount[-]
const TX_RE = /^(\d{2}\s+[A-Z]{3}\s+\d{4})\s+(\d{2}\s+[A-Z]{3}\s+\d{4})\s+(.+?)\s+([\d,]+\.\d{2})(-?)\s*$/i;

export function parseAlfalah(lines: string[]): ParsedStatement {
  const transactions: ParsedTransaction[] = [];
  let cardLastFour = '';

  for (const line of lines.slice(0, 25)) {
    const m = line.match(/\d{6}X{6}(\d{4})/i) || line.match(/\*{4,}(\d{4})/);
    if (m) { cardLastFour = m[1]; break; }
  }

  for (const line of lines) {
    if (/end of statement/i.test(line)) break;
    const m = line.match(TX_RE);
    if (!m) continue;
    const desc = m[3].trim();
    transactions.push({
      date: parseDate(m[1]),
      description: desc,
      amount: parseFloat(m[4].replace(/,/g, '')),
      isCredit: m[5] === '-',
      category: detectCategory(desc),
    });
  }

  return { bank: 'Bank Alfalah', cardLastFour, transactions };
}

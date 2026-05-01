import type { ParsedStatement, ParsedTransaction } from './types';
import { detectCategory } from './categoryMap';

const MONTHS_SHORT: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

function parseDate(str: string, year: number): string {
  // str = "01 MAR" or "1 MAR"
  const [d, m] = str.trim().toUpperCase().split(/\s+/);
  const monthIdx = MONTHS_SHORT[m] ?? 0;
  return new Date(year, monthIdx, Number(d)).toLocaleDateString('en-CA');
}

// Extract year from header lines (e.g. "12 Apr 2026")
function extractYear(lines: string[]): number {
  for (const line of lines.slice(0, 30)) {
    const m = line.match(/\d{1,2}\s+[A-Z][a-z]{2}\s+(\d{4})/i);
    if (m) return Number(m[1]);
  }
  return new Date().getFullYear();
}

// DD MMM  description  [PKR XXXXX]  amount[CR]
// The amount (PKR) is always the last number. Credits end with "CR".
const TX_RE = /^(\d{1,2}\s+[A-Z]{3})\s+(.+?)\s+([\d,]+\.\d{2})(CR)?\s*$/i;

// Lines to skip even if they match TX_RE pattern
const SKIP_RE = /^(amount\s+usd|previous\s+balance|new\s+balance|minimum\s+payment|worldmiles|statement\s+date|payment\s+due)/i;

export function parseSCBL(lines: string[]): ParsedStatement {
  const transactions: ParsedTransaction[] = [];
  let cardLastFour = '';
  const year = extractYear(lines);

  // Card pattern: XXXXXX<digits>XXXX<last4> or XXXXXXXX<last4>
  for (const line of lines.slice(0, 30)) {
    const m = line.match(/X{4,}(\d{4})/i) || line.match(/\*{4,}(\d{4})/);
    if (m) { cardLastFour = m[1]; break; }
  }

  for (const line of lines) {
    if (SKIP_RE.test(line.trim())) continue;
    const m = line.match(TX_RE);
    if (!m) continue;

    // Clean PKR/USD currency artifacts from description
    let desc = m[2].trim();
    desc = desc.replace(/\s+PKR\s+[\d,]+\.\d{2}\s*$/i, '').trim();
    desc = desc.replace(/\s+USD\s+[\d,]+\.\d{2}\s*$/i, '').trim();
    desc = desc.replace(/\s+Amount\s+\w{2,3}:\s+[\d.]+\s+\w{2,3}\s+Rate:\s+[\d.]+\s*$/i, '').trim();

    const isCredit = (m[4] || '').toUpperCase() === 'CR';
    transactions.push({
      date: parseDate(m[1], year),
      description: desc,
      amount: parseFloat(m[3].replace(/,/g, '')),
      isCredit,
      category: detectCategory(desc),
    });
  }

  return { bank: 'Standard Chartered', cardLastFour, transactions };
}

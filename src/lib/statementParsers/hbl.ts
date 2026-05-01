import type { ParsedStatement, ParsedTransaction } from './types';
import { detectCategory } from './categoryMap';

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function parseDate(str: string): string {
  // "Mar 14, 2026"
  const m = str.match(/([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})/);
  if (!m) return '';
  return new Date(Number(m[3]), MONTHS[m[1]] ?? 0, Number(m[2])).toISOString().split('T')[0];
}

// Matches: "Mon DD, YYYY  Mon DD, YYYY  description  [-]amount"
// The last number (PKR amount) may be negative for credits.
const TX_RE = /^([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})\s+([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})\s+(.+?)\s+(-?[\d,]+\.\d{2})\s*$/;

const SKIP_RE = /previous\s+balance|sub\s+total|\btotal\b|transaction\s+date|posting\s+date|payment\s+due|current\s+balance/i;

export function parseHBL(lines: string[]): ParsedStatement {
  let cardLastFour = '';

  // Card format: "490288******1315"
  for (const line of lines.slice(0, 20)) {
    const m = line.match(/\d{6}\*{6}(\d{4})/);
    if (m) { cardLastFour = m[1]; break; }
  }

  // HBL PDFs render the transaction table cumulatively (each row added one at a time),
  // so the same transaction line appears many times at different Y positions.
  // Deduplicate using a Set of serialized row strings.
  const seen = new Set<string>();
  const transactions: ParsedTransaction[] = [];

  for (const line of lines) {
    if (SKIP_RE.test(line)) continue;

    const m = line.match(TX_RE);
    if (!m) continue;

    // Build a dedup key: txnDate + description + amount
    const amount = parseFloat(m[4].replace(/,/g, ''));
    let desc = m[3].trim();
    // Strip FCY artifacts like "USD 25.00" that pdfjs may merge into description
    desc = desc.replace(/\s+(USD|PKR|EUR|GBP)\s+[\d,.]+\s*$/i, '').trim();

    const key = `${m[1]}|${desc}|${amount}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const isCredit = amount < 0;

    transactions.push({
      date: parseDate(m[1]),
      description: desc,
      amount: Math.abs(amount),
      isCredit,
      category: detectCategory(desc),
    });
  }

  return { bank: 'HBL', cardLastFour, transactions };
}

import type { ParsedStatement, ParsedTransaction } from './types';
import { detectCategory } from './categoryMap';

// Months map for DD MMM YYYY style
const MON: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

function toISO(raw: string): string {
  raw = raw.trim();
  // YYYY-MM-DD or YYYY/MM/DD
  if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(raw)) {
    return raw.replace(/\//g, '-');
  }
  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  // DD MMM YYYY
  const ddmmmyyyy = raw.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/i);
  if (ddmmmyyyy) {
    const m = MON[ddmmmyyyy[2].toUpperCase()] ?? 0;
    return new Date(Number(ddmmmyyyy[3]), m, Number(ddmmmyyyy[1])).toISOString().split('T')[0];
  }
  // MMM DD, YYYY
  const mmmddyyyy = raw.match(/^([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})$/i);
  if (mmmddyyyy) {
    const m = MON[mmmddyyyy[1].toUpperCase()] ?? 0;
    return new Date(Number(mmmddyyyy[3]), m, Number(mmmddyyyy[2])).toISOString().split('T')[0];
  }
  return '';
}

// All known date sub-patterns
const DATE_SUBS = [
  /\d{4}[-/]\d{2}[-/]\d{2}/,                // YYYY-MM-DD / YYYY/MM/DD
  /\d{2}[-/]\d{2}[-/]\d{4}/,                // DD-MM-YYYY / DD/MM/YYYY
  /\d{1,2}\s+[A-Z]{3}\s+\d{4}/i,           // DD MMM YYYY
  /[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}/i,     // MMM DD, YYYY
];

function buildTxRegex(dateSub: RegExp): RegExp {
  const ds = dateSub.source;
  // DATE  DATE  description  amount[-|CR]
  return new RegExp(`^(${ds})\\s+(${ds})\\s+(.+?)\\s+([\\d,]+\\.\\d{2})(-|CR)?\\s*$`, 'i');
}

function buildSingleDateTxRegex(dateSub: RegExp): RegExp {
  const ds = dateSub.source;
  // DATE  description  amount[-|CR]  (some banks have one date column)
  return new RegExp(`^(${ds})\\s+(.+?)\\s+([\\d,]+\\.\\d{2})(-|CR)?\\s*$`, 'i');
}

const SKIP_RE = /^(previous\s+balance|sub\s+total|important|account\s+summary|opening\s+balance|closing\s+balance|new\s+balance|minimum\s+payment|transaction\s+date|posting\s+date|description|amount|credit\s+limit|cashback|payment\s+summary|statement\s+date|worldmiles|total\s+credit|available\s+credit)/i;

export function parseGeneric(lines: string[], bankHint = 'Unknown Bank'): ParsedStatement {
  // Score each date sub-pattern by how many lines it matches as a two-date row
  let bestPattern: RegExp | null = null;
  let bestCount = 0;
  let useSingleDate = false;

  for (const sub of DATE_SUBS) {
    const twoRe = buildTxRegex(sub);
    const oneRe = buildSingleDateTxRegex(sub);
    let twoCount = 0, oneCount = 0;
    for (const line of lines.slice(0, 200)) {
      const t = line.trim();
      if (!t || SKIP_RE.test(t)) continue;
      if (twoRe.test(t)) twoCount++;
      else if (oneRe.test(t)) oneCount++;
    }
    if (twoCount > bestCount) { bestCount = twoCount; bestPattern = sub; useSingleDate = false; }
    if (oneCount > bestCount) { bestCount = oneCount; bestPattern = sub; useSingleDate = true; }
  }

  if (!bestPattern || bestCount < 2) {
    return { bank: bankHint, cardLastFour: '', transactions: [] };
  }

  const txRe = useSingleDate
    ? buildSingleDateTxRegex(bestPattern)
    : buildTxRegex(bestPattern);

  const seen = new Set<string>();
  const transactions: ParsedTransaction[] = [];

  for (const line of lines) {
    const t = line.trim();
    if (!t || SKIP_RE.test(t)) continue;

    const m = t.match(txRe);
    if (!m) continue;

    let date: string, desc: string, amountStr: string, creditMark: string;

    if (useSingleDate) {
      [, date, desc, amountStr, creditMark = ''] = m as string[];
    } else {
      [, date, , desc, amountStr, creditMark = ''] = m as string[];
    }

    const iso = toISO(date);
    if (!iso) continue;

    const amount = parseFloat(amountStr.replace(/,/g, ''));
    if (!amount || amount <= 0) continue;

    const isCredit = creditMark.toUpperCase() === 'CR' || creditMark === '-';

    // Clean description
    const cleanDesc = desc.trim().replace(/\s{2,}/g, ' ');
    const key = `${iso}|${cleanDesc}|${amount}`;
    if (seen.has(key)) continue;
    seen.add(key);

    transactions.push({
      date: iso,
      description: cleanDesc,
      amount,
      isCredit,
      category: detectCategory(cleanDesc),
    });
  }

  return { bank: bankHint, cardLastFour: '', transactions };
}

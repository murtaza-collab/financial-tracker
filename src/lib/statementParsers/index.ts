import type { ParsedStatement } from './types';
import { parseAlfalah } from './alfalah';
import { parseUBL } from './ubl';
import { parseSCBL } from './scbl';
import { parseHBL } from './hbl';
import { parseJSBank } from './jsbank';
import { parseGeneric } from './generic';

export type { ParsedStatement, ParsedTransaction } from './types';

export const SUPPORTED_BANKS = ['Bank Alfalah', 'UBL', 'Standard Chartered', 'HBL', 'JS Bank'];

export function detectBankAndParse(lines: string[]): { result: ParsedStatement; isGeneric: boolean } | null {
  const sample = lines.slice(0, 50).join('\n').toLowerCase();

  if (sample.includes('standard chartered') || sample.includes('scbl') || /550376|5503\s*76/i.test(sample)) {
    return { result: parseSCBL(lines), isGeneric: false };
  }
  if (sample.includes('js bank') || sample.includes('jsbl') || /4770520/i.test(sample)) {
    return { result: parseJSBank(lines), isGeneric: false };
  }
  if ((sample.includes('habib bank') || sample.includes('hbl')) && /490288\*{6}/i.test(sample)) {
    return { result: parseHBL(lines), isGeneric: false };
  }
  if (sample.includes('bank alfalah') || sample.includes('alfalah')) {
    return { result: parseAlfalah(lines), isGeneric: false };
  }
  if (sample.includes('ubl') || sample.includes('united bank') || /4\d{3}\*{4,}\d{4}\s+\d{4}\/\d{2}\/\d{2}/i.test(sample)) {
    return { result: parseUBL(lines), isGeneric: false };
  }
  // HBL fallback (may not have card pattern if redacted differently)
  if (sample.includes('hbl') || sample.includes('habib bank')) {
    return { result: parseHBL(lines), isGeneric: false };
  }

  // Pattern-based fallback detection
  const hasUBLCard = lines.some(l => /^4\d{3}\*+\d{4}\s+\d{4}\/\d{2}\/\d{2}/.test(l.trim()));
  if (hasUBLCard) return { result: parseUBL(lines), isGeneric: false };

  // Generic heuristic fallback — try to parse any bank statement
  const generic = parseGeneric(lines, 'Unknown Bank');
  if (generic.transactions.length > 0) {
    return { result: generic, isGeneric: true };
  }

  return null;
}

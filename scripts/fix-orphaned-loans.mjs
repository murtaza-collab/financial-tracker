/**
 * One-time migration: create loan records for loan_given/loan_received
 * transactions that were added via the Transactions page (before the fix).
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=<your-service-role-key> node scripts/fix-orphaned-loans.mjs
 *
 * Get the service role key from:
 *   Supabase Dashboard → Project Settings → API → service_role secret
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pcwxttlxwfdofeetddmt.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// Extract person name from the transaction note if it follows the Loans-page pattern
function personNameFromNote(note, type) {
  if (!note) return 'Unknown';
  if (type === 'loan_given'    && note.startsWith('Lent to '))       return note.replace('Lent to ', '').trim();
  if (type === 'loan_received' && note.startsWith('Borrowed from ')) return note.replace('Borrowed from ', '').trim();
  return note.trim() || 'Unknown';
}

async function run() {
  // 1. Fetch all loan_given / loan_received transactions
  const { data: txs, error: txErr } = await supabase
    .from('transactions')
    .select('id, user_id, type, amount, date, account_id, note')
    .in('type', ['loan_given', 'loan_received'])
    .order('date', { ascending: true });

  if (txErr) { console.error('Failed to fetch transactions:', txErr.message); process.exit(1); }
  console.log(`Found ${txs.length} loan transaction(s) total.`);

  // 2. Fetch all existing loans
  const { data: loans, error: loanErr } = await supabase
    .from('loans')
    .select('user_id, direction, principal, date, account_id');

  if (loanErr) { console.error('Failed to fetch loans:', loanErr.message); process.exit(1); }
  console.log(`Found ${loans.length} existing loan record(s).`);

  // 3. Build a multiset of loan "fingerprints" so we can match without over-consuming
  //    Key: user_id|direction|amount|date(YYYY-MM-DD)
  //    Value: count of loans with that fingerprint (to handle duplicates correctly)
  const loanFingerprints = new Map();
  for (const l of loans) {
    const dateStr = l.date.slice(0, 10);
    const key = `${l.user_id}|${l.direction}|${l.principal}|${dateStr}`;
    loanFingerprints.set(key, (loanFingerprints.get(key) ?? 0) + 1);
  }

  // 4. Find orphaned transactions — those with no matching loan fingerprint remaining
  const txFingerprints = new Map();
  const orphans = [];

  for (const tx of txs) {
    const direction = tx.type === 'loan_given' ? 'given' : 'taken';
    const dateStr   = tx.date.slice(0, 10);
    const key       = `${tx.user_id}|${direction}|${tx.amount}|${dateStr}`;

    const loanCount = loanFingerprints.get(key) ?? 0;
    const txCount   = txFingerprints.get(key)   ?? 0;

    if (txCount < loanCount) {
      // This transaction is covered by an existing loan — skip
      txFingerprints.set(key, txCount + 1);
    } else {
      // No matching loan left for this transaction
      orphans.push(tx);
    }
  }

  if (orphans.length === 0) {
    console.log('✅  No orphaned transactions found. Everything looks good!');
    return;
  }

  console.log(`\n⚠️  Found ${orphans.length} orphaned loan transaction(s):\n`);
  for (const tx of orphans) {
    console.log(`  [${tx.type}]  ${tx.date.slice(0,10)}  PKR ${tx.amount}  note: "${tx.note ?? ''}"`);
  }

  // 5. Create missing loan records
  const inserts = orphans.map(tx => ({
    user_id:     tx.user_id,
    direction:   tx.type === 'loan_given' ? 'given' : 'taken',
    person_name: personNameFromNote(tx.note, tx.type),
    principal:   tx.amount,
    date:        tx.date.slice(0, 10),
    due_date:    null,
    account_id:  tx.account_id,
    outstanding: tx.amount,
    status:      'active',
    notes:       tx.note || null,
  }));

  const { error: insertErr } = await supabase.from('loans').insert(inserts);
  if (insertErr) {
    console.error('\n❌  Insert failed:', insertErr.message);
    process.exit(1);
  }

  console.log(`\n✅  Created ${inserts.length} loan record(s):`);
  for (const l of inserts) {
    console.log(`  [${l.direction}]  ${l.date}  PKR ${l.principal}  → "${l.person_name}"`);
  }
  console.log('\nDone. You can delete this script after running it.');
}

run();

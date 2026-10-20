import { formatCurrency } from './currency';

// Bank/cash balances hold money you have; a credit card's balance is what you
// owe on it. So money leaving a card (spending) raises its balance, and money
// coming into a card (a payment or refund) lowers it — the opposite of a bank.
export type Flow = 'out' | 'in';

export const isCard = (accountType?: string | null) => accountType === 'credit_card';

export const balanceAfter = (
  balance: number,
  accountType: string | null | undefined,
  flow: Flow,
  amount: number,
): number => {
  const sign = (isCard(accountType) ? 1 : -1) * (flow === 'out' ? 1 : -1);
  return Number(balance) + sign * Number(amount);
};

// Dropdown label: a card's balance is debt, so don't show it like money you have
export const accountOptionLabel = (a: { name: string; type?: string | null; balance: number }) =>
  `${a.name} — ${isCard(a.type) ? `Outstanding: ${formatCurrency(a.balance)}` : formatCurrency(a.balance)}`;

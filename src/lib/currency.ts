export const CURRENCY = {
  symbol: 'Rs.',
  code: 'PKR',
  locale: 'en-PK',
}

export const formatCurrency = (amount: number): string => {
  return `${CURRENCY.symbol} ${Number(amount).toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}
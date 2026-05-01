export interface ParsedTransaction {
  date: string;        // YYYY-MM-DD
  description: string;
  amount: number;
  isCredit: boolean;
  category: string;
}

export interface ParsedStatement {
  bank: string;
  cardLastFour: string;
  transactions: ParsedTransaction[];
}

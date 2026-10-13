export type TransactionType = 'expense' | 'income';

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  category: string;
  type: TransactionType;
  date: string;
  description?: string;
}

export interface Summary {
  totalIncome: number;
  totalExpenses: number;
  net: number;
}
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

/** What the Add Expense form sends. amount is undefined when the box is empty. */
export interface NewExpense {
  title: string;
  amount: number | undefined;
  category: string;
  date: string; // YYYY-MM-DD from the date picker
  description?: string;
}

/** One problem from a 400 response, like { field: 'title', message: 'Title is required' }. */
export interface FieldIssue {
  field: string;
  message: string;
}

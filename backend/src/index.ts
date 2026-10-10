import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4002);

app.use(cors());
app.use(express.json());

const expenseSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  category: z.string().min(1, 'Category is required'),
  type: z.enum(['expense', 'income']).default('expense'),
  date: z.string().optional()
});

const sampleTransactions = [
  { id: 'txn-1', title: 'Groceries', amount: 86.4, category: 'Food', type: 'expense', date: '2026-08-02' },
  { id: 'txn-2', title: 'Paycheck', amount: 2600, category: 'Income', type: 'income', date: '2026-08-01' },
  { id: 'txn-3', title: 'Internet', amount: 54.99, category: 'Bills', type: 'expense', date: '2026-08-04' }
];

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'expense-tracker-backend' });
});

app.get('/api/transactions', (_req, res) => {
  res.json(sampleTransactions);
});

app.get('/api/summary', (_req, res) => {
  const totalExpenses = sampleTransactions
    .filter((item) => item.type === 'expense')
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const totalIncome = sampleTransactions
    .filter((item) => item.type === 'income')
    .reduce((sum, item) => sum + Number(item.amount), 0);

  res.json({ totalIncome, totalExpenses, net: totalIncome - totalExpenses });
});

app.post('/api/transactions', (req, res) => {
  const result = expenseSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ error: 'Invalid expense', issues: result.error.issues });
    return;
  }

  const { title, amount, category, type, date } = result.data;
  const newItem = {
    id: `txn-${Date.now()}`,
    title,
    amount,
    category,
    type,
    date: date ?? new Date().toISOString().slice(0, 10)
  };

  sampleTransactions.push(newItem);
  res.status(201).json(newItem);
});

app.listen(port, () => {
  console.log(`Expense Tracker backend running on http://localhost:${port}`);
});

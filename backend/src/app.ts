import { Prisma, PrismaClient } from '@prisma/client';
import express from 'express';
import cors from 'cors';
import {
  createTransactionSchema,
  updateTransactionSchema,
  type CreateTransactionInput,
  type UpdateTransactionInput
} from './schemas/transaction.js';
import { validateBody } from './middleware/validateBody.js';
import { AUTH_REQUIRED, getAuthUserId, rejectOwnerFields, requireAuth } from './middleware/requireAuth.js';
import { transactionListQuerySchema } from './schemas/transactionQuery.js';
import { buildHealthResponse, type HealthResponse } from './types/health.js';
import { createAuthRouter } from './routes/auth.js';

export const prisma = new PrismaClient();

export const app = express();

app.use(cors());
app.use(express.json());
app.use(createAuthRouter(prisma));

app.use('/api/auth', createAuthRouter(prisma));

app.get('/api/health', (_req, res) => {
  const body: HealthResponse = buildHealthResponse();
  res.json(body);
});

// Every route below needs `Authorization: Bearer <token>` (from POST /api/auth/login).
// The owner is always the token's user: client-supplied owner ids are rejected, never used.

// F26B-10: optional ?category=Dining shows only that category's transactions.
app.get('/api/transactions', requireAuth, async (req, res) => {
  const query = transactionListQuerySchema.safeParse(req.query);
  if (query.success === false) {
    res.status(400).json({
      error: 'Validation failed',
      issues: query.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }))
    });
    return;
  }
  const { category } = query.data;

  try {
    const userId = getAuthUserId(res);
    const transactions = await prisma.transaction.findMany({
      // Without a category this is the same query as before: all of the user's transactions.
      where: { userId, ...(category && { category }) },
      orderBy: { date: 'desc' }
    });
    res.json(transactions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load transactions' });
  }
});

// F26B-10: the categories this user has used, for the filter dropdown (sorted, no duplicates).
app.get('/api/categories', requireAuth, async (_req, res) => {
  try {
    const userId = getAuthUserId(res);
    const rows = await prisma.transaction.findMany({
      where: { userId },
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' }
    });
    res.json(rows.map((row) => row.category));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load categories' });
  }
});

app.get('/api/summary', requireAuth, async (_req, res) => {
  try {
    const userId = getAuthUserId(res);
    const [income, expenses] = await Promise.all([
      prisma.transaction.aggregate({ where: { userId, type: 'income' }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { userId, type: 'expense' }, _sum: { amount: true } })
    ]);
    const totalIncome = income._sum.amount ?? 0;
    const totalExpenses = expenses._sum.amount ?? 0;
    res.json({ totalIncome, totalExpenses, net: totalIncome - totalExpenses });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load summary' });
  }
});

app.post('/api/transactions', requireAuth, rejectOwnerFields, validateBody(createTransactionSchema), async (req, res) => {
  const { title, amount, category, type, date, description } = req.body as CreateTransactionInput;
  try {
    const userId = getAuthUserId(res);
    const created = await prisma.transaction.create({
      data: {
        userId,
        title,
        amount,
        category,
        type,
        date: date ? new Date(date) : new Date(),
        description: description || null
      }
    });
    res.status(201).json(created);
  } catch (error) {
    // A valid token for an account that has since been deleted: there is no user to own the row.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      res.status(401).json({ error: AUTH_REQUIRED });
      return;
    }
    console.error(error);
    res.status(500).json({ error: 'Could not save transaction' });
  }
});

// F26B-32: edit an existing transaction.
app.put('/api/transactions/:id', requireAuth, rejectOwnerFields, validateBody(updateTransactionSchema), async (req, res) => {
  const changes = req.body as UpdateTransactionInput;

  if (Object.keys(changes).length === 0) {
    res.status(400).json({ error: 'Provide at least one field to update' });
    return;
  }

  try {
    const userId = getAuthUserId(res);
    // Another user's transaction gets the same 404 as one that does not exist, so ids can't be probed.
    const existing = await prisma.transaction.findFirst({
      where: { id: String(req.params.id), userId }
    });

    if (!existing) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    const { date, description, ...rest } = changes;
    const updated = await prisma.transaction.update({
      // userId in the filter too, so the update can only ever touch this user's row.
      where: { id: existing.id, userId },
      data: {
        ...rest,
        ...(date !== undefined && { date: new Date(date) }),
        ...(description !== undefined && { description: description || null })
      }
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not update transaction' });
  }
});

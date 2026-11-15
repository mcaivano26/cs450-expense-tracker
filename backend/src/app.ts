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
import { AUTH_REQUIRED_ERROR, getAuthUserId, rejectOwnerFields, requireAuth } from './middleware/requireAuth.js';
import { buildHealthResponse, type HealthResponse } from './types/health.js';
import { createAuthRouter } from './routes/auth.js';

export const prisma = new PrismaClient();

export const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', createAuthRouter(prisma));

// Public: no login needed, and the response holds no user or transaction data (see types/health.ts).
// The old /api/test debug route was removed because it listed every user's name and email to anyone.
app.get('/api/health', (_req, res) => {
  const body: HealthResponse = buildHealthResponse();
  res.json(body);
});

// Every route below needs `Authorization: Bearer <token>` (from POST /api/auth/login).
// The owner is always the token's user: client-supplied owner ids are rejected, never used.

app.get('/api/transactions', requireAuth, async (_req, res) => {
  try {
    const userId = getAuthUserId(res);
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: 'desc' }
    });
    res.json(transactions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load transactions' });
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
      res.status(401).json({ error: AUTH_REQUIRED_ERROR });
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

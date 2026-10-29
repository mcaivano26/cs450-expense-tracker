import { describe, expect, test } from 'vitest';
import request from 'supertest';
import { app } from './app.js';

// These tests need no database: /api/health never touches Postgres, and invalid
// POST bodies are rejected by the Zod validateBody middleware before any Prisma call.

describe('GET /api/health', () => {
  test('reports that the backend is running', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    // toMatchObject, not toEqual: the body also has uptimeSeconds and timestamp, which change every run
    expect(response.body).toMatchObject({ status: 'ok', app: 'expense-tracker-backend' });
    expect(typeof response.body.uptimeSeconds).toBe('number');
    expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false);
  });
});

describe('POST /api/transactions (validation)', () => {
  test('rejects a transaction with no category and says which field is wrong', async () => {
    const response = await request(app)
      .post('/api/transactions')
      .send({ title: 'Coffee', amount: 4.5 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
    expect(response.body.issues).toContainEqual({ field: 'category', message: 'Required' });
  });

  test('rejects an empty title and a negative amount in one response', async () => {
    const response = await request(app)
      .post('/api/transactions')
      .send({ title: '', amount: -5, category: 'Food' });

    expect(response.status).toBe(400);
    const fields = response.body.issues.map((issue: { field: string }) => issue.field);
    expect(fields).toEqual(expect.arrayContaining(['title', 'amount']));
  });

  test('rejects a type that is not expense or income', async () => {
    const response = await request(app)
      .post('/api/transactions')
      .send({ title: 'Coffee', amount: 4.5, category: 'Food', type: 'refund' });

    expect(response.status).toBe(400);
    expect(response.body.issues[0].field).toBe('type');
  });
});

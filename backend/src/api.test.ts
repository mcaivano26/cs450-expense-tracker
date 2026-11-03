import { describe, expect, test } from 'vitest';
import request from 'supertest';
import { app } from './app.js';

describe('GET /api/health', () => {
  test('reports that the backend is running', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});

describe('POST /api/transactions', () => {
  test('rejects an empty transaction with 400', async () => {
    const response = await request(app).post('/api/transactions').send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });
});

describe('PUT /api/transactions/:id', () => {
  test('rejects invalid data with 400', async () => {
    const response = await request(app)
      .put('/api/transactions/any-id')
      .send({ amount: 'not-a-number' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });

  test('rejects an empty update with 400', async () => {
    const response = await request(app).put('/api/transactions/any-id').send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Provide at least one field to update');
  });

  test('returns 404 for a transaction that does not exist', async () => {
    const response = await request(app)
      .put('/api/transactions/does-not-exist')
      .send({ title: 'Coffee' });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Transaction not found');
  });
});

describe('amount boundary (PUT /api/transactions/:id)', () => {
  test('rejects an amount just over the 1,000,000 limit', async () => {
    const response = await request(app)
      .put('/api/transactions/any-id')
      .send({ amount: 1_000_001 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });

  test('accepts an amount of exactly 1,000,000 (passes validation)', async () => {
    const response = await request(app)
      .put('/api/transactions/does-not-exist')
      .send({ amount: 1_000_000 });

    // Validation passed, so the request reaches the lookup and gets 404, not 400.
    expect(response.status).toBe(404);
  });
});

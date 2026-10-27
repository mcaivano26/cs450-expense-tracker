import { describe, expect, test } from 'vitest';
import request from 'supertest';
import { app } from './app.js';

describe('GET /api/health', () => {
  test('reports that the backend is running', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', app: 'expense-tracker-backend' });
  });
});

describe('POST /api/transaction', () => {
  test('Returns item posted', async () => {
    const testItem = {
        title: "Coffee",
        amount: 4.5,
        category: "Food",
        type: "expense"
    }
    const response = await request(app).post('/api/transactions').send(testItem);
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject(testItem);
  });
});
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
    expect(response.body.error).toBe('Invalid request body');
  });
});
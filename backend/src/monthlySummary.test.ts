import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { app, prisma } from './app.js';
import { currentMonth, monthRange } from './schemas/monthQuery.js';
import { bearerFor, createTestUser, deleteTestUsers, type TestUser } from './testUsers.js';

// F26B-7: monthly summary cards (GET /api/summary/monthly).

describe('month helpers', () => {
  test('monthRange covers the whole month in UTC, up to (not including) the next month', () => {
    const { start, end } = monthRange('2026-11');
    expect(start.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });

  test('December rolls over into January of the next year', () => {
    expect(monthRange('2026-12').end.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  test('currentMonth formats a date as YYYY-MM in UTC', () => {
    expect(currentMonth(new Date('2026-11-15T20:00:00Z'))).toBe('2026-11');
  });
});

describe('GET /api/summary/monthly rejects a bad month with 400', () => {
  // A signed token is enough: the month is checked before the database is used.
  const authorization = bearerFor({ id: 'monthly-test-user', email: 'monthly-test@example.com' });

  test.each(['2026-13', '2026-1', 'November', '2026-11-01'])('month=%s', async (month) => {
    const response = await request(app).get('/api/summary/monthly').set('Authorization', authorization).query({ month });

    expect(response.status).toBe(400);
    expect(response.body.issues[0]).toEqual({ field: 'month', message: 'Month must look like 2026-11 (year-month)' });
  });

  test('needs a login like the other summary route (401)', async () => {
    const response = await request(app).get('/api/summary/monthly').query({ month: '2026-11' });
    expect(response.status).toBe(401);
  });
});

const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true, () => false);
const TEST_EMAIL_DOMAIN = 'monthly-test.example';

describe.runIf(dbAvailable)('Monthly summary totals (PostgreSQL)', () => {
  let owner: TestUser;
  let otherUser: TestUser;

  beforeAll(async () => {
    owner = await createTestUser(prisma, TEST_EMAIL_DOMAIN, 'owner');
    otherUser = await createTestUser(prisma, TEST_EMAIL_DOMAIN, 'other');

    const row = (userId: string, title: string, amount: number, type: string, date: string) => ({
      userId, title, amount, type, category: 'Test', date: new Date(date)
    });
    await prisma.transaction.createMany({
      data: [
        // November 2026, including the first and last moment of the month
        row(owner.id, 'Paycheck', 2000, 'income', '2026-11-01T00:00:00.000Z'),
        row(owner.id, 'Groceries', 50, 'expense', '2026-11-15T12:00:00.000Z'),
        row(owner.id, 'Late snack', 25.5, 'expense', '2026-11-30T23:59:59.999Z'),
        // Just outside November: must not be counted
        row(owner.id, 'October bill', 100, 'expense', '2026-10-31T23:59:59.999Z'),
        row(owner.id, 'December bill', 300, 'expense', '2026-12-01T00:00:00.000Z'),
        // Another user's November transaction: must never be counted
        row(otherUser.id, 'Other user paycheck', 9999, 'income', '2026-11-10T12:00:00.000Z')
      ]
    });
  });

  afterAll(async () => {
    await deleteTestUsers(prisma, TEST_EMAIL_DOMAIN);
  });

  const summaryFor = (month?: string) => {
    const req = request(app).get('/api/summary/monthly').set('Authorization', owner.authorization);
    return month === undefined ? req : req.query({ month });
  };

  test("totals only the selected month's transactions, including the first and last moment", async () => {
    const response = await summaryFor('2026-11');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      month: '2026-11',
      totalIncome: 2000,
      totalExpenses: 75.5,
      net: 1924.5,
      transactionCount: 3
    });
  });

  test("another user's transactions in the same month are not counted", async () => {
    const response = await summaryFor('2026-11');
    expect(response.body.totalIncome).toBe(2000);
  });

  test('a different month gets its own totals', async () => {
    const response = await summaryFor('2026-10');
    expect(response.body).toMatchObject({ totalIncome: 0, totalExpenses: 100, net: -100, transactionCount: 1 });
  });

  test('a month with no transactions returns zero totals', async () => {
    const response = await summaryFor('2025-01');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ month: '2025-01', totalIncome: 0, totalExpenses: 0, net: 0, transactionCount: 0 });
  });

  test('no month means the current month', async () => {
    const response = await summaryFor();
    expect(response.body.month).toBe(currentMonth());
  });

  test('adding a transaction in the month updates the totals', async () => {
    const before = (await summaryFor('2026-11')).body;

    await request(app)
      .post('/api/transactions')
      .set('Authorization', owner.authorization)
      .send({ title: 'Coffee', amount: 4.5, category: 'Dining', type: 'expense', date: '2026-11-20T12:00:00Z' });

    const after = (await summaryFor('2026-11')).body;
    expect(after.totalExpenses).toBeCloseTo(before.totalExpenses + 4.5, 2);
    expect(after.net).toBeCloseTo(before.net - 4.5, 2);
    expect(after.transactionCount).toBe(before.transactionCount + 1);
  });
});

if (dbAvailable === false) {
  describe('Monthly summary totals (PostgreSQL)', () => {
    test.skip('skipped: PostgreSQL is not running (start it with docker compose up -d)', () => {});
  });
}

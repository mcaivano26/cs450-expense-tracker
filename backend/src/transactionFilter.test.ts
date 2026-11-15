import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { app, prisma } from './app.js';
import { bearerFor, createTestUser, deleteTestUsers, type TestUser } from './testUsers.js';

// F26B-10: filter transactions by category.

describe('GET /api/transactions rejects a bad category filter with 400', () => {
  // A signed token is enough here: the query is checked before the database is used,
  // so these run without PostgreSQL too.
  const authorization = bearerFor({ id: 'filter-test-user', email: 'filter-test@example.com' });

  test('a category longer than 50 characters', async () => {
    const response = await request(app)
      .get('/api/transactions')
      .set('Authorization', authorization)
      .query({ category: 'a'.repeat(51) });

    expect(response.status).toBe(400);
    expect(response.body.issues[0]).toEqual({ field: 'category', message: 'Category must be 50 characters or fewer' });
  });

  test('more than one category (?category=A&category=B)', async () => {
    const response = await request(app)
      .get('/api/transactions?category=Rent&category=Dining')
      .set('Authorization', authorization);

    expect(response.status).toBe(400);
    expect(response.body.issues[0].field).toBe('category');
  });

  test('GET /api/categories needs a login like the other transaction routes (401)', async () => {
    const response = await request(app).get('/api/categories');
    expect(response.status).toBe(401);
  });
});

const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true, () => false);
const TEST_EMAIL_DOMAIN = 'filter-test.example';

describe.runIf(dbAvailable)('Filtering transactions by category (PostgreSQL)', () => {
  let owner: TestUser;
  let otherUser: TestUser;

  beforeAll(async () => {
    owner = await createTestUser(prisma, TEST_EMAIL_DOMAIN, 'owner');
    otherUser = await createTestUser(prisma, TEST_EMAIL_DOMAIN, 'other');

    const base = { amount: 10, type: 'expense', date: new Date('2026-11-01T12:00:00Z') };
    await prisma.transaction.createMany({
      data: [
        { ...base, userId: owner.id, title: 'Lunch', category: 'Dining' },
        { ...base, userId: owner.id, title: 'Coffee', category: 'Dining' },
        { ...base, userId: owner.id, title: 'Monthly rent', category: 'Rent' },
        // Another user's Dining transaction must never show up in the owner's filtered list.
        { ...base, userId: otherUser.id, title: 'Other user dinner', category: 'Dining' }
      ]
    });
  });

  afterAll(async () => {
    await deleteTestUsers(prisma, TEST_EMAIL_DOMAIN);
  });

  const list = (category?: string) => {
    const req = request(app).get('/api/transactions').set('Authorization', owner.authorization);
    return category === undefined ? req : req.query({ category });
  };
  const titles = (body: { title: string }[]) => body.map((t) => t.title).sort();

  test("a selected category returns only the user's matching transactions", async () => {
    const response = await list('Dining');

    expect(response.status).toBe(200);
    expect(titles(response.body)).toEqual(['Coffee', 'Lunch']);
  });

  test('no category ("All") returns all of the user\'s transactions', async () => {
    const response = await list();
    expect(titles(response.body)).toEqual(['Coffee', 'Lunch', 'Monthly rent']);
  });

  test('an empty category (?category=) is treated as "All"', async () => {
    const response = await list('');
    expect(response.body).toHaveLength(3);
  });

  test('spaces around the category are ignored', async () => {
    const response = await list('  Rent  ');
    expect(titles(response.body)).toEqual(['Monthly rent']);
  });

  test('a category with no transactions returns 200 and an empty list', async () => {
    const response = await list('Travel');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  test("GET /api/categories lists the user's categories once each, sorted", async () => {
    const response = await request(app).get('/api/categories').set('Authorization', owner.authorization);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(['Dining', 'Rent']);
  });

  test("GET /api/categories does not include another user's categories", async () => {
    await prisma.transaction.create({
      data: { userId: otherUser.id, title: 'Flight', amount: 300, category: 'Travel', type: 'expense', date: new Date() }
    });

    const response = await request(app).get('/api/categories').set('Authorization', owner.authorization);
    expect(response.body).not.toContain('Travel');
  });
});

if (dbAvailable === false) {
  describe('Filtering transactions by category (PostgreSQL)', () => {
    test.skip('skipped: PostgreSQL is not running (start it with docker compose up -d)', () => {});
  });
}

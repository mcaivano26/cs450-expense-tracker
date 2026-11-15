import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { app, prisma } from './app.js';
import { getJwtSecret } from './auth.js';
import { AUTH_REQUIRED } from './middleware/requireAuth.js';
import { createTestUser, deleteTestUsers, type TestUser } from './testUsers.js';

// Transaction routes use the logged-in user's id from their token: list, create, edit and summary only ever
// see or change that user's rows, owner ids sent by the client are rejected, and health stays public.
// The 401 and health tests need no database. The ownership tests need it (docker compose up -d) and are
// skipped when it is not running.

const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true, () => false);
const TEST_EMAIL_DOMAIN = 'ownership-test.example';

const VALID_TRANSACTION = {
  title: 'Ownership test coffee',
  amount: 4.5,
  category: 'Dining',
  type: 'expense',
  date: '2026-10-01T12:00:00Z'
};

type Transaction = { id: string; userId: string; title: string; amount: number; type: string };

describe('GET /api/health stays public', () => {
  test('works without a token', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
  });

  test('returns only status fields, no user or transaction data', async () => {
    const response = await request(app).get('/api/health');

    expect(Object.keys(response.body).sort()).toEqual(['app', 'status', 'timestamp', 'uptimeSeconds']);
  });
});

describe('transaction routes reject requests without a valid token (401)', () => {
  const someone = { id: 'someone', email: 'someone@example.com' };
  const nowSeconds = () => Math.floor(Date.now() / 1000);

  const badAuthorizations: [string, () => string | undefined][] = [
    ['no Authorization header', () => undefined],
    ['a non-Bearer scheme', () => 'Basic dXNlcjpwYXNz'],
    ['Bearer with no token', () => 'Bearer '],
    ['a token that is not a JWT', () => 'Bearer not-a-real-token'],
    ['a token signed with a different secret', () => `Bearer ${jwt.sign({ email: someone.email }, 'wrong-secret', { subject: someone.id })}`],
    [
      'an expired token',
      () => `Bearer ${jwt.sign({ email: someone.email, exp: nowSeconds() - 10 }, getJwtSecret(), { subject: someone.id })}`
    ],
    ['an unsigned token (alg "none")', () => `Bearer ${jwt.sign({ email: someone.email }, '', { subject: someone.id, algorithm: 'none' })}`],
    ['a token with no user id (sub)', () => `Bearer ${jwt.sign({ email: someone.email }, getJwtSecret())}`]
  ];

  const routes: [string, (auth: string | undefined) => request.Test][] = [
    ['GET /api/transactions', (auth) => withAuth(request(app).get('/api/transactions'), auth)],
    ['GET /api/summary', (auth) => withAuth(request(app).get('/api/summary'), auth)],
    ['POST /api/transactions', (auth) => withAuth(request(app).post('/api/transactions'), auth).send(VALID_TRANSACTION)],
    ['PUT /api/transactions/:id', (auth) => withAuth(request(app).put('/api/transactions/any-id'), auth).send({ title: 'Changed' })]
  ];

  function withAuth(req: request.Test, authorization: string | undefined): request.Test {
    return authorization === undefined ? req : req.set('Authorization', authorization);
  }

  describe.each(routes)('%s', (_route, send) => {
    test.each(badAuthorizations)('rejects %s', async (_label, authorization) => {
      const response = await send(authorization());

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: AUTH_REQUIRED });
    });
  });

  test('checks the token before validating the body (401, not 400)', async () => {
    const response = await request(app).post('/api/transactions').send({});

    expect(response.status).toBe(401);
  });
});

describe.runIf(dbAvailable)('transactions belong to the logged-in user (PostgreSQL)', () => {
  let alice: TestUser;
  let bob: TestUser;

  beforeAll(async () => {
    alice = await createTestUser(prisma, TEST_EMAIL_DOMAIN, 'alice');
    bob = await createTestUser(prisma, TEST_EMAIL_DOMAIN, 'bob');
  });

  afterAll(async () => {
    await deleteTestUsers(prisma, TEST_EMAIL_DOMAIN);
  });

  async function createAs(user: TestUser, overrides: object = {}): Promise<Transaction> {
    const response = await request(app)
      .post('/api/transactions')
      .set('Authorization', user.authorization)
      .send({ ...VALID_TRANSACTION, ...overrides });
    expect(response.status).toBe(201);
    return response.body as Transaction;
  }

  describe('list', () => {
    test("shows only the logged-in user's transactions", async () => {
      const mine = await createAs(alice, { title: 'Alice list item' });
      const theirs = await createAs(bob, { title: 'Bob list item' });

      const response = await request(app).get('/api/transactions').set('Authorization', alice.authorization);

      expect(response.status).toBe(200);
      const ids = (response.body as Transaction[]).map((t) => t.id);
      expect(ids).toContain(mine.id);
      expect(ids).not.toContain(theirs.id);
      expect((response.body as Transaction[]).every((t) => t.userId === alice.id)).toBe(true);
    });

    test('ignores a userId in the query string', async () => {
      const theirs = await createAs(bob, { title: 'Bob query item' });

      const response = await request(app)
        .get(`/api/transactions?userId=${bob.id}`)
        .set('Authorization', alice.authorization);

      expect(response.status).toBe(200);
      expect((response.body as Transaction[]).map((t) => t.id)).not.toContain(theirs.id);
    });
  });

  describe('create', () => {
    test('saves the transaction under the logged-in user', async () => {
      const created = await createAs(alice);

      const saved = await prisma.transaction.findUniqueOrThrow({ where: { id: created.id } });
      expect(saved.userId).toBe(alice.id);
    });

    test('rejects a client-supplied userId with 400 and saves nothing', async () => {
      const title = `Owner spoof ${Date.now()}`;

      const response = await request(app)
        .post('/api/transactions')
        .set('Authorization', alice.authorization)
        .send({ ...VALID_TRANSACTION, title, userId: bob.id });

      expect(response.status).toBe(400);
      expect(response.body.issues).toContainEqual(expect.objectContaining({ field: 'userId' }));
      expect(await prisma.transaction.count({ where: { title } })).toBe(0);
    });

    test('rejects a client-supplied user relation with 400', async () => {
      const response = await request(app)
        .post('/api/transactions')
        .set('Authorization', alice.authorization)
        .send({ ...VALID_TRANSACTION, user: { connect: { id: bob.id } } });

      expect(response.status).toBe(400);
      expect(response.body.issues).toContainEqual(expect.objectContaining({ field: 'user' }));
    });

    test('a valid token for a deleted account gets 401', async () => {
      const ghost = await createTestUser(prisma, TEST_EMAIL_DOMAIN, 'ghost');
      await prisma.user.delete({ where: { id: ghost.id } });

      const response = await request(app)
        .post('/api/transactions')
        .set('Authorization', ghost.authorization)
        .send(VALID_TRANSACTION);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: AUTH_REQUIRED });
    });
  });

  describe('edit', () => {
    test("cannot edit another user's transaction: 404, and the row is unchanged", async () => {
      const theirs = await createAs(bob, { title: 'Bob original', amount: 10 });

      const response = await request(app)
        .put(`/api/transactions/${theirs.id}`)
        .set('Authorization', alice.authorization)
        .send({ title: 'Hijacked', amount: 999 });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Transaction not found' });
      const saved = await prisma.transaction.findUniqueOrThrow({ where: { id: theirs.id } });
      expect(saved).toMatchObject({ userId: bob.id, title: 'Bob original', amount: 10 });
    });

    test("another user's transaction looks the same as one that does not exist", async () => {
      const theirs = await createAs(bob);

      const [othersRow, missingRow] = await Promise.all([
        request(app).put(`/api/transactions/${theirs.id}`).set('Authorization', alice.authorization).send({ title: 'X' }),
        request(app).put('/api/transactions/does-not-exist').set('Authorization', alice.authorization).send({ title: 'X' })
      ]);

      expect(othersRow.status).toBe(missingRow.status);
      expect(othersRow.body).toEqual(missingRow.body);
    });

    test('rejects moving a transaction to another user with 400, and the owner is unchanged', async () => {
      const mine = await createAs(alice);

      const response = await request(app)
        .put(`/api/transactions/${mine.id}`)
        .set('Authorization', alice.authorization)
        .send({ title: 'Moved?', userId: bob.id });

      expect(response.status).toBe(400);
      expect(response.body.issues).toContainEqual(expect.objectContaining({ field: 'userId' }));
      const saved = await prisma.transaction.findUniqueOrThrow({ where: { id: mine.id } });
      expect(saved.userId).toBe(alice.id);
      expect(saved.title).toBe(mine.title);
    });

    test('the owner can still edit their own transaction', async () => {
      const mine = await createAs(alice);

      const response = await request(app)
        .put(`/api/transactions/${mine.id}`)
        .set('Authorization', alice.authorization)
        .send({ title: 'Alice edited' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ id: mine.id, userId: alice.id, title: 'Alice edited' });
    });
  });

  describe('summary', () => {
    test("totals only the logged-in user's transactions", async () => {
      // Fresh users, so the expected totals are exact.
      const carol = await createTestUser(prisma, TEST_EMAIL_DOMAIN, 'carol');
      const dave = await createTestUser(prisma, TEST_EMAIL_DOMAIN, 'dave');
      await createAs(carol, { type: 'income', amount: 100 });
      await createAs(carol, { type: 'expense', amount: 40 });
      await createAs(dave, { type: 'income', amount: 999 });
      await createAs(dave, { type: 'expense', amount: 500 });

      const carolSummary = await request(app).get('/api/summary').set('Authorization', carol.authorization);
      const daveSummary = await request(app).get('/api/summary').set('Authorization', dave.authorization);

      expect(carolSummary.status).toBe(200);
      expect(carolSummary.body).toEqual({ totalIncome: 100, totalExpenses: 40, net: 60 });
      expect(daveSummary.body).toEqual({ totalIncome: 999, totalExpenses: 500, net: 499 });
    });

    test('a user with no transactions gets zero totals', async () => {
      const erin = await createTestUser(prisma, TEST_EMAIL_DOMAIN, 'erin');

      const response = await request(app).get('/api/summary').set('Authorization', erin.authorization);

      expect(response.body).toEqual({ totalIncome: 0, totalExpenses: 0, net: 0 });
    });
  });
});

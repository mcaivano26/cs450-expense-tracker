import { afterAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import { app, prisma } from '../app.js';
import { verifyPassword } from '../auth/password.js';

// F26B-59: POST /api/auth/register against the real PostgreSQL database.
// Skipped when the database is not running (start it with docker compose up -d).

const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true, () => false);

// Every test user's email ends with this, so afterAll can remove them all.
const TEST_DOMAIN = '@f26b-59.test';
let counter = 0;
const uniqueEmail = () => `user${Date.now()}${counter++}${TEST_DOMAIN}`;

describe.runIf(dbAvailable)('POST /api/auth/register (PostgreSQL)', () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_DOMAIN } } });
  });

  test('creates the user and returns 201 with only id, name and email', async () => {
    const email = uniqueEmail();
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Sharon', email, password: 'correct horse' });

    expect(response.status).toBe(201);
    expect(Object.keys(response.body).sort()).toEqual(['email', 'id', 'name']);
    expect(response.body).toMatchObject({ name: 'Sharon', email });
    expect(JSON.stringify(response.body)).not.toContain('correct horse');
  });

  test('stores a bcrypt hash in the database, never the password', async () => {
    const email = uniqueEmail();
    await request(app).post('/api/auth/register').send({ name: 'Sharon', email, password: 'correct horse' });

    const saved = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(saved.passwordHash).not.toBe('correct horse');
    expect(saved.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(await verifyPassword('correct horse', saved.passwordHash ?? '')).toBe(true);
  });

  test('saves the email normalized (trimmed and lowercase)', async () => {
    const email = uniqueEmail();
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Sharon', email: `  ${email.toUpperCase()} `, password: 'correct horse' });

    expect(response.status).toBe(201);
    expect(response.body.email).toBe(email);
  });

  test('a duplicate email, even with different case or spaces, returns 409', async () => {
    const email = uniqueEmail();
    await request(app).post('/api/auth/register').send({ name: 'First', email, password: 'correct horse' });

    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Second', email: ` ${email.toUpperCase()}`, password: 'another password' });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: 'An account with this email already exists' });
    expect(await prisma.user.count({ where: { email } })).toBe(1);
  });

  test('invalid input returns 400 with field errors and creates no user', async () => {
    const before = await prisma.user.count();
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: '', email: 'not-an-email', password: 'short' });

    expect(response.status).toBe(400);
    const fields = response.body.issues.map((issue: { field: string }) => issue.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'password']));
    expect(await prisma.user.count()).toBe(before);
  });

  test('GET /api/test never includes password hashes', async () => {
    const email = uniqueEmail();
    await request(app).post('/api/auth/register').send({ name: 'Sharon', email, password: 'correct horse' });

    const response = await request(app).get('/api/test');
    expect(response.status).toBe(200);
    for (const user of response.body) {
      expect(user).not.toHaveProperty('passwordHash');
    }
  });
});

if (dbAvailable === false) {
  describe('POST /api/auth/register (PostgreSQL)', () => {
    test.skip('skipped: PostgreSQL is not running (start it with docker compose up -d)', () => {});
  });
}

import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, describe, expect, test } from 'vitest';
import { app, prisma } from './app.js';
import { BCRYPT_ROUNDS, JWT_ALGORITHM, TOKEN_TTL_SECONDS, getJwtSecret } from './auth.js';
import { DUPLICATE_EMAIL_ERROR, INVALID_LOGIN_ERROR } from './routes/auth.js';

// Registration and login: HTTP request -> Zod validation -> bcrypt / JWT -> Prisma -> PostgreSQL.
// The validation tests need no database. The rest need it (docker compose up -d) and are skipped when it is not running.
// JWT_SECRET for tests comes from vitest.config.ts.

const dbAvailable = await prisma.$queryRaw`SELECT 1`.then(() => true, () => false);

// Every account these tests create uses this domain, so afterAll can remove exactly those rows.
const TEST_EMAIL_DOMAIN = 'auth-test.example';
const PASSWORD = 'correct-horse-42';

function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@${TEST_EMAIL_DOMAIN}`;
}

function register(body: object) {
  return request(app).post('/api/auth/register').send(body);
}

function login(body: object) {
  return request(app).post('/api/auth/login').send(body);
}

async function registerUser(overrides: { name?: string; email?: string; password?: string } = {}) {
  const body = { name: 'Auth Test User', email: uniqueEmail('user'), password: PASSWORD, ...overrides };
  const response = await register(body);
  expect(response.status).toBe(201);
  return { body, user: response.body.user as { id: string; name: string; email: string } };
}

describe('POST /api/auth/register rejects invalid data with 400', () => {
  const valid = { name: 'Auth Test User', email: `valid@${TEST_EMAIL_DOMAIN}`, password: PASSWORD };

  test.each([
    ['an empty body', {}, 'email'],
    ['a missing name', { email: valid.email, password: valid.password }, 'name'],
    ['a name of only spaces', { ...valid, name: '   ' }, 'name'],
    ['a name over 100 characters', { ...valid, name: 'a'.repeat(101) }, 'name'],
    ['a missing email', { name: valid.name, password: valid.password }, 'email'],
    ['a malformed email', { ...valid, email: 'not-an-email' }, 'email'],
    ['an email that is not text', { ...valid, email: 12345 }, 'email'],
    ['a missing password', { name: valid.name, email: valid.email }, 'password'],
    ['a 7-character password', { ...valid, password: 'short12' }, 'password'],
    ['a password over 72 bytes', { ...valid, password: 'a'.repeat(73) }, 'password'],
    ['a password that is not text', { ...valid, password: 12345678 }, 'password']
  ])('rejects %s', async (_label, body, field) => {
    const response = await register(body);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
    expect(response.body.issues.map((issue: { field: string }) => issue.field)).toContain(field);
    expect(response.body).not.toHaveProperty('user');
  });
});

describe.runIf(dbAvailable)('Registration and login (PostgreSQL)', () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } } });
  });

  describe('valid registration', () => {
    test('creates the user and returns 201 with id, name and normalized email', async () => {
      const email = uniqueEmail('New.User');
      const response = await register({ name: '  Ana Lopez  ', email: `  ${email.toUpperCase()}  `, password: PASSWORD });

      expect(response.status).toBe(201);
      expect(response.body.user).toEqual({ id: expect.any(String), name: 'Ana Lopez', email: email.toLowerCase() });

      const saved = await prisma.user.findUniqueOrThrow({ where: { id: response.body.user.id } });
      expect(saved.name).toBe('Ana Lopez');
      expect(saved.email).toBe(email.toLowerCase());
    });

    test('accepts a password of exactly 8 characters (lower boundary)', async () => {
      const response = await register({ name: 'Boundary', email: uniqueEmail('min-pw'), password: '12345678' });

      expect(response.status).toBe(201);
    });

    test('a newly registered user can log in', async () => {
      const { body } = await registerUser();

      const response = await login({ email: body.email, password: body.password });

      expect(response.status).toBe(200);
    });
  });

  describe('invalid registration data is not saved', () => {
    test('a rejected registration creates no user', async () => {
      const email = uniqueEmail('rejected');

      const response = await register({ name: 'Rejected', email, password: 'short12' });

      expect(response.status).toBe(400);
      expect(await prisma.user.count({ where: { email } })).toBe(0);
    });
  });

  describe('password hash secrecy', () => {
    test('stores a salted bcrypt hash, never the plain password', async () => {
      const { user } = await registerUser();

      const saved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

      expect(saved.passwordHash).not.toBeNull();
      expect(saved.passwordHash).not.toBe(PASSWORD);
      expect(saved.passwordHash).not.toContain(PASSWORD);
      expect(saved.passwordHash).toMatch(new RegExp(`^\\$2[aby]\\$${BCRYPT_ROUNDS}\\$`));
      expect(await bcrypt.compare(PASSWORD, saved.passwordHash as string)).toBe(true);
    });

    test('two users with the same password get different hashes', async () => {
      const first = await registerUser();
      const second = await registerUser();

      const [a, b] = await Promise.all([
        prisma.user.findUniqueOrThrow({ where: { id: first.user.id } }),
        prisma.user.findUniqueOrThrow({ where: { id: second.user.id } })
      ]);

      expect(a.passwordHash).not.toBe(b.passwordHash);
    });

    test('register and login responses contain neither the password nor its hash', async () => {
      const { body, user } = await registerUser();
      const saved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      const loginResponse = await login({ email: body.email, password: body.password });

      expect(user).not.toHaveProperty('passwordHash');
      expect(loginResponse.body).not.toHaveProperty('passwordHash');
      expect(loginResponse.body).not.toHaveProperty('user.passwordHash');

      for (const text of [JSON.stringify(user), loginResponse.text]) {
        expect(text).not.toContain(PASSWORD);
        expect(text).not.toContain(saved.passwordHash);
      }
    });

    test('GET /api/test lists users without password hashes', async () => {
      const { user } = await registerUser();
      const saved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

      const response = await request(app).get('/api/test');

      expect(response.status).toBe(200);
      expect(response.text).not.toContain('passwordHash');
      expect(response.text).not.toContain(saved.passwordHash);
    });
  });

  describe('duplicate normalized email', () => {
    test('rejects the same email with different case and spaces with 409, keeping one account', async () => {
      const email = uniqueEmail('dup');
      await registerUser({ email });

      const response = await register({ name: 'Second', email: `  ${email.toUpperCase()} `, password: 'another-password-9' });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: DUPLICATE_EMAIL_ERROR });
      expect(await prisma.user.count({ where: { email: { equals: email, mode: 'insensitive' } } })).toBe(1);
    });

    test('the rejected duplicate does not change the original password', async () => {
      const email = uniqueEmail('dup-keep');
      await registerUser({ email });
      await register({ name: 'Second', email: email.toUpperCase(), password: 'another-password-9' });

      expect((await login({ email, password: PASSWORD })).status).toBe(200);
      expect((await login({ email, password: 'another-password-9' })).status).toBe(401);
    });
  });

  describe('JWT issuance and expiry', () => {
    test('a successful login returns a signed HS256 token for that user', async () => {
      const { body, user } = await registerUser();

      // Login normalizes the email the same way registration does.
      const response = await login({ email: ` ${body.email.toUpperCase()} `, password: body.password });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ token: expect.any(String), tokenType: 'Bearer', expiresIn: TOKEN_TTL_SECONDS });

      const header = jwt.decode(response.body.token, { complete: true })?.header;
      expect(header?.alg).toBe(JWT_ALGORITHM);

      const payload = jwt.verify(response.body.token, getJwtSecret(), { algorithms: [JWT_ALGORITHM] }) as jwt.JwtPayload;
      expect(payload.sub).toBe(user.id);
      expect(payload.email).toBe(user.email);
    });

    test('the token expires one hour after it is issued', async () => {
      const { body } = await registerUser();
      const before = Math.floor(Date.now() / 1000);

      const response = await login({ email: body.email, password: body.password });
      const payload = jwt.decode(response.body.token) as jwt.JwtPayload;

      expect(payload.iat).toBeGreaterThanOrEqual(before - 1);
      expect(payload.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 1);
      expect((payload.exp as number) - (payload.iat as number)).toBe(TOKEN_TTL_SECONDS);
    });

    test('the token is accepted one second before expiry and rejected at expiry', async () => {
      const { body } = await registerUser();
      const response = await login({ email: body.email, password: body.password });
      const { exp } = jwt.decode(response.body.token) as jwt.JwtPayload;
      const verifyAt = (clockTimestamp: number) =>
        jwt.verify(response.body.token, getJwtSecret(), { algorithms: [JWT_ALGORITHM], clockTimestamp });

      expect(() => verifyAt((exp as number) - 1)).not.toThrow();
      expect(() => verifyAt(exp as number)).toThrow(jwt.TokenExpiredError);
    });

    test('the token is rejected when checked with a different secret', async () => {
      const { body } = await registerUser();
      const response = await login({ email: body.email, password: body.password });

      expect(() => jwt.verify(response.body.token, 'some-other-secret', { algorithms: [JWT_ALGORITHM] })).toThrow(
        jwt.JsonWebTokenError
      );
    });
  });

  describe('generic 401 for failed login', () => {
    test('an unknown email gets 401 with the generic message and no token', async () => {
      const response = await login({ email: uniqueEmail('nobody'), password: PASSWORD });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: INVALID_LOGIN_ERROR });
    });

    test('a wrong password gets 401 with the generic message and no token', async () => {
      const { body } = await registerUser();

      const response = await login({ email: body.email, password: 'wrong-password-1' });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: INVALID_LOGIN_ERROR });
    });

    test('unknown email and wrong password responses are identical', async () => {
      const { body } = await registerUser();

      const unknownEmail = await login({ email: uniqueEmail('nobody'), password: PASSWORD });
      const wrongPassword = await login({ email: body.email, password: 'wrong-password-1' });

      expect(wrongPassword.status).toBe(unknownEmail.status);
      expect(wrongPassword.body).toEqual(unknownEmail.body);
      expect(wrongPassword.headers['content-type']).toBe(unknownEmail.headers['content-type']);
    });

    test('an account with no password (like the demo user) cannot log in', async () => {
      const email = uniqueEmail('no-password');
      await prisma.user.create({ data: { name: 'No Password', email } });

      const response = await login({ email, password: PASSWORD });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: INVALID_LOGIN_ERROR });
    });
  });
});

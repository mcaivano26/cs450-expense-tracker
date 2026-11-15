import { describe, expect, test } from 'vitest';
import { registerSchema } from './auth.js';

// F26B-59: unit tests for the registration rules. No database needed.

const valid = { name: 'Sharon', email: 'sharon@example.com', password: 'correct horse' };

describe('registerSchema', () => {
  test('accepts a valid registration', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  test('normalizes the email: trims spaces and lowercases it', () => {
    const result = registerSchema.parse({ ...valid, email: '  Sharon@Example.COM ' });
    expect(result.email).toBe('sharon@example.com');
  });

  test('trims the name', () => {
    expect(registerSchema.parse({ ...valid, name: '  Sharon  ' }).name).toBe('Sharon');
  });

  test('does not trim or change the password', () => {
    expect(registerSchema.parse({ ...valid, password: ' pass word ' }).password).toBe(' pass word ');
  });

  test('rejects an invalid email', () => {
    const result = registerSchema.safeParse({ ...valid, email: 'not-an-email' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(['email']);
  });

  test('boundary: a 7-character password is rejected, 8 is accepted', () => {
    expect(registerSchema.safeParse({ ...valid, password: '1234567' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, password: '12345678' }).success).toBe(true);
  });

  test('boundary: a 72-byte password is accepted, 73 is rejected (bcrypt limit)', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'a'.repeat(72) }).success).toBe(true);
    expect(registerSchema.safeParse({ ...valid, password: 'a'.repeat(73) }).success).toBe(false);
  });

  test('rejects a missing or blank name', () => {
    expect(registerSchema.safeParse({ ...valid, name: '   ' }).success).toBe(false);
    expect(registerSchema.safeParse({ email: valid.email, password: valid.password }).success).toBe(false);
  });

  test('reports every missing field', () => {
    const result = registerSchema.safeParse({});
    const fields = result.error?.issues.map((issue) => issue.path[0]);
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });
});

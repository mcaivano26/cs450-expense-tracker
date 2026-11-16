import { describe, expect, test } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

// F26B-59: unit tests for password hashing. No database needed.

describe('hashPassword', () => {
  test('returns a bcrypt hash, not the password', async () => {
    const hash = await hashPassword('correct horse');
    expect(hash).not.toContain('correct horse');
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
  });

  test('the same password gives a different hash each time (random salt)', async () => {
    const [first, second] = await Promise.all([hashPassword('correct horse'), hashPassword('correct horse')]);
    expect(first).not.toBe(second);
  });
});

describe('verifyPassword', () => {
  test('is true for the right password and false for a wrong one', async () => {
    const hash = await hashPassword('correct horse');
    expect(await verifyPassword('correct horse', hash)).toBe(true);
    expect(await verifyPassword('wrong horse', hash)).toBe(false);
  });
});

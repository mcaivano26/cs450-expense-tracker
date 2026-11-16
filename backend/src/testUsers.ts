import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { signAccessToken } from './auth.js';

// Helpers for tests that call routes protected by requireAuth.

/** `Authorization` header value for a user id. Needs no database (the token is just signed, not looked up). */
export function bearerFor(user: { id: string; email: string }): string {
  return `Bearer ${signAccessToken(user)}`;
}

export interface TestUser {
  id: string;
  email: string;
  /** Value for `.set('Authorization', ...)` in supertest. */
  authorization: string;
}

/** Creates a real user row whose email ends with `@<domain>`, so the test file can delete exactly its own users. */
export async function createTestUser(prisma: PrismaClient, domain: string, label = 'user'): Promise<TestUser> {
  const user = await prisma.user.create({
    data: { name: `Test ${label}`, email: `${label}-${randomUUID()}@${domain}` },
    select: { id: true, email: true }
  });
  return { ...user, authorization: bearerFor(user) };
}

/** Deletes every user with an email ending in `@<domain>`, and their transactions first (the foreign key requires it). */
export async function deleteTestUsers(prisma: PrismaClient, domain: string): Promise<void> {
  const where = { email: { endsWith: `@${domain}` } };
  await prisma.transaction.deleteMany({ where: { user: where } });
  await prisma.user.deleteMany({ where });
}

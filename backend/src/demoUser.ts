import type { PrismaClient } from '@prisma/client';

/**
 * Owner of the seeded sample data (prisma/seed.ts). The API no longer uses this:
 * every transaction route uses the logged-in user's id from their token instead.
 */
export const DEMO_USER_EMAIL = 'demo@expense-tracker.local';

export async function getDemoUserId(prisma: PrismaClient): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: {},
    create: { name: 'Demo User', email: DEMO_USER_EMAIL }
  });
  return user.id;
}

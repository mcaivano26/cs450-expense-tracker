import { Router } from 'express';
import { Prisma, type PrismaClient } from '@prisma/client';
import { validateBody } from '../middleware/validateBody.js';
import { registerSchema, type RegisterInput } from '../schemas/auth.js';
import { hashPassword } from '../auth/password.js';

// The only User fields an API response may contain. passwordHash is never selected.
export const publicUserFields = { id: true, name: true, email: true } as const;

const DUPLICATE_EMAIL = 'An account with this email already exists';

/** F26B-59: POST /api/auth/register. Sign-in and JWTs come in F26B-61. */
export function createAuthRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.post('/api/auth/register', validateBody(registerSchema), async (req, res) => {
    // validateBody already trimmed the name and normalized the email.
    const { name, email, password } = req.body as RegisterInput;

    try {
      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) {
        res.status(409).json({ error: DUPLICATE_EMAIL });
        return;
      }

      const passwordHash = await hashPassword(password);
      const user = await prisma.user.create({
        data: { name, email, passwordHash },
        select: publicUserFields
      });

      res.status(201).json(user);
    } catch (error) {
      // Two sign-ups with the same email at the same moment: the database's unique
      // constraint stops the second one (Prisma error P2002), and it gets the same 409.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        res.status(409).json({ error: DUPLICATE_EMAIL });
        return;
      }
      console.error(error);
      res.status(500).json({ error: 'Could not create account' });
    }
  });

  return router;
}

import { Router } from 'express';
import { type PrismaClient } from '@prisma/client';
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { validateBody } from '../middleware/validateBody.js';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from '../schemas/auth.js';
import {
  TIMING_EQUALIZER_HASH,
  TOKEN_TTL_SECONDS,
  hashPassword,
  signAccessToken,
  verifyPassword
} from '../auth.js';

// The only User fields an API response may contain. passwordHash is never selected.
export const publicUserFields = { id: true, name: true, email: true } as const;

export const DUPLICATE_EMAIL = 'An account with this email already exists';

/** Same body for an unknown email and a wrong password, so a response never reveals which one was wrong. */
export const INVALID_LOGIN = 'Invalid email or password';

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

      res.status(201).json( user );
    } catch (error) {
      // Two sign-ups with the same email at the same moment: the database's unique
      // constraint stops the second one (Prisma error P2002), and it gets the same 409.
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        res.status(409).json({ error: DUPLICATE_EMAIL });
        return;
      }
      console.error(error);
      res.status(500).json({ error: 'Could not create account' });
    }
  });

  router.post('/api/auth/login', validateBody(loginSchema), async (req, res) => {
    const { email, password } = req.body as LoginInput;

    try {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, passwordHash: true }
      });

      // Always run one bcrypt comparison, even for an unknown email, so both failures take similar time.
      const passwordMatches = await verifyPassword(password, user?.passwordHash ?? TIMING_EQUALIZER_HASH);

      if (!user || !user.passwordHash || !passwordMatches) {
        res.status(401).json({ error: INVALID_LOGIN });
        return;
      }

      const token = signAccessToken(user);
      res.json({ token, tokenType: 'Bearer', expiresIn: TOKEN_TTL_SECONDS });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Could not log in' });
    }
  });

  return router;
}

import { Prisma, type PrismaClient } from '@prisma/client';
import { Router } from 'express';
import { validateBody } from '../middleware/validateBody.js';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from '../schemas/auth.js';
import {
  TIMING_EQUALIZER_HASH,
  TOKEN_TTL_SECONDS,
  hashPassword,
  signAccessToken,
  verifyPassword
} from '../auth.js';

/** The only fields of a User that an API response may contain. Never includes passwordHash. */
export const publicUserSelect = { id: true, name: true, email: true } as const;

export const DUPLICATE_EMAIL_ERROR = 'An account with this email already exists';

/** Same body for an unknown email and a wrong password, so a response never reveals which one was wrong. */
export const INVALID_LOGIN_ERROR = 'Invalid email or password';

export function createAuthRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.post('/register', validateBody(registerSchema), async (req, res) => {
    const { name, email, password } = req.body as RegisterInput;

    try {
      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) {
        res.status(409).json({ error: DUPLICATE_EMAIL_ERROR });
        return;
      }

      const passwordHash = await hashPassword(password);
      const user = await prisma.user.create({
        data: { name, email, passwordHash },
        select: publicUserSelect
      });

      res.status(201).json({ user });
    } catch (error) {
      // Two registrations for the same email at the same moment: the unique index stops the second one.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        res.status(409).json({ error: DUPLICATE_EMAIL_ERROR });
        return;
      }
      console.error(error);
      res.status(500).json({ error: 'Could not register' });
    }
  });

  router.post('/login', validateBody(loginSchema), async (req, res) => {
    const { email, password } = req.body as LoginInput;

    try {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, passwordHash: true }
      });

      // Always run one bcrypt comparison, even for an unknown email, so both failures take similar time.
      const passwordMatches = await verifyPassword(password, user?.passwordHash ?? TIMING_EQUALIZER_HASH);

      if (!user || !user.passwordHash || !passwordMatches) {
        res.status(401).json({ error: INVALID_LOGIN_ERROR });
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

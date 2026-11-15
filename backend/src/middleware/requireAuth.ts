import type { RequestHandler, Response } from 'express';
import { verifyAccessToken } from '../auth.js';

/** Same body for a missing, malformed, expired or forged token, so a response never says which. */
export const AUTH_REQUIRED = 'Authentication required';

/**
 * Express middleware for routes that need a logged-in user.
 * Expects the header `Authorization: Bearer <token>` with a token from POST /api/auth/login.
 * No valid token: responds 401 and stops. Valid token: stores the user's id for the route and moves on.
 * The user id only ever comes from the signed token, never from the request body, query or URL.
 */
export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({ error: AUTH_REQUIRED });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      res.status(401).json({ error: AUTH_REQUIRED });
      return;
    }
    res.locals.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: AUTH_REQUIRED });
  }
};

/** The logged-in user's id, set by requireAuth. Only call this in a route that uses requireAuth. */
export function getAuthUserId(res: Response): string {
  const userId: unknown = res.locals.userId;
  if (typeof userId !== 'string') {
    throw new Error('getAuthUserId called on a route without requireAuth');
  }
  return userId;
}

/** Fields that would choose a transaction's owner. Ownership always comes from the token instead. */
export const OWNER_FIELDS = ['userId', 'user'] as const;

/**
 * Rejects a body that tries to set the owner (for example `{"userId": "someone-else"}`) with 400,
 * instead of silently ignoring it, so a client bug or tampering attempt is visible.
 */
export const rejectOwnerFields: RequestHandler = (req, res, next) => {
  const body: unknown = req.body;
  const sent = body && typeof body === 'object' ? OWNER_FIELDS.filter((field) => field in body) : [];

  if (sent.length > 0) {
    res.status(400).json({
      error: 'Validation failed',
      issues: sent.map((field) => ({
        field,
        message: 'Cannot be set. Transactions always belong to the logged-in user.'
      }))
    });
    return;
  }
  next();
};

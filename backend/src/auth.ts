import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

/** bcrypt cost factor: 2^10 rounds. */
export const BCRYPT_ROUNDS = 10;

/** Access tokens expire one hour after they are issued. */
export const TOKEN_TTL_SECONDS = 60 * 60;

export const JWT_ALGORITHM = 'HS256';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set. Add it to backend/.env (see .env.example).');
  }
  return secret;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

/**
 * Login compares against this when the email is unknown, so an unknown email takes about as long as a
 * wrong password. Without it, a fast 401 would reveal that no account uses that email.
 */
export const TIMING_EQUALIZER_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

export interface AccessTokenPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

export function signAccessToken(user: { id: string; email: string }): string {
  return jwt.sign({ email: user.email }, getJwtSecret(), {
    subject: user.id,
    expiresIn: TOKEN_TTL_SECONDS,
    algorithm: JWT_ALGORITHM
  });
}

/** Throws jwt.TokenExpiredError for an expired token and jwt.JsonWebTokenError for any other bad token. */
export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, getJwtSecret(), { algorithms: [JWT_ALGORITHM] }) as AccessTokenPayload;
}

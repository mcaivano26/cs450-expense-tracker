import bcrypt from 'bcryptjs';

/**
 * F26B-59: password hashing with bcrypt.
 * A hash is one-way: the server can check a password against it, but cannot turn it back into the password.
 * bcrypt also adds a random salt, so two users with the same password get different hashes.
 */

// Cost factor: each +1 doubles the work. 10 is the commonly recommended minimum for bcrypt.
export const BCRYPT_ROUNDS = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** For sign-in (F26B-61): true if the password matches the stored hash. */
export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

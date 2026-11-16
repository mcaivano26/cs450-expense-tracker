import { z } from 'zod';

/**
 * Emails are trimmed and lowercased before validation, so " Ann@Example.com " and "ann@example.com"
 * are the same account. Register and login both use this so they always agree.
 */
const normalizedEmail = z
  .string({ required_error: 'Email is required', invalid_type_error: 'Email must be text' })
  .trim()
  .toLowerCase();

/**
 * F26B-59: rules for the JSON body of POST /api/auth/register.
 * Zod runs these before the route, so the route only ever sees clean data.
 */
export const registerSchema = z.object({
  name: z
    .string({ required_error: 'Name is required', invalid_type_error: 'Name must be text' })
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or fewer'),
  // Normalize first (trim spaces, lowercase), then check the format, so
  // " Sharon@Example.COM " and "sharon@example.com" are treated as the same account.
  email: normalizedEmail
    .email('Email must be a valid email address')
    .max(254, 'Email must be 254 characters or fewer'),
  // Not trimmed: spaces in a password are allowed and count.
  // bcrypt only uses the first 72 bytes, so longer passwords are rejected instead of silently cut.
  password: z
    .string({ required_error: 'Password is required', invalid_type_error: 'Password must be text' })
    .min(8, 'Password must be at least 8 characters')
    .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be 72 bytes or fewer')
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Rules for the JSON body of POST /api/auth/login. Only "is something there" is checked:
 * a wrong or unknown email must get the same 401 as a wrong password, not a 400 that hints which one failed.
 */
export const loginSchema = z.object({
  email: normalizedEmail.min(1, 'Email is required'),
  password: z
    .string({ required_error: 'Password is required', invalid_type_error: 'Password must be text' })
    .min(1, 'Password is required')
});

export type LoginInput = z.infer<typeof loginSchema>;

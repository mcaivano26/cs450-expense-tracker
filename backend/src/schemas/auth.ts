import { z } from 'zod';

/**
 * F26B-59: rules for the JSON body of POST /api/auth/register.
 * Zod runs these before the route, so the route only ever sees clean data.
 */
export const registerSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or fewer'),
  // Normalize first (trim spaces, lowercase), then check the format, so
  // " Sharon@Example.COM " and "sharon@example.com" are treated as the same account.
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Email must be a valid email address')
    .max(254, 'Email must be 254 characters or fewer'),
  // Not trimmed: spaces in a password are allowed and count.
  // bcrypt only uses the first 72 bytes, so longer passwords are rejected instead of silently cut.
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be 72 bytes or fewer')
});

export type RegisterInput = z.infer<typeof registerSchema>;

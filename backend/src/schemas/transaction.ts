import { z } from 'zod';

/**
 * Rules for the JSON body of POST /api/transactions (creating an expense).
 * The server creates the id, so the client does not send one.
 */
export const createTransactionSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(100, 'Title must be 100 characters or fewer'),
  amount: z
    .number({ required_error: 'Amount is required', invalid_type_error: 'Amount must be a number' })
    .positive('Amount must be greater than 0')
    .max(1_000_000, 'Amount must be 1,000,000 or less'),
  category: z.string().trim().min(1, 'Category is required').max(50, 'Category must be 50 characters or fewer'),
  type: z.enum(['expense', 'income']).default('expense'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must look like YYYY-MM-DD')
    .optional(),
  description: z.string().trim().max(500, 'Description must be 500 characters or fewer').optional()
});

/** The TypeScript type Zod builds from the rules above. */
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

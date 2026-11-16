import { z } from 'zod';

/**
 * F26B-10: rules for the query string of GET /api/transactions, e.g. ?category=Dining
 * No category (or an empty one) means "All": every transaction is returned.
 */
export const transactionListQuerySchema = z.object({
  category: z
    // A single text value. ?category=A&category=B arrives as an array and is rejected.
    .string({ invalid_type_error: 'Category must be a single value' })
    .trim()
    .max(50, 'Category must be 50 characters or fewer')
    .optional()
    // "" (from ?category= or the "All categories" option) becomes undefined, which means no filter.
    .transform((value) => (value ? value : undefined))
});

export type TransactionListQuery = z.infer<typeof transactionListQuerySchema>;

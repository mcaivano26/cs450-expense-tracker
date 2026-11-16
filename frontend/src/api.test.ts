import { afterEach, describe, expect, test, vi } from 'vitest';
import { createTransaction, fetchCategories, fetchMonthlySummary, fetchSummary, fetchTransactions } from './api/client.ts';

const fetchMock = vi.fn();

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function mockFetch(response: Response) {
  fetchMock.mockResolvedValueOnce(response);
  vi.stubGlobal('fetch', fetchMock);
}

describe('fetchTransactions', () => {
  test('returns transactions from the API', async () => {
    const transactions = [{ id: '1', title: 'Coffee', amount: 4.5, category: 'Food', type: 'expense', date: '2026-11-14T12:00:00Z' }];
    mockFetch(new Response(JSON.stringify(transactions)));

    await expect(fetchTransactions()).resolves.toEqual(transactions);
    expect(fetchMock).toHaveBeenCalledWith('/api/transactions');
  });

  test('rejects an unsuccessful response', async () => {
    mockFetch(new Response(null, { status: 500 }));

    await expect(fetchTransactions()).rejects.toThrow('GET /api/transactions failed with status 500');
  });
});

// F26B-10
describe('fetchTransactions with a category', () => {
  test('adds the category to the URL, encoded', async () => {
    mockFetch(new Response(JSON.stringify([])));

    await fetchTransactions('Dining & Drinks');
    expect(fetchMock).toHaveBeenCalledWith('/api/transactions?category=Dining+%26+Drinks');
  });

  test('an empty category means all transactions (no query string)', async () => {
    mockFetch(new Response(JSON.stringify([])));

    await fetchTransactions('');
    expect(fetchMock).toHaveBeenCalledWith('/api/transactions');
  });
});

describe('fetchCategories', () => {
  test('returns the category list from the API', async () => {
    mockFetch(new Response(JSON.stringify(['Dining', 'Rent'])));

    await expect(fetchCategories()).resolves.toEqual(['Dining', 'Rent']);
    expect(fetchMock).toHaveBeenCalledWith('/api/categories');
  });
});

describe('fetchSummary', () => {
  test('returns the summary from the API', async () => {
    const summary = { totalIncome: 1000, totalExpenses: 24.5, net: 975.5 };
    mockFetch(new Response(JSON.stringify(summary)));

    await expect(fetchSummary()).resolves.toEqual(summary);
    expect(fetchMock).toHaveBeenCalledWith('/api/summary');
  });
});

// F26B-7
describe('fetchMonthlySummary', () => {
  test('asks for the given month and returns its totals', async () => {
    const monthly = { month: '2026-11', totalIncome: 2000, totalExpenses: 75.5, net: 1924.5, transactionCount: 3 };
    mockFetch(new Response(JSON.stringify(monthly)));

    await expect(fetchMonthlySummary('2026-11')).resolves.toEqual(monthly);
    expect(fetchMock).toHaveBeenCalledWith('/api/summary/monthly?month=2026-11');
  });
});

describe('createTransaction', () => {
  const transaction = {
    type: 'expense' as const,
    title: 'Coffee',
    amount: 4.5,
    category: 'Food',
    date: '2026-11-14',
    description: ''
  };

  test('sends a correctly formatted transaction and returns null after creation', async () => {
    mockFetch(new Response(null, { status: 201 }));

    await expect(createTransaction(transaction)).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...transaction, date: '2026-11-14T12:00:00Z', description: undefined })
    });
  });

  test('returns validation issues from a 400 response', async () => {
    const issues = [{ field: 'amount', message: 'Amount is required' }];
    mockFetch(new Response(JSON.stringify({ issues }), { status: 400 }));

    await expect(createTransaction(transaction)).resolves.toEqual(issues);
  });

  test('returns a general validation error when the API supplies no issues', async () => {
    mockFetch(new Response(JSON.stringify({ error: 'Validation failed' }), { status: 400 }));

    await expect(createTransaction(transaction)).resolves.toEqual([
      { field: '', message: 'Validation failed' }
    ]);
  });

  test('returns a helpful error for an unexpected response', async () => {
    mockFetch(new Response(null, { status: 503 }));

    await expect(createTransaction(transaction)).resolves.toEqual([
      { field: '', message: 'Something went wrong saving. Is the backend running?' }
    ]);
  });
});

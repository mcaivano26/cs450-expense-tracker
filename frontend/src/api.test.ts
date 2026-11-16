import { afterEach, describe, expect, test, vi } from 'vitest';
import { createTransaction, fetchCategories, fetchMonthlySummary, fetchSummary, fetchTransactions, login, register, updateTransaction } from './api/client.ts';
import { clearSession, getSession, saveSession, SESSION_EXPIRED_EVENT } from './auth/session.ts';

const fetchMock = vi.fn();

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  clearSession();
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
    expect(fetchMock).toHaveBeenCalledWith('/api/transactions', { headers: {} });
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
    expect(fetchMock).toHaveBeenCalledWith('/api/transactions?category=Dining+%26+Drinks', { headers: {} });
  });

  test('an empty category means all transactions (no query string)', async () => {
    mockFetch(new Response(JSON.stringify([])));

    await fetchTransactions('');
    expect(fetchMock).toHaveBeenCalledWith('/api/transactions', { headers: {} });
  });
});

describe('fetchCategories', () => {
  test('returns the category list from the API', async () => {
    mockFetch(new Response(JSON.stringify(['Dining', 'Rent'])));

    await expect(fetchCategories()).resolves.toEqual(['Dining', 'Rent']);
    expect(fetchMock).toHaveBeenCalledWith('/api/categories', { headers: {} });
  });
});

describe('fetchSummary', () => {
  test('returns the summary from the API', async () => {
    const summary = { totalIncome: 1000, totalExpenses: 24.5, net: 975.5 };
    mockFetch(new Response(JSON.stringify(summary)));

    await expect(fetchSummary()).resolves.toEqual(summary);
    expect(fetchMock).toHaveBeenCalledWith('/api/summary', { headers: {} });
  });
});

// F26B-7
describe('fetchMonthlySummary', () => {
  test('asks for the given month and returns its totals', async () => {
    const monthly = { month: '2026-11', totalIncome: 2000, totalExpenses: 75.5, net: 1924.5, transactionCount: 3 };
    mockFetch(new Response(JSON.stringify(monthly)));

    await expect(fetchMonthlySummary('2026-11')).resolves.toEqual(monthly);
    expect(fetchMock).toHaveBeenCalledWith('/api/summary/monthly?month=2026-11', { headers: {} });
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

// Login page: the token is sent with requests, and a 401 signs the user out.
describe('signed-in requests', () => {
  test('send the saved token as a Bearer Authorization header', async () => {
    saveSession({ token: 'abc.def.ghi', email: 'sharon@example.com' });
    mockFetch(new Response(JSON.stringify([])));

    await fetchTransactions();
    expect(fetchMock).toHaveBeenCalledWith('/api/transactions', { headers: { Authorization: 'Bearer abc.def.ghi' } });
  });

  test('createTransaction sends the token too', async () => {
    saveSession({ token: 'abc.def.ghi', email: 'sharon@example.com' });
    mockFetch(new Response(null, { status: 201 }));

    await createTransaction({ type: 'expense', title: 'Coffee', amount: 4.5, category: 'Food', date: '2026-11-14', description: '' });
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer abc.def.ghi' });
  });

  // F26B-70: editing used to send no token, so every edit got 401 once login was required.
  test('updateTransaction sends the token too', async () => {
    saveSession({ token: 'abc.def.ghi', email: 'sharon@example.com' });
    mockFetch(new Response(null, { status: 200 }));

    await expect(
      updateTransaction('tx-1', { type: 'expense', title: 'Coffee', amount: 4.5, category: 'Food', date: '2026-11-14', description: '' })
    ).resolves.toBeNull();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/transactions/tx-1');
    expect(options.method).toBe('PUT');
    expect(options.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer abc.def.ghi' });
  });

  test('a 401 while editing signs the user out', async () => {
    saveSession({ token: 'expired.token', email: 'sharon@example.com' });
    const onExpired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    mockFetch(new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 }));

    await updateTransaction('tx-1', { type: 'expense', title: 'Coffee', amount: 4.5, category: 'Food', date: '2026-11-14', description: '' });
    expect(getSession()).toBeNull();
    expect(onExpired).toHaveBeenCalledOnce();
    window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  });

  test('a 401 forgets the token and tells the app the session expired', async () => {
    saveSession({ token: 'expired.token', email: 'sharon@example.com' });
    const onExpired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    mockFetch(new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 }));

    await expect(fetchSummary()).rejects.toThrow('status 401');
    expect(getSession()).toBeNull();
    expect(onExpired).toHaveBeenCalledOnce();
    window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  });
});

describe('login', () => {
  test('returns the token on success', async () => {
    mockFetch(new Response(JSON.stringify({ token: 'abc.def.ghi', tokenType: 'Bearer', expiresIn: 3600 })));

    await expect(login('sharon@example.com', 'correct horse')).resolves.toEqual({ ok: true, token: 'abc.def.ghi' });
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sharon@example.com', password: 'correct horse' })
    });
  });

  test('returns the error message for a wrong email or password (401)', async () => {
    mockFetch(new Response(JSON.stringify({ error: 'Invalid email or password' }), { status: 401 }));

    await expect(login('sharon@example.com', 'wrong')).resolves.toEqual({
      ok: false,
      issues: [{ field: '', message: 'Invalid email or password' }]
    });
  });
});

describe('register', () => {
  test('returns ok when the account is created (201)', async () => {
    mockFetch(new Response(JSON.stringify({ id: '1', name: 'Sharon', email: 'sharon@example.com' }), { status: 201 }));

    await expect(register('Sharon', 'sharon@example.com', 'correct horse')).resolves.toEqual({ ok: true });
  });

  test('returns field errors from a 400', async () => {
    const issues = [{ field: 'password', message: 'Password must be at least 8 characters' }];
    mockFetch(new Response(JSON.stringify({ error: 'Validation failed', issues }), { status: 400 }));

    await expect(register('Sharon', 'sharon@example.com', 'short')).resolves.toEqual({ ok: false, issues });
  });

  test('returns the duplicate email message from a 409', async () => {
    mockFetch(new Response(JSON.stringify({ error: 'An account with this email already exists' }), { status: 409 }));

    await expect(register('Sharon', 'sharon@example.com', 'correct horse')).resolves.toEqual({
      ok: false,
      issues: [{ field: '', message: 'An account with this email already exists' }]
    });
  });
});

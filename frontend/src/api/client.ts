import type { Summary, MonthlySummary, Transaction, FieldIssue, NewTransaction } from '../types/api.ts';
import { clearSession, getSession, SESSION_EXPIRED_EVENT } from '../auth/session.ts';

/** Login page: the signed-in user's token, sent with every request to a protected route. */
function authHeaders(): Record<string, string> {
  const session = getSession();
  return session ? { Authorization: `Bearer ${session.token}` } : {};
}

/** A 401 means the token is missing, wrong or expired: forget it and tell the app to show the sign-in form. */
function handleUnauthorized(response: Response): void {
  if (response.status === 401) {
    clearSession();
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: authHeaders() });
  handleUnauthorized(response);
  if (response.ok === false) {
    throw new Error(`GET ${path} failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

/** F26B-10: pass a category to get only that category's transactions; leave it out (or '') for all. */
export function fetchTransactions(category?: string): Promise<Transaction[]> {
  const query = category ? `?${new URLSearchParams({ category })}` : '';
  return getJson<Transaction[]>(`/api/transactions${query}`);
}

/** F26B-10: the categories the user has used, for the filter dropdown. */
export function fetchCategories(): Promise<string[]> {
  return getJson<string[]>('/api/categories');
}

export function fetchSummary(): Promise<Summary> {
  return getJson<Summary>('/api/summary');
}

/** F26B-7: income, expenses and net for one month, written "YYYY-MM". */
export function fetchMonthlySummary(month: string): Promise<MonthlySummary> {
  return getJson<MonthlySummary>(`/api/summary/monthly?${new URLSearchParams({ month })}`);
}

/** Saves an expense or income. Returns null on success, or the list of field problems. */
export async function createTransaction(input: NewTransaction): Promise<FieldIssue[] | null> {
  const response = await fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      ...input,
      // the API expects a full date-time; noon UTC keeps the same day everywhere
      date: `${input.date}T12:00:00Z`,
      description: input.description || undefined
    })
  });
  if (response.status === 201) return null;
  handleUnauthorized(response);
  if (response.status === 400) {
    const body = await response.json();
    return body.issues ?? [{ field: '', message: body.error ?? 'Validation failed' }];
  }
  return [{ field: '', message: 'Something went wrong saving. Is the backend running?' }];
}

/** Login page: the result of signing in or registering. */
export type AuthResult = { ok: true; token?: string } | { ok: false; issues: FieldIssue[] };

/** Turns a 400/401/409 error body into field problems the form can show. */
async function authIssues(response: Response, fallback: string): Promise<FieldIssue[]> {
  try {
    const body = await response.json();
    return body.issues ?? [{ field: '', message: body.error ?? fallback }];
  } catch {
    return [{ field: '', message: fallback }];
  }
}

/** Login page: POST /api/auth/login. On success returns the token to send with later requests. */
export async function login(email: string, password: string): Promise<AuthResult> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (response.ok) {
    const body = (await response.json()) as { token: string };
    return { ok: true, token: body.token };
  }
  return { ok: false, issues: await authIssues(response, 'Could not sign in. Is the backend running?') };
}

/** Login page: POST /api/auth/register. Creates the account; sign in afterwards to get a token. */
export async function register(name: string, email: string, password: string): Promise<AuthResult> {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });
  if (response.status === 201) return { ok: true };
  return { ok: false, issues: await authIssues(response, 'Could not create the account. Is the backend running?') };
}

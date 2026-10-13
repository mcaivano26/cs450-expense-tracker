import type { Summary, Transaction } from '../types/api.ts';

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`GET ${path} failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

export function fetchTransactions(): Promise<Transaction[]> {
  return getJson<Transaction[]>('/api/transactions');
}

export function fetchSummary(): Promise<Summary> {
  return getJson<Summary>('/api/summary');
}
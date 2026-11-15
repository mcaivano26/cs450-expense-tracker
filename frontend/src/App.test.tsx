import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import App from './App.tsx';
import { fetchSummary, fetchTransactions } from './api/client.ts';

vi.mock('./api/client.ts', () => ({
  createTransaction: vi.fn(),
  fetchSummary: vi.fn(),
  fetchTransactions: vi.fn()
}));

const fetchSummaryMock = vi.mocked(fetchSummary);
const fetchTransactionsMock = vi.mocked(fetchTransactions);

afterEach(() => {
  cleanup();
  fetchSummaryMock.mockReset();
  fetchTransactionsMock.mockReset();
});

describe('App', () => {
  test('shows the fetched summary and transactions', async () => {
    fetchSummaryMock.mockResolvedValueOnce({ totalIncome: 1000, totalExpenses: 4.5, net: 995.5 });
    fetchTransactionsMock.mockResolvedValueOnce([
      { id: '1', title: 'Coffee', amount: 4.5, category: 'Food', type: 'expense', date: '2026-11-14T12:00:00Z' }
    ]);

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Expense Tracker' })).toBeTruthy();
    expect(screen.getByText('$1000.00')).toBeTruthy();
    expect(screen.getByText('$4.50')).toBeTruthy();
    expect(screen.getByText('$995.50')).toBeTruthy();
    expect(screen.getByText('Coffee')).toBeTruthy();
    expect(screen.getByText('-$4.50')).toBeTruthy();
  });

  test('shows an error and reloads data when Try again is clicked', async () => {
    fetchTransactionsMock
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce([]);
    fetchSummaryMock.mockResolvedValue({ totalIncome: 0, totalExpenses: 0, net: 0 });

    render(<App />);

    expect(await screen.findByText('Could not load data: Network unavailable')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Expense Tracker' })).toBeTruthy());
    expect(screen.getByText('No transactions yet.')).toBeTruthy();
  });
});

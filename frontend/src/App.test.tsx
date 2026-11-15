import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import App from './App.tsx';
import { fetchCategories, fetchSummary, fetchTransactions } from './api/client.ts';

vi.mock('./api/client.ts', () => ({
  createTransaction: vi.fn(),
  fetchCategories: vi.fn(),
  fetchSummary: vi.fn(),
  fetchTransactions: vi.fn()
}));

const fetchSummaryMock = vi.mocked(fetchSummary);
const fetchTransactionsMock = vi.mocked(fetchTransactions);
const fetchCategoriesMock = vi.mocked(fetchCategories);

beforeEach(() => {
  // F26B-10: App also loads the category list; the existing tests don't need any categories.
  fetchCategoriesMock.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  fetchSummaryMock.mockReset();
  fetchTransactionsMock.mockReset();
  fetchCategoriesMock.mockReset();
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

// F26B-10: filter transactions by category.
describe('App category filter', () => {
  const coffee = { id: '1', title: 'Coffee', amount: 4.5, category: 'Dining', type: 'expense' as const, date: '2026-11-14T12:00:00Z' };
  const rent = { id: '2', title: 'Monthly rent', amount: 1200, category: 'Rent', type: 'expense' as const, date: '2026-11-01T12:00:00Z' };
  const summary = { totalIncome: 0, totalExpenses: 1204.5, net: -1204.5 };

  async function renderWithData() {
    fetchSummaryMock.mockResolvedValue(summary);
    fetchCategoriesMock.mockResolvedValue(['Dining', 'Rent']);
    fetchTransactionsMock.mockResolvedValueOnce([coffee, rent]);
    render(<App />);
    await screen.findByText('Coffee');
  }

  test('lists "All categories" plus each category from the API', async () => {
    await renderWithData();

    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(expect.arrayContaining(['All categories', 'Dining', 'Rent']));
  });

  test('selecting a category shows only matching transactions', async () => {
    await renderWithData();
    fetchTransactionsMock.mockResolvedValueOnce([rent]);

    fireEvent.change(screen.getByLabelText('Filter by category'), { target: { value: 'Rent' } });

    expect(await screen.findByText('Monthly rent')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Coffee')).toBeNull());
    expect(fetchTransactionsMock).toHaveBeenLastCalledWith('Rent');
    // The summary cards are not reloaded by the filter.
    expect(fetchSummaryMock).toHaveBeenCalledOnce();
  });

  test('selecting "All categories" shows every transaction again', async () => {
    await renderWithData();
    fetchTransactionsMock.mockResolvedValueOnce([rent]);
    fireEvent.change(screen.getByLabelText('Filter by category'), { target: { value: 'Rent' } });
    await waitFor(() => expect(screen.queryByText('Coffee')).toBeNull());

    fetchTransactionsMock.mockResolvedValueOnce([coffee, rent]);
    fireEvent.change(screen.getByLabelText('Filter by category'), { target: { value: '' } });

    expect(await screen.findByText('Coffee')).toBeTruthy();
    expect(fetchTransactionsMock).toHaveBeenLastCalledWith('');
  });

  test('shows a clear message when nothing matches, and "Show all" clears the filter', async () => {
    await renderWithData();
    fetchTransactionsMock.mockResolvedValueOnce([]);

    fireEvent.change(screen.getByLabelText('Filter by category'), { target: { value: 'Dining' } });

    expect(await screen.findByText(/No transactions in "Dining"\./)).toBeTruthy();
    expect(screen.queryByText('No transactions yet.')).toBeNull();

    fetchTransactionsMock.mockResolvedValueOnce([coffee, rent]);
    fireEvent.click(screen.getByRole('button', { name: 'Show all' }));

    expect(await screen.findByText('Coffee')).toBeTruthy();
    expect(screen.getByLabelText('Filter by category')).toHaveProperty('value', '');
  });
});

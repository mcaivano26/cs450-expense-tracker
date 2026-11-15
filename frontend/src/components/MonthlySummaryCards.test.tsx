import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import MonthlySummaryCards from './MonthlySummaryCards.tsx';

// F26B-7: the monthly cards on their own.

afterEach(() => {
  cleanup();
});

const november = { month: '2026-11', totalIncome: 2000, totalExpenses: 75.5, net: 1924.5, transactionCount: 3 };

describe('MonthlySummaryCards', () => {
  test('shows the month name and its income, expenses and net', () => {
    render(<MonthlySummaryCards summary={november} onPreviousMonth={vi.fn()} onNextMonth={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeTruthy();
    expect(screen.getByText('$2000.00')).toBeTruthy();
    expect(screen.getByText('$75.50')).toBeTruthy();
    expect(screen.getByText('$1924.50')).toBeTruthy();
    expect(screen.queryByText(/No transactions in/)).toBeNull();
  });

  test('an empty month shows $0.00 cards and a clear message', () => {
    const empty = { month: '2025-01', totalIncome: 0, totalExpenses: 0, net: 0, transactionCount: 0 };
    render(<MonthlySummaryCards summary={empty} onPreviousMonth={vi.fn()} onNextMonth={vi.fn()} />);

    expect(screen.getAllByText('$0.00')).toHaveLength(3);
    expect(screen.getByText('No transactions in January 2025.')).toBeTruthy();
  });

  test('the buttons call onPreviousMonth and onNextMonth', () => {
    const onPreviousMonth = vi.fn();
    const onNextMonth = vi.fn();
    render(<MonthlySummaryCards summary={november} onPreviousMonth={onPreviousMonth} onNextMonth={onNextMonth} />);

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));

    expect(onPreviousMonth).toHaveBeenCalledOnce();
    expect(onNextMonth).toHaveBeenCalledOnce();
  });
});

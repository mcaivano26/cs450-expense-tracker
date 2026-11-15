import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import AddTransactionForm from './AddTransactionForm.tsx';
import { createTransaction } from '../api/client.ts';

vi.mock('../api/client.ts', () => ({ createTransaction: vi.fn() }));

const createTransactionMock = vi.mocked(createTransaction);

afterEach(() => {
  cleanup();
  createTransactionMock.mockReset();
});

describe('AddTransactionForm', () => {
  test('switches to income choices', () => {
    render(<AddTransactionForm onSaved={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Income' }));

    expect(screen.getByRole('button', { name: 'Add income' })).toBeTruthy();
    expect(screen.getByLabelText('Title')).toHaveProperty('placeholder', 'Paycheck');
    expect(screen.getByRole('option', { name: 'Salary' })).toBeTruthy();
  });

  test('submits an expense, clears the form, and notifies its parent', async () => {
    const onSaved = vi.fn();
    createTransactionMock.mockResolvedValueOnce(null);
    render(<AddTransactionForm onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Coffee' } });
    fireEvent.change(screen.getByLabelText('Amount ($)'), { target: { value: '4.50' } });
    fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: 'Morning coffee' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add expense' }));

    await waitFor(() => expect(createTransactionMock).toHaveBeenCalledOnce());
    expect(createTransactionMock).toHaveBeenCalledWith(expect.objectContaining({
      type: 'expense', title: 'Coffee', amount: 4.5, category: 'Food', description: 'Morning coffee'
    }));
    expect(onSaved).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Title')).toHaveProperty('value', '');
    expect(screen.getByText(/Expense saved/)).toBeTruthy();
  });

  test('shows API validation issues beside their fields', async () => {
    createTransactionMock.mockResolvedValueOnce([{ field: 'title', message: 'Title is required' }]);
    render(<AddTransactionForm onSaved={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add expense' }));

    expect(await screen.findByText('Title is required')).toBeTruthy();
  });
});

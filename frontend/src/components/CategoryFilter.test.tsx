import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import CategoryFilter from './CategoryFilter.tsx';

// F26B-10: the category dropdown on its own.

afterEach(() => {
  cleanup();
});

describe('CategoryFilter', () => {
  test('shows "All categories" first, then each category', () => {
    render(<CategoryFilter categories={['Dining', 'Rent']} value="" onChange={vi.fn()} />);

    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(['All categories', 'Dining', 'Rent']);
  });

  test('shows the selected category', () => {
    render(<CategoryFilter categories={['Dining', 'Rent']} value="Rent" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Filter by category')).toHaveProperty('value', 'Rent');
  });

  test('calls onChange with the picked category, or "" for All', () => {
    const onChange = vi.fn();
    render(<CategoryFilter categories={['Dining', 'Rent']} value="Rent" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Filter by category'), { target: { value: 'Dining' } });
    fireEvent.change(screen.getByLabelText('Filter by category'), { target: { value: '' } });

    expect(onChange).toHaveBeenNthCalledWith(1, 'Dining');
    expect(onChange).toHaveBeenNthCalledWith(2, '');
  });
});

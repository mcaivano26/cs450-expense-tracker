import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import AuthForm from './AuthForm.tsx';
import { login, register } from '../api/client.ts';

// Login page: the sign-in / create-account form.

vi.mock('../api/client.ts', () => ({ login: vi.fn(), register: vi.fn() }));

const loginMock = vi.mocked(login);
const registerMock = vi.mocked(register);

afterEach(() => {
  cleanup();
  loginMock.mockReset();
  registerMock.mockReset();
});

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('AuthForm', () => {
  test('signs in with email and password and passes the token on', async () => {
    loginMock.mockResolvedValueOnce({ ok: true, token: 'abc.def.ghi' });
    const onSignedIn = vi.fn();
    render(<AuthForm onSignedIn={onSignedIn} />);

    fill('Email', 'Sharon@Example.com');
    fill('Password', 'correct horse');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith('abc.def.ghi', 'sharon@example.com'));
    expect(loginMock).toHaveBeenCalledWith('Sharon@Example.com', 'correct horse');
    expect(registerMock).not.toHaveBeenCalled();
  });

  test('shows the error from a failed sign-in and stays on the form', async () => {
    loginMock.mockResolvedValueOnce({ ok: false, issues: [{ field: '', message: 'Invalid email or password' }] });
    const onSignedIn = vi.fn();
    render(<AuthForm onSignedIn={onSignedIn} />);

    fill('Email', 'sharon@example.com');
    fill('Password', 'wrong password');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Invalid email or password');
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  test('"Create an account" shows the Name field; creating an account signs in right after', async () => {
    registerMock.mockResolvedValueOnce({ ok: true });
    loginMock.mockResolvedValueOnce({ ok: true, token: 'new.user.token' });
    const onSignedIn = vi.fn();
    render(<AuthForm onSignedIn={onSignedIn} />);

    expect(screen.queryByLabelText('Name')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));

    fill('Name', 'Sharon');
    fill('Email', 'sharon@example.com');
    fill('Password', 'correct horse');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith('new.user.token', 'sharon@example.com'));
    expect(registerMock).toHaveBeenCalledWith('Sharon', 'sharon@example.com', 'correct horse');
  });

  test('shows field errors under the right box when registration fails', async () => {
    registerMock.mockResolvedValueOnce({
      ok: false,
      issues: [{ field: 'password', message: 'Password must be at least 8 characters' }]
    });
    render(<AuthForm onSignedIn={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));

    fill('Name', 'Sharon');
    fill('Email', 'sharon@example.com');
    fill('Password', 'short');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Password must be at least 8 characters')).toBeTruthy();
    expect(loginMock).not.toHaveBeenCalled();
  });

  test('the tabs on the left switch between sign in and create account', () => {
    render(<AuthForm onSignedIn={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Sign in' }).getAttribute('aria-selected')).toBe('true');

    fireEvent.click(screen.getByRole('tab', { name: 'Create account' }));
    expect(screen.getByRole('tab', { name: 'Create account' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByLabelText('Name')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Sign in' }));
    expect(screen.queryByLabelText('Name')).toBeNull();
  });

  test('shows a notice when one is given (e.g. session expired)', () => {
    render(<AuthForm onSignedIn={vi.fn()} notice="Your session has expired. Please sign in again." />);
    expect(screen.getByText('Your session has expired. Please sign in again.')).toBeTruthy();
  });
});

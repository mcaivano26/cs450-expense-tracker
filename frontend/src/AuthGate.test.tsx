import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import AuthGate from './AuthGate.tsx';
import { clearSession, getSession, saveSession, SESSION_EXPIRED_EVENT } from './auth/session.ts';

// Login page: the gate between the sign-in form and the dashboard.
// The dashboard and form are replaced with simple stand-ins so only the gate's logic is tested.

vi.mock('./App.tsx', () => ({
  default: ({ userEmail, onLogOut }: { userEmail?: string; onLogOut?: () => void }) => (
    <div>
      <p>Dashboard for {userEmail}</p>
      <button onClick={onLogOut}>Log out</button>
    </div>
  )
}));

vi.mock('./components/AuthForm.tsx', () => ({
  default: ({ onSignedIn, notice }: { onSignedIn: (token: string, email: string) => void; notice?: string }) => (
    <div>
      <p>Sign-in form</p>
      {notice && <p>{notice}</p>}
      <button onClick={() => onSignedIn('abc.def.ghi', 'sharon@example.com')}>Fake sign in</button>
    </div>
  )
}));

afterEach(() => {
  cleanup();
  clearSession();
});

describe('AuthGate', () => {
  test('shows the sign-in form when nobody is signed in', () => {
    render(<AuthGate />);
    expect(screen.getByText('Sign-in form')).toBeTruthy();
  });

  test('signing in saves the token and shows the dashboard', () => {
    render(<AuthGate />);
    fireEvent.click(screen.getByRole('button', { name: 'Fake sign in' }));

    expect(screen.getByText('Dashboard for sharon@example.com')).toBeTruthy();
    expect(getSession()).toEqual({ token: 'abc.def.ghi', email: 'sharon@example.com' });
  });

  test('a saved token keeps you signed in after a page refresh', () => {
    saveSession({ token: 'abc.def.ghi', email: 'sharon@example.com' });
    render(<AuthGate />);
    expect(screen.getByText('Dashboard for sharon@example.com')).toBeTruthy();
  });

  test('Log out forgets the token and shows the sign-in form', () => {
    saveSession({ token: 'abc.def.ghi', email: 'sharon@example.com' });
    render(<AuthGate />);

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(screen.getByText('Sign-in form')).toBeTruthy();
    expect(getSession()).toBeNull();
  });

  test('an expired session sends you back to sign in with a message', () => {
    saveSession({ token: 'abc.def.ghi', email: 'sharon@example.com' });
    render(<AuthGate />);

    act(() => {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    });

    expect(screen.getByText('Sign-in form')).toBeTruthy();
    expect(screen.getByText('Your session has expired. Please sign in again.')).toBeTruthy();
  });
});

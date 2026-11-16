import { useEffect, useState } from 'react';
import App from './App.tsx';
import AuthForm from './components/AuthForm.tsx';
import { clearSession, getSession, saveSession, SESSION_EXPIRED_EVENT, type Session } from './auth/session.ts';

/** Login page: shows the sign-in form when signed out, and the dashboard (App) when signed in. */
export default function AuthGate() {
  const [session, setSession] = useState<Session | null>(getSession);
  const [notice, setNotice] = useState<string | undefined>(undefined);

  useEffect(() => {
    // The API client fires this on any 401, e.g. when the token has expired.
    function handleExpired() {
      setSession(null);
      setNotice('Your session has expired. Please sign in again.');
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  }, []);

  function handleSignedIn(token: string, email: string) {
    const next = { token, email };
    saveSession(next);
    setNotice(undefined);
    setSession(next);
  }

  function handleLogOut() {
    clearSession();
    setNotice(undefined);
    setSession(null);
  }

  if (session === null) {
    return <AuthForm onSignedIn={handleSignedIn} notice={notice} />;
  }
  // key: a different account gets a fresh dashboard instead of the previous user's data.
  return <App key={session.email} userEmail={session.email} onLogOut={handleLogOut} />;
}

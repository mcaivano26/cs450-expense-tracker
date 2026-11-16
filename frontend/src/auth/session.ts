// Login page: keeps the signed-in user's token in the browser, so a page refresh doesn't log them out.
// localStorage is readable by any script on the page, so this relies on the app not running untrusted
// scripts (XSS). The token also expires on its own (the backend sets the expiry).

const STORAGE_KEY = 'expense-tracker-session';

/** Fired when the API answers 401, so the app can send the user back to the sign-in form. */
export const SESSION_EXPIRED_EVENT = 'expense-tracker:session-expired';

export interface Session {
  token: string;
  email: string;
}

export function getSession(): Session | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as Session) : null;
  } catch {
    // Storage can be blocked (private mode) or hold something unreadable: treat it as signed out.
    return null;
  }
}

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // If storage is blocked the user stays signed in until they close the tab.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing saved, nothing to clear.
  }
}

import { useId, useState, type FormEvent } from 'react';
import { login, register } from '../api/client.ts';
import type { FieldIssue } from '../types/api.ts';
import './AuthForm.css';

interface AuthFormProps {
  /** Called with the token after a successful sign-in (or sign-up, which signs in right after). */
  onSignedIn: (token: string, email: string) => void;
  /** Optional note above the form, e.g. "Your session expired". */
  notice?: string;
}

type Mode = 'signin' | 'register';

// Small outline icons shown in front of each box (same style as the logo).
const icons = {
  name: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
    </svg>
  ),
  email: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" strokeLinejoin="round" />
    </svg>
  ),
  password: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  )
};

/** Login page: one form with two tabs, "Sign in" and "Create account". */
export default function AuthForm({ onSignedIn, notice }: AuthFormProps) {
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // Unique ids link each label to its input (htmlFor), so the label text is exactly "Name", "Email", "Password".
  const id = useId();

  const isRegister = mode === 'register';
  const errorFor = (field: string) => issues.find((issue) => issue.field === field)?.message;
  const generalErrors = issues.filter((issue) => ['name', 'email', 'password'].includes(issue.field) === false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setIssues([]);
    try {
      if (isRegister) {
        const created = await register(name, email, password);
        if (created.ok === false) {
          setIssues(created.issues);
          return;
        }
      }
      // After creating an account, sign in with the same email and password straight away.
      const result = await login(email, password);
      if (result.ok && result.token) {
        onSignedIn(result.token, email.trim().toLowerCase());
      } else if (result.ok === false) {
        setIssues(result.issues);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function switchTo(next: Mode) {
    setMode(next);
    setIssues([]);
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-side" role="tablist" aria-label="Sign in or create an account">
          <button type="button" role="tab" className="auth-tab" aria-selected={isRegister === false} onClick={() => switchTo('signin')}>
            Sign in
          </button>
          <button type="button" role="tab" className="auth-tab" aria-selected={isRegister} onClick={() => switchTo('register')}>
            Create account
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <img src="/logo.png" alt="" className="auth-logo" />
          <h1 className="auth-title">{isRegister ? 'Create account' : 'Sign in'}</h1>
          <p className="auth-subtitle">Expense Tracker</p>

          {notice && <p className="auth-notice">{notice}</p>}

          {isRegister && (
            <div className="auth-field">
              <label htmlFor={`${id}-name`} className="visually-hidden">
                Name
              </label>
              <div className="auth-input-row">
                {icons.name}
                <input id={`${id}-name`} placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
              </div>
              {errorFor('name') && <p className="auth-error">{errorFor('name')}</p>}
            </div>
          )}

          <div className="auth-field">
            <label htmlFor={`${id}-email`} className="visually-hidden">
              Email
            </label>
            <div className="auth-input-row">
              {icons.email}
              <input
                id={`${id}-email`}
                type="email"
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </div>
            {errorFor('email') && <p className="auth-error">{errorFor('email')}</p>}
          </div>

          <div className="auth-field">
            <label htmlFor={`${id}-password`} className="visually-hidden">
              Password
            </label>
            <div className="auth-input-row">
              {icons.password}
              <input
                id={`${id}-password`}
                type="password"
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
              />
            </div>
            {errorFor('password') && <p className="auth-error">{errorFor('password')}</p>}
            {isRegister && errorFor('password') === undefined && <span className="auth-hint">At least 8 characters.</span>}
          </div>

          {generalErrors.map((issue) => (
            <p key={issue.message} role="alert" className="auth-error">
              {issue.message}
            </p>
          ))}

          <div className="auth-actions">
            <button type="button" className="auth-switch" onClick={() => switchTo(isRegister ? 'signin' : 'register')}>
              {isRegister ? 'Already have an account?' : 'Create an account'}
            </button>
            <button type="submit" className="auth-submit" disabled={submitting}>
              {submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

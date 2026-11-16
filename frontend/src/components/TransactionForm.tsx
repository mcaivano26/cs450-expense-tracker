import { useState, type CSSProperties, type FormEvent } from 'react';
import type { FieldIssue, NewTransaction, TransactionType } from '../types/api.ts';

export const CATEGORIES: Record<TransactionType, string[]> = {
  expense: ['Food', 'Bills', 'Transport', 'Shopping', 'Health', 'Entertainment', 'Other'],
  income: ['Salary', 'Freelance', 'Gift', 'Refund', 'Other']
};

const PLACEHOLDERS: Record<TransactionType, { title: string; amount: string }> = {
  expense: { title: 'Coffee', amount: '4.50' },
  income: { title: 'Paycheck', amount: '1200.00' }
};
const today = () => new Date().toISOString().slice(0, 10);

export interface TransactionFormProps {
  heading: string;
  submitLabel: (type: TransactionType) => string;
  onSubmit: (values: NewTransaction) => Promise<FieldIssue[] | null>;
  onSuccess: (values: NewTransaction) => void;
  initialValues?: NewTransaction;
  onCancel?: () => void;
  resetAfterSave?: boolean;
  successMessage?: (type: TransactionType) => string;
  formStyle?: CSSProperties;
}

/** Shared fields, validation feedback, and save flow for creating and editing transactions. */
export default function TransactionForm({ heading, submitLabel, onSubmit, onSuccess, initialValues, onCancel, resetAfterSave = false, successMessage, formStyle }: TransactionFormProps) {
  const defaults = initialValues ?? { type: 'expense' as const, title: '', amount: undefined, category: CATEGORIES.expense[0], date: today(), description: '' };
  const [type, setType] = useState<TransactionType>(defaults.type);
  const [title, setTitle] = useState(defaults.title);
  const [amount, setAmount] = useState(defaults.amount === undefined ? '' : String(defaults.amount));
  const [category, setCategory] = useState(defaults.category);
  const [date, setDate] = useState(defaults.date);
  const [description, setDescription] = useState(defaults.description ?? '');
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  const errorFor = (field: string) => issues.find((issue) => issue.field === field)?.message;
  const categories = CATEGORIES[type].includes(category) ? CATEGORIES[type] : [category, ...CATEGORIES[type]];
  const accent = type === 'expense' ? '#dc2626' : '#16a34a';
  const input: CSSProperties = { width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: 8, boxSizing: 'border-box' };
  const label: CSSProperties = { display: 'block', fontSize: '0.85rem', color: '#334155', marginBottom: 4 };
  const error: CSSProperties = { color: '#dc2626', fontSize: '0.8rem', marginTop: 4 };

  function switchType(next: TransactionType) {
    setType(next);
    setCategory(CATEGORIES[next][0]);
    setIssues([]);
    setSavedMessage('');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSavedMessage('');
    const values: NewTransaction = { type, title, amount: amount === '' ? undefined : Number(amount), category, date, description };
    const result = await onSubmit(values);
    setSaving(false);
    if (result) {
      setIssues(result);
      return;
    }
    setIssues([]);
    if (resetAfterSave) {
      setTitle('');
      setAmount('');
      setDescription('');
      setDate(today());
    }
    if (successMessage) setSavedMessage(successMessage(type));
    onSuccess(values);
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={formStyle}>
      <h2 style={{ marginTop: 0 }}>{heading}</h2>
      <div role="group" aria-label="Transaction type" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {(['expense', 'income'] as const).map((option) => (
          <button key={option} type="button" aria-pressed={type === option} onClick={() => switchType(option)} style={{ padding: '0.45rem 1rem', border: `1px solid ${type === option ? (option === 'expense' ? '#dc2626' : '#16a34a') : '#cbd5e1'}`, background: type === option ? (option === 'expense' ? '#dc2626' : '#16a34a') : '#fff', color: type === option ? '#fff' : '#334155', borderRadius: 999, cursor: 'pointer', fontWeight: 600 }}>
            {option === 'expense' ? 'Expense' : 'Income'}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <div><label style={label} htmlFor="transaction-title">Title</label><input id="transaction-title" style={input} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={PLACEHOLDERS[type].title} />{errorFor('title') && <div style={error}>{errorFor('title')}</div>}</div>
        <div><label style={label} htmlFor="transaction-amount">Amount ($)</label><input id="transaction-amount" style={input} type="number" step="0.01" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={PLACEHOLDERS[type].amount} />{errorFor('amount') && <div style={error}>{errorFor('amount')}</div>}</div>
        <div><label style={label} htmlFor="transaction-category">Category</label><select id="transaction-category" style={input} value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select>{errorFor('category') && <div style={error}>{errorFor('category')}</div>}</div>
        <div><label style={label} htmlFor="transaction-date">Date</label><input id="transaction-date" style={input} type="date" value={date} onChange={(event) => setDate(event.target.value)} />{errorFor('date') && <div style={error}>{errorFor('date')}</div>}</div>
      </div>
      <div style={{ marginTop: '1rem' }}><label style={label} htmlFor="transaction-description">Note (optional)</label><input id="transaction-description" style={input} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Any extra details" />{errorFor('description') && <div style={error}>{errorFor('description')}</div>}</div>
      {errorFor('') && <div style={{ ...error, marginTop: '1rem' }}>{errorFor('')}</div>}
      <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button type="submit" disabled={saving} style={{ background: accent, color: '#fff', border: 0, borderRadius: 8, padding: '0.6rem 1.2rem', cursor: 'pointer' }}>{saving ? 'Saving...' : submitLabel(type)}</button>
        {onCancel && <button type="button" disabled={saving} onClick={onCancel} style={{ background: '#fff', color: '#334155', border: '1px solid #94a3b8', borderRadius: 8, padding: '0.6rem 1.2rem', cursor: 'pointer' }}>Cancel</button>}
        {savedMessage && <span style={{ color: '#16a34a' }}>{savedMessage}</span>}
      </div>
    </form>
  );
}

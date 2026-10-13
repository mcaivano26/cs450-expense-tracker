import { useState, type FormEvent } from 'react';
import { createExpense } from '../api/client.ts';
import type { FieldIssue } from '../types/api.ts';

const CATEGORIES = ['Food', 'Bills', 'Transport', 'Shopping', 'Health', 'Entertainment', 'Other'];
const today = () => new Date().toISOString().slice(0, 10);

interface Props {
  onSaved: () => void;
}

export default function AddExpenseForm({ onSaved }: Props) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState('');
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const errorFor = (field: string) => issues.find((i) => i.field === field)?.message;
  const generalError = issues.find((i) => i.field === '')?.message;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const result = await createExpense({
      title,
      amount: amount === '' ? undefined : Number(amount),
      category,
      date,
      description
    });
    setSaving(false);
    if (result) {
      setIssues(result);
      return;
    }
    setIssues([]);
    setTitle('');
    setAmount('');
    setDescription('');
    setDate(today());
    setSaved(true);
    onSaved();
  }

  const input: React.CSSProperties = { width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: 8, boxSizing: 'border-box' };
  const err: React.CSSProperties = { color: '#dc2626', fontSize: '0.8rem', marginTop: 4 };
  const label: React.CSSProperties = { display: 'block', fontSize: '0.85rem', color: '#334155', marginBottom: 4 };

  return (
    <form onSubmit={handleSubmit} noValidate style={{ background: '#fff', borderRadius: 12, padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '2rem' }}>
      <h2 style={{ marginTop: 0 }}>Add an expense</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <div>
          <label style={label} htmlFor="title">Title</label>
          <input id="title" style={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Coffee" />
          {errorFor('title') && <div style={err}>{errorFor('title')}</div>}
        </div>
        <div>
          <label style={label} htmlFor="amount">Amount ($)</label>
          <input id="amount" style={input} type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="4.50" />
          {errorFor('amount') && <div style={err}>{errorFor('amount')}</div>}
        </div>
        <div>
          <label style={label} htmlFor="category">Category</label>
          <select id="category" style={input} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          {errorFor('category') && <div style={err}>{errorFor('category')}</div>}
        </div>
        <div>
          <label style={label} htmlFor="date">Date</label>
          <input id="date" style={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          {errorFor('date') && <div style={err}>{errorFor('date')}</div>}
        </div>
      </div>
      <div style={{ marginTop: '1rem' }}>
        <label style={label} htmlFor="description">Note (optional)</label>
        <input id="description" style={input} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Any extra details" />
        {errorFor('description') && <div style={err}>{errorFor('description')}</div>}
      </div>
      {generalError && <div style={{ ...err, marginTop: '1rem' }}>{generalError}</div>}
      <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button type="submit" disabled={saving} style={{ background: '#1d4ed8', color: '#fff', border: 0, borderRadius: 8, padding: '0.6rem 1.2rem', cursor: 'pointer' }}>
          {saving ? 'Saving…' : 'Add expense'}
        </button>
        {saved && <span style={{ color: '#16a34a' }}>Expense saved ✓</span>}
      </div>
    </form>
  );
}

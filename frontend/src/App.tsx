import { useEffect, useState } from 'react';
import { fetchCategories, fetchMonthlySummary, fetchSummary, fetchTransactions } from './api/client.ts';
import type { MonthlySummary, Summary, Transaction } from './types/api.ts';
import AddTransactionForm from './components/AddTransactionForm.tsx';
import EditTransactionForm from './components/EditTransactionForm.tsx';
import CategoryFilter, { ALL_CATEGORIES } from './components/CategoryFilter.tsx';
import MonthlySummaryCards from './components/MonthlySummaryCards.tsx';
import { currentMonth, shiftMonth } from './utils/month.ts';

interface AppProps {
  /** Login page: who is signed in, shown in the header. */
  userEmail?: string;
  onLogOut?: () => void;
}

export default function App({ userEmail, onLogOut }: AppProps = {}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  // F26B-10: '' means "All categories".
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState(ALL_CATEGORIES);
  // F26B-7: the month shown in the monthly cards, as "YYYY-MM". Starts on this month.
  const [month, setMonth] = useState(currentMonth);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [txns, sum, cats, monthly] = await Promise.all([
        fetchTransactions(category),
        fetchSummary(),
        fetchCategories(),
        fetchMonthlySummary(month)
      ]);
      setTransactions(txns);
      setSummary(sum);
      setCategories(cats);
      setMonthlySummary(monthly);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  /** Reloads the list and cards after a save, without the full-page "Loading…" screen. */
  async function refreshAfterSave() {
    try {
      // F26B-7: the monthly cards are reloaded too, so a new transaction shows up in this month's totals.
      const [txns, sum, cats, monthly] = await Promise.all([
        fetchTransactions(category),
        fetchSummary(),
        fetchCategories(),
        fetchMonthlySummary(month)
      ]);
      setTransactions(txns);
      setSummary(sum);
      setEditingTransaction(null);
      setCategories(cats);
      setMonthlySummary(monthly);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  /** F26B-10: picking a category reloads only the list. The summary cards keep showing all transactions. */
  async function changeCategory(next: string) {
    setCategory(next);
    try {
      setTransactions(await fetchTransactions(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  /** F26B-7: moving to another month reloads only the monthly cards. */
  async function changeMonth(next: string) {
    setMonth(next);
    try {
      setMonthlySummary(await fetchMonthlySummary(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  if (loading) {
    return <div style={{ padding: '2rem' }}>Loading…</div>;
  }

  if (error || !summary || !monthlySummary) {
    return (
      <div style={{ padding: '2rem', color: '#991b1b' }}>
        <p>Could not load data: {error}</p>
        <p>Is the backend running on port 4002?</p>
        <button onClick={loadData}>Try again</button>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '2rem', background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <img src="/logo.png" alt="" width={36} height={36} />
          Expense Tracker
        </h1>
        {onLogOut && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ color: '#6b7280' }}>Signed in as {userEmail}</span>
            <button type="button" onClick={onLogOut}>
              Log out
            </button>
          </div>
        )}
      </div>

      <MonthlySummaryCards
        summary={monthlySummary}
        onPreviousMonth={() => changeMonth(shiftMonth(month, -1))}
        onNextMonth={() => changeMonth(shiftMonth(month, 1))}
      />

      <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.25rem' }}>All time</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: '#d1fae5', padding: '1rem', borderRadius: '12px' }}>
          <div style={{ color: '#065f46' }}>Income</div>
          <h2 style={{ margin: '0.5rem 0 0' }}>${summary.totalIncome.toFixed(2)}</h2>
        </div>
        <div style={{ background: '#fee2e2', padding: '1rem', borderRadius: '12px' }}>
          <div style={{ color: '#991b1b' }}>Expenses</div>
          <h2 style={{ margin: '0.5rem 0 0' }}>${summary.totalExpenses.toFixed(2)}</h2>
        </div>
        <div style={{ background: '#dbeafe', padding: '1rem', borderRadius: '12px' }}>
          <div style={{ color: '#1d4ed8' }}>Net</div>
          <h2 style={{ margin: '0.5rem 0 0' }}>${summary.net.toFixed(2)}</h2>
        </div>
      </div>

      <AddTransactionForm onSaved={refreshAfterSave} />

      <div style={{ background: '#fff', borderRadius: '12px', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        {editingTransaction && <EditTransactionForm key={editingTransaction.id} transaction={editingTransaction} onSaved={refreshAfterSave} onCancel={() => setEditingTransaction(null)} />}
        {transactions.length === 0 && <p style={{ color: '#6b7280' }}>No transactions yet.</p>}
        <CategoryFilter categories={categories} value={category} onChange={changeCategory} />
        {transactions.length === 0 && category === ALL_CATEGORIES && <p style={{ color: '#6b7280' }}>No transactions yet.</p>}
        {transactions.length === 0 && category !== ALL_CATEGORIES && (
          <p style={{ color: '#6b7280' }}>
            No transactions in "{category}".{' '}
            <button type="button" onClick={() => changeCategory(ALL_CATEGORIES)}>
              Show all
            </button>
          </p>
        )}
        {transactions.map((tx) => (
          <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #e5e7eb' }}>
            <div>
              <strong>{tx.title}</strong>
              <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                {tx.category} · {new Date(tx.date).toLocaleDateString(undefined, { timeZone: 'UTC' })}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ color: tx.type === 'expense' ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                {tx.type === 'expense' ? '-' : '+'}${tx.amount.toFixed(2)}
              </div>
              <button type="button" onClick={() => setEditingTransaction(tx)} style={{ background: '#fff', color: '#2563eb', border: '1px solid #93c5fd', borderRadius: 6, padding: '0.35rem 0.65rem', cursor: 'pointer' }}>Edit</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

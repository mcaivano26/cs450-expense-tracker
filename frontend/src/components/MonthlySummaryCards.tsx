import type { MonthlySummary } from '../types/api.ts';
import { formatMonth } from '../utils/month.ts';

interface MonthlySummaryCardsProps {
  summary: MonthlySummary;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
}

/** F26B-7: income, expenses and net for the selected month, with buttons to move between months. */
export default function MonthlySummaryCards({ summary, onPreviousMonth, onNextMonth }: MonthlySummaryCardsProps) {
  const label = formatMonth(summary.month);

  return (
    <section aria-label="Monthly summary" style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <button type="button" onClick={onPreviousMonth}>
          Previous month
        </button>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{label}</h2>
        <button type="button" onClick={onNextMonth}>
          Next month
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: '1rem' }}>
        <div style={{ background: '#d1fae5', padding: '1rem', borderRadius: '12px' }}>
          <div style={{ color: '#065f46' }}>Income this month</div>
          <h3 style={{ margin: '0.5rem 0 0' }}>${summary.totalIncome.toFixed(2)}</h3>
        </div>
        <div style={{ background: '#fee2e2', padding: '1rem', borderRadius: '12px' }}>
          <div style={{ color: '#991b1b' }}>Expenses this month</div>
          <h3 style={{ margin: '0.5rem 0 0' }}>${summary.totalExpenses.toFixed(2)}</h3>
        </div>
        <div style={{ background: '#dbeafe', padding: '1rem', borderRadius: '12px' }}>
          <div style={{ color: '#1d4ed8' }}>Net this month</div>
          <h3 style={{ margin: '0.5rem 0 0' }}>${summary.net.toFixed(2)}</h3>
        </div>
      </div>

      {summary.transactionCount === 0 && (
        <p style={{ color: '#6b7280', marginTop: '0.75rem' }}>No transactions in {label}.</p>
      )}
    </section>
  );
}

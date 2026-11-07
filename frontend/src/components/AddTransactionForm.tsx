import { createTransaction } from '../api/client.ts';
import TransactionForm from './TransactionForm.tsx';

interface Props {
  onSaved: () => void;
}

/** API-specific wrapper around the shared transaction form for creating entries. */
export default function AddTransactionForm({ onSaved }: Props) {
  return (
    <TransactionForm
      heading="Add a transaction"
      submitLabel={(type) => `Add ${type}`}
      onSubmit={createTransaction}
      onSuccess={onSaved}
      resetAfterSave
      successMessage={(type) => `${type === 'expense' ? 'Expense' : 'Income'} saved ✓`}
      formStyle={{ background: '#fff', borderRadius: 12, padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '2rem' }}
    />
  );
}

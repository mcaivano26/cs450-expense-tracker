import { updateTransaction } from '../api/client.ts';
import type { Transaction } from '../types/api.ts';
import TransactionForm from './TransactionForm.tsx';

interface Props {
  transaction: Transaction;
  onSaved: () => void;
  onCancel: () => void;
}

/** API-specific wrapper around the shared transaction form for editing entries. */
export default function EditTransactionForm({ transaction, onSaved, onCancel }: Props) {
  return (
    <TransactionForm
      heading="Edit transaction"
      submitLabel={() => 'Save changes'}
      initialValues={{
        type: transaction.type,
        title: transaction.title,
        amount: transaction.amount,
        category: transaction.category,
        date: new Date(transaction.date).toISOString().slice(0, 10),
        description: transaction.description ?? ''
      }}
      onSubmit={(values) => updateTransaction(transaction.id, values)}
      onSuccess={onSaved}
      onCancel={onCancel}
      formStyle={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}
    />
  );
}

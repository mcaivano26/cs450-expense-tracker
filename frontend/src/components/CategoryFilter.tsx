/** Value of the "All categories" option: an empty string means no filter. */
export const ALL_CATEGORIES = '';

interface CategoryFilterProps {
  categories: string[];
  value: string;
  onChange: (category: string) => void;
}

/** F26B-10: dropdown that picks which category the transaction list shows. */
export default function CategoryFilter({ categories, value, onChange }: CategoryFilterProps) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
      <span style={{ fontWeight: 600 }}>Filter by category</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value={ALL_CATEGORIES}>All categories</option>
        {categories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
    </label>
  );
}

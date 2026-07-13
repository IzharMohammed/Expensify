'use client';

import { useMemo, useState } from 'react';
import { Category } from '@/lib/expense-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type CategoryPickerProps = {
  categories: Category[];
  disabled?: boolean;
  onCreate: (name: string) => Promise<Category | null>;
  onSelect: (category: Category | null) => void;
  value: Category | null;
};

export function CategoryPicker({
  categories,
  disabled,
  onCreate,
  onSelect,
  value,
}: CategoryPickerProps) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return categories;
    }

    return categories.filter((category) => category.name.toLowerCase().includes(normalized));
  }, [categories, query]);

  const canCreate =
    query.trim().length > 0 &&
    !categories.some((category) => category.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className="space-y-3 rounded-2xl bg-secondary/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Category</p>
        {value ? (
          <button
            className="text-xs text-muted-foreground underline underline-offset-4"
            onClick={() => onSelect(null)}
            type="button"
          >
            Clear
          </button>
        ) : null}
      </div>
      <Input
        disabled={disabled || creating}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search or create category"
        value={query}
      />
      <div className="max-h-52 space-y-2 overflow-auto">
        {filtered.map((category) => (
          <button
            key={category.id}
            className={`flex w-full items-center justify-between rounded-[10px] px-3 py-2.5 text-left text-sm font-medium transition ${
              value?.id === category.id ? 'bg-primary text-primary-foreground' : 'bg-secondary/70 hover:bg-secondary'
            }`}
            disabled={disabled}
            onClick={() => onSelect(category)}
            type="button"
          >
            <span>{category.name}</span>
            <span
              aria-hidden="true"
              className="h-3 w-3 rounded-full border border-white/60"
              style={{ backgroundColor: category.color }}
            />
          </button>
        ))}
        {filtered.length === 0 ? (
          <p className="rounded-lg bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">
            No category matches.
          </p>
        ) : null}
      </div>
      {canCreate ? (
        <Button
          disabled={disabled || creating}
          onClick={async () => {
            setCreating(true);
            const category = await onCreate(query.trim());
            if (category) {
              setQuery('');
              onSelect(category);
            }
            setCreating(false);
          }}
          type="button"
          variant="outline"
        >
          + Create new category
        </Button>
      ) : null}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { LoaderCircle, Paperclip, Plus, ReceiptText, Search, SlidersHorizontal, Tag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { MoneyDisplay } from '@/components/ui/money-display';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { Category, ExpenseRecord, ExpenseTag } from '@/lib/expense-types';
import { ExpenseAttachments } from './expense-attachments';

const PAYMENT_METHODS = ['upi', 'card', 'cash', 'netbanking'] as const;
const AMOUNT_CEILING = 100_000;

type Filters = {
  q: string;
  minAmount: number;
  maxAmount: number;
  amountEnabled: boolean;
  categoryIds: string[];
  paymentMethods: string[];
  dateFrom: string;
  dateTo: string;
  tagIds: string[];
};

const EMPTY_FILTERS: Filters = {
  q: '',
  minAmount: 0,
  maxAmount: AMOUNT_CEILING,
  amountEnabled: false,
  categoryIds: [],
  paymentMethods: [],
  dateFrom: '',
  dateTo: '',
  tagIds: [],
};

export function ExpenseSearch(props: {
  categories: Category[];
  initialExpenses: ExpenseRecord[];
}) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [expenses, setExpenses] = useState(props.initialExpenses);
  const [knownTags, setKnownTags] = useState<ExpenseTag[]>(() =>
    collectTags(props.initialExpenses),
  );
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(props.initialExpenses.length);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchKey = JSON.stringify(filters);
  const refreshKey = props.initialExpenses[0]?.id ?? '';

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(page), limit: '10' });
        if (filters.q.trim()) params.set('q', filters.q.trim());
        if (filters.amountEnabled) {
          params.set('min_amount', String(filters.minAmount));
          params.set('max_amount', String(filters.maxAmount));
        }
        if (filters.categoryIds.length) params.set('category_id', filters.categoryIds.join(','));
        if (filters.paymentMethods.length) {
          params.set('payment_method', filters.paymentMethods.join(','));
        }
        if (filters.dateFrom) params.set('date_from', filters.dateFrom);
        if (filters.dateTo) params.set('date_to', filters.dateTo);
        if (filters.tagIds.length) params.set('tag_id', filters.tagIds.join(','));

        const response = await api.get(`/expenses/search?${params.toString()}`, {
          signal: controller.signal,
        });
        setExpenses(response.data.expenses);
        setKnownTags(response.data.availableTags);
        setTotal(response.data.pagination.total);
        setTotalPages(response.data.pagination.totalPages);
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(getError(requestError, 'Could not search expenses'));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, filters.q ? 300 : 80);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [page, searchKey, refreshKey]);

  function patchFilters(patch: Partial<Filters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }

  function updateExpenseTags(expenseId: string, tags: ExpenseTag[]) {
    setExpenses((current) =>
      current.map((expense) => (expense.id === expenseId ? { ...expense, tags } : expense)),
    );
    setKnownTags((current) => {
      const byId = new Map(current.map((tag) => [tag.id, tag]));
      for (const tag of tags) byId.set(tag.id, tag);
      return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  function filterByTag(tag: ExpenseTag) {
    patchFilters({ tagIds: [tag.id] });
    setShowFilters(true);
  }

  const activeFilterCount =
    Number(filters.amountEnabled) +
    filters.categoryIds.length +
    filters.paymentMethods.length +
    Number(Boolean(filters.dateFrom || filters.dateTo)) +
    filters.tagIds.length;

  return (
    <Card>
      <CardHeader className="gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <CardTitle className="font-display text-2xl">Your ledger</CardTitle>
          <CardDescription>
            Search merchants and notes, combine filters, and organize entries with tags.
          </CardDescription>
        </div>
        <div className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground">{total} entries</div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col gap-2 rounded-2xl bg-secondary/45 p-2 sm:flex-row">
          <label className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="border-0 bg-card pl-9 shadow-sm"
              onChange={(event) => patchFilters({ q: event.target.value })}
              placeholder="Search merchant or note"
              value={filters.q}
            />
          </label>
          <Button className="border-0" onClick={() => setShowFilters((current) => !current)} type="button" variant="secondary">
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
          </Button>
        </div>

        {showFilters ? (
          <FilterPanel
            categories={props.categories}
            filters={filters}
            knownTags={knownTags}
            onChange={patchFilters}
            onClear={() => {
              setFilters(EMPTY_FILTERS);
              setPage(1);
            }}
          />
        ) : null}

        {error ? (
          <div className="rounded-xl border border-danger/15 bg-danger/10 p-3 text-sm text-danger">{error}</div>
        ) : null}

        <div className="relative space-y-3">
          {loading ? (
            <div className="absolute inset-0 z-10 space-y-3 rounded-2xl bg-card/80 backdrop-blur-sm">{[0, 1, 2].map((item) => <Skeleton className="h-24 rounded-2xl" key={item} />)}</div>
          ) : null}
          {!loading && expenses.length === 0 ? (
            <EmptyState description="Try removing a filter or search for a different merchant or note." icon={ReceiptText} title="No matching expenses" />
          ) : null}
          {expenses.map((expense) => (
            <ExpenseRow
              allTags={knownTags}
              expense={expense}
              key={expense.id}
              onTagFilter={filterByTag}
              onTagsChange={(tags) => updateExpenseTags(expense.id, tags)}
            />
          ))}
        </div>

        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t pt-4 text-sm">
            <Button disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)} variant="outline">
              Previous
            </Button>
            <span className="text-muted-foreground">Page {page} of {totalPages}</span>
            <Button disabled={page === totalPages || loading} onClick={() => setPage((value) => value + 1)} variant="outline">
              Next
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FilterPanel(props: {
  categories: Category[];
  filters: Filters;
  knownTags: ExpenseTag[];
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
}) {
  const { filters } = props;
  return (
    <div className="grid gap-5 rounded-2xl border border-border/55 bg-raised p-4 md:grid-cols-2">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Amount range</p>
          <button
            className="text-xs text-muted-foreground underline"
            onClick={() => props.onChange({ amountEnabled: false, minAmount: 0, maxAmount: AMOUNT_CEILING })}
            type="button"
          >
            Reset
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label>
            <span className="text-xs text-muted-foreground">Minimum</span>
            <Input
              min="0"
              onChange={(event) =>
                props.onChange({ amountEnabled: true, minAmount: Number(event.target.value) })
              }
              type="number"
              value={filters.minAmount}
            />
          </label>
          <label>
            <span className="text-xs text-muted-foreground">Maximum</span>
            <Input
              min="0"
              onChange={(event) =>
                props.onChange({ amountEnabled: true, maxAmount: Number(event.target.value) })
              }
              type="number"
              value={filters.maxAmount}
            />
          </label>
        </div>
        <div className="relative h-6">
          <input
            aria-label="Minimum amount"
            className="absolute inset-x-0 top-1 w-full accent-primary"
            max={AMOUNT_CEILING}
            min="0"
            onChange={(event) =>
              props.onChange({
                amountEnabled: true,
                minAmount: Math.min(Number(event.target.value), filters.maxAmount),
              })
            }
            step="100"
            type="range"
            value={filters.minAmount}
          />
          <input
            aria-label="Maximum amount"
            className="absolute inset-x-0 top-3 w-full accent-primary"
            max={AMOUNT_CEILING}
            min="0"
            onChange={(event) =>
              props.onChange({
                amountEnabled: true,
                maxAmount: Math.max(Number(event.target.value), filters.minAmount),
              })
            }
            step="100"
            type="range"
            value={filters.maxAmount}
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Date range</p>
        <div className="grid grid-cols-2 gap-3">
          <Input onChange={(event) => props.onChange({ dateFrom: event.target.value })} type="date" value={filters.dateFrom} />
          <Input onChange={(event) => props.onChange({ dateTo: event.target.value })} type="date" value={filters.dateTo} />
        </div>
      </div>

      <FilterChips
        label="Categories"
        onToggle={(id) => props.onChange({ categoryIds: toggle(filters.categoryIds, id) })}
        options={props.categories.map((category) => ({ id: category.id, label: category.name }))}
        selected={filters.categoryIds}
      />
      <FilterChips
        label="Payment methods"
        onToggle={(id) => props.onChange({ paymentMethods: toggle(filters.paymentMethods, id) })}
        options={PAYMENT_METHODS.map((method) => ({ id: method, label: method }))}
        selected={filters.paymentMethods}
      />

      {props.knownTags.length ? (
        <FilterChips
          label="Tags"
          onToggle={(id) => props.onChange({ tagIds: toggle(filters.tagIds, id) })}
          options={props.knownTags.map((tag) => ({ id: tag.id, label: tag.name }))}
          selected={filters.tagIds}
        />
      ) : null}
      <div className="flex items-end justify-end">
        <Button className="h-8 px-3" onClick={props.onClear} type="button" variant="secondary">
          Clear all filters
        </Button>
      </div>
    </div>
  );
}

function FilterChips(props: {
  label: string;
  options: Array<{ id: string; label: string }>;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{props.label}</p>
      <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
        {props.options.map((option) => (
          <button
            className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
              props.selected.includes(option.id)
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-card hover:border-primary/30'
            }`}
            key={option.id}
            onClick={() => props.onToggle(option.id)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ExpenseRow(props: {
  expense: ExpenseRecord;
  allTags: ExpenseTag[];
  onTagFilter: (tag: ExpenseTag) => void;
  onTagsChange: (tags: ExpenseTag[]) => void;
}) {
  const [tagInput, setTagInput] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attachedIds = new Set((props.expense.tags ?? []).map((tag) => tag.id));
  const suggestions = props.allTags.filter(
    (tag) => !attachedIds.has(tag.id) && tag.name.toLowerCase().includes(tagInput.toLowerCase()),
  );

  async function addTag(tag?: ExpenseTag) {
    const name = tagInput.trim();
    if (!tag && !name) return;
    setSaving(true);
    setError(null);
    try {
      const response = await api.post(`/expenses/${props.expense.id}/tags`, tag
        ? { tagIds: [tag.id], names: [] }
        : { tagIds: [], names: [name] });
      props.onTagsChange(response.data.tags);
      setTagInput('');
      setEditing(false);
    } catch (requestError) {
      setError(getError(requestError, 'Could not add tag'));
    } finally {
      setSaving(false);
    }
  }

  async function removeTag(tagId: string) {
    setSaving(true);
    setError(null);
    try {
      await api.delete(`/expenses/${props.expense.id}/tags/${tagId}`);
      props.onTagsChange(props.expense.tags.filter((tag) => tag.id !== tagId));
    } catch (requestError) {
      setError(getError(requestError, 'Could not remove tag'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="group rounded-2xl border border-border/55 bg-card p-4 text-sm transition hover:border-primary/15 hover:shadow-soft sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{props.expense.merchant}</p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{props.expense.date.slice(0, 10)}</span>
            <span className="capitalize">{props.expense.source}</span>
            {props.expense.paymentMethod ? <span className="capitalize">{props.expense.paymentMethod}</span> : null}
          </div>
          {props.expense.note ? <p className="mt-2 text-xs text-muted-foreground">{props.expense.note}</p> : null}
        </div>
        <MoneyDisplay amount={props.expense.amount} className="whitespace-nowrap text-base font-bold" decimals={2} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(props.expense.tags ?? []).map((tag) => (
          <span className="inline-flex items-center rounded-full bg-accent text-xs text-accent-foreground" key={tag.id}>
            <button className="px-2.5 py-1" onClick={() => props.onTagFilter(tag)} type="button">#{tag.name}</button>
            <button
              aria-label={`Remove ${tag.name} tag`}
              className="border-l border-primary/10 px-1.5 py-1 hover:bg-primary/10"
              disabled={saving}
              onClick={() => void removeTag(tag.id)}
              type="button"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <button
          className="inline-flex items-center rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground hover:border-slate-400 hover:text-foreground"
          onClick={() => setEditing((current) => !current)}
          type="button"
        >
          <Tag className="mr-1 h-3 w-3" /> Add tag
        </button>
        <button className="inline-flex items-center rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground" onClick={() => setAttachmentsOpen(true)} type="button"><Paperclip className="mr-1 h-3 w-3" />Attachments</button>
      </div>

      {editing ? (
        <div className="relative mt-3 max-w-sm">
          <div className="flex gap-2">
            <Input
              autoFocus
              disabled={saving}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void addTag();
                }
              }}
              placeholder="Search or create a tag"
              value={tagInput}
            />
            <Button
              className="h-10 px-3"
              disabled={saving || !tagInput.trim()}
              onClick={() => void addTag()}
              type="button"
            >
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
          {suggestions.length ? (
            <div className="absolute z-20 mt-1 w-full rounded-xl border bg-card p-1 shadow-lift">
              {suggestions.slice(0, 6).map((tag) => (
                <button className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary" key={tag.id} onClick={() => void addTag(tag)} type="button">
                  #{tag.name}
                </button>
              ))}
            </div>
          ) : null}
          {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
        </div>
      ) : null}
      <ExpenseAttachments expense={props.expense} onClose={() => setAttachmentsOpen(false)} open={attachmentsOpen} />
    </article>
  );
}

function toggle(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function collectTags(expenses: ExpenseRecord[]) {
  const byId = new Map<string, ExpenseTag>();
  for (const expense of expenses) {
    for (const tag of expense.tags ?? []) byId.set(tag.id, tag);
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function getError(error: unknown, fallback: string) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  ) {
    const message = (error as { response?: { data?: { message?: unknown } } }).response?.data?.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join(', ');
  }
  return fallback;
}

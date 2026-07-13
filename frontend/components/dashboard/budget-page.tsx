'use client';

import { useEffect, useMemo, useState } from 'react';
import { CircleGauge, Landmark, Save } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MoneyDisplay } from '@/components/ui/money-display';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { BudgetListResponse, BudgetRow } from '@/lib/dashboard-types';

type BudgetDraftMap = Record<string, string>;

export function BudgetPage() {
  const month = currentMonth();
  const [budgetData, setBudgetData] = useState<BudgetListResponse | null>(null);
  const [drafts, setDrafts] = useState<BudgetDraftMap>({});
  const [income, setIncome] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'loading'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadBudgets();
  }, []);

  async function loadBudgets() {
    setStatus('loading');
    setError(null);
    try {
      const response = await api.get('/budgets', { params: { month } });
      const data = response.data as BudgetListResponse;
      setBudgetData(data);
      setIncome(String(data.income || ''));
      setDrafts(
        Object.fromEntries(
          data.budgets.map((budget) => [budget.categoryId, budget.budgetAmount?.toString() ?? '']),
        ),
      );
      setStatus('idle');
    } catch (loadError) {
      setError(readError(loadError, 'Failed to load budgets'));
      setStatus('idle');
    }
  }

  async function saveBudgets() {
    if (!budgetData) {
      return;
    }

    setStatus('saving');
    setError(null);
    try {
      const budgetRequests = budgetData.budgets
        .filter((budget) => drafts[budget.categoryId]?.trim())
        .map((budget) =>
          api.post('/budgets', {
            categoryId: budget.categoryId,
            amount: drafts[budget.categoryId],
            month,
          }),
        );

      await Promise.all([
        api.post('/budgets/income', {
          amount: income || '0',
          month,
        }),
        ...budgetRequests,
      ]);

      await loadBudgets();
    } catch (saveError) {
      setError(readError(saveError, 'Failed to save budgets'));
      setStatus('idle');
    }
  }

  const totals = useMemo(() => {
    const spent = budgetData?.budgets.reduce((sum, item) => sum + item.spent, 0) ?? 0;
    const budgeted =
      budgetData?.budgets.reduce((sum, item) => sum + (item.budgetAmount ?? 0), 0) ?? 0;
    return { spent, budgeted };
  }, [budgetData]);

  const remaining = (budgetData?.income ?? 0) - totals.spent;

  return (
    <AppShell description={`Set your income and category limits for ${month}.`} eyebrow="Plan" title="Monthly budgets">
      <div className="space-y-6 sm:space-y-8">
        <section className="grid overflow-hidden rounded-3xl bg-primary text-primary-foreground sm:grid-cols-3">
          <BudgetHeroMetric icon={Landmark} label="Monthly income" value={budgetData?.income ?? 0} loading={status === 'loading'} />
          <BudgetHeroMetric icon={CircleGauge} label="Budgeted" value={totals.budgeted} loading={status === 'loading'} />
          <BudgetHeroMetric icon={CircleGauge} label="Remaining after spend" value={remaining} loading={status === 'loading'} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <Card className="h-fit xl:sticky xl:top-8">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Set your plan</CardTitle>
              <CardDescription>Enter income and the amount you want available to each category.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Monthly income</label>
                <div className="relative"><span className="absolute left-3.5 top-3 text-sm text-muted-foreground">₹</span><Input className="pl-8 money-figures" onChange={(event) => setIncome(event.target.value)} value={income} /></div>
              </div>

              <div className="space-y-3">
                {budgetData?.budgets.map((budget) => (
                  <div key={budget.categoryId} className="grid gap-2 sm:grid-cols-[1fr_180px] sm:items-center">
                    <label className="text-sm font-semibold">{budget.categoryName}</label>
                    <Input
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [budget.categoryId]: event.target.value,
                        }))
                      }
                      className="money-figures"
                      placeholder="₹0"
                      value={drafts[budget.categoryId] ?? ''}
                    />
                  </div>
                ))}
              </div>

              {error ? <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p> : null}

              <Button className="w-full" disabled={status === 'saving' || status === 'loading'} onClick={() => void saveBudgets()} size="lg" type="button">
                <Save className="h-4 w-4" />{status === 'saving' ? 'Saving plan...' : 'Save monthly plan'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-2xl">Category pacing</CardTitle>
              <CardDescription>How this month’s spending compares with your plan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {budgetData?.budgets.map((budget) => (
                <BudgetProgressRow key={budget.categoryId} budget={budget} />
              ))}
              {!budgetData && status === 'loading' ? [0, 1, 2, 3].map((item) => <Skeleton className="h-24 rounded-2xl" key={item} />) : null}
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}

function BudgetProgressRow({ budget }: { budget: BudgetRow }) {
  const percentage = budget.budgetAmount ? Math.min(100, budget.percentage) : 0;
  const indicatorClassName =
    budget.percentage >= 80
      ? budget.percentage >= 100
        ? 'bg-danger'
        : 'bg-warning'
      : 'bg-success';

  return (
    <div className="group space-y-3 rounded-2xl bg-secondary/35 p-4 transition-colors hover:bg-secondary/55 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{budget.categoryName}</p>
          <p className="mt-1 text-xs text-muted-foreground">Spent <MoneyDisplay amount={budget.spent} />{budget.budgetAmount ? <> of <MoneyDisplay amount={budget.budgetAmount} /></> : ' · No budget set'}</p>
        </div>
        <p className="text-sm font-medium">{budget.budgetAmount ? `${budget.percentage.toFixed(0)}%` : '--'}</p>
      </div>
      <Progress indicatorClassName={indicatorClassName} value={percentage} />
    </div>
  );
}

function BudgetHeroMetric({ icon: Icon, label, value, loading }: { icon: typeof Landmark; label: string; value: number; loading: boolean }) {
  return (
    <div className="border-b border-primary-foreground/10 p-6 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 sm:p-7">
      <div className="flex items-center gap-2 text-primary-foreground/60"><Icon className="h-4 w-4" /><p className="text-[11px] font-bold uppercase tracking-[0.15em]">{label}</p></div>
      {loading ? <Skeleton className="mt-4 h-10 w-36 bg-primary-foreground/10" /> : <MoneyDisplay amount={value} className="mt-3 block font-display text-3xl sm:text-4xl" />}
    </div>
  );
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function readError(error: unknown, fallback: string) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    (error as { response?: { data?: { message?: unknown } } }).response?.data?.message
  ) {
    const message = (error as { response?: { data?: { message?: unknown } } }).response?.data?.message;
    if (typeof message === 'string') {
      return message;
    }
    if (Array.isArray(message)) {
      return message.join(', ');
    }
    return JSON.stringify(message);
  }

  return fallback;
}

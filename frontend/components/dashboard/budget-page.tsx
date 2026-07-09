'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { BudgetListResponse, BudgetRow } from '@/lib/dashboard-types';

type BudgetDraftMap = Record<string, string>;

export function BudgetPage() {
  const { user, logout } = useAuth();
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

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.14),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.62),rgba(245,247,243,1))] p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <DashboardNav />
            <div>
              <h1 className="text-3xl font-semibold">Monthly budgets</h1>
              <p className="text-sm text-muted-foreground">
                Set income and per-category caps for {month}.
              </p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="font-medium">{user?.name}</p>
            <button className="text-muted-foreground underline underline-offset-4" onClick={() => logout()} type="button">
              Logout
            </button>
          </div>
        </div>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-white/60 bg-white/88 shadow-lg">
            <CardHeader>
              <CardTitle>Setup</CardTitle>
              <CardDescription>Enter salary and category caps for this month.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Monthly income</label>
                <Input onChange={(event) => setIncome(event.target.value)} value={income} />
              </div>

              <div className="space-y-3">
                {budgetData?.budgets.map((budget) => (
                  <div key={budget.categoryId} className="grid gap-2 sm:grid-cols-[1fr_180px] sm:items-center">
                    <label className="text-sm font-medium">{budget.categoryName}</label>
                    <Input
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [budget.categoryId]: event.target.value,
                        }))
                      }
                      placeholder="0"
                      value={drafts[budget.categoryId] ?? ''}
                    />
                  </div>
                ))}
              </div>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <Button disabled={status === 'saving' || status === 'loading'} onClick={() => void saveBudgets()} type="button">
                {status === 'saving' ? 'Saving...' : 'Save budgets'}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-white/60 bg-white/88 shadow-lg">
            <CardHeader>
              <CardTitle>Progress</CardTitle>
              <CardDescription>
                Budgeted Rs. {totals.budgeted.toFixed(0)} · Spent Rs. {totals.spent.toFixed(0)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {budgetData?.budgets.map((budget) => (
                <BudgetProgressRow key={budget.categoryId} budget={budget} />
              ))}
              {!budgetData && status === 'loading' ? (
                <p className="text-sm text-muted-foreground">Loading budgets...</p>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

function BudgetProgressRow({ budget }: { budget: BudgetRow }) {
  const percentage = budget.budgetAmount ? Math.min(100, budget.percentage) : 0;
  const indicatorClassName =
    budget.percentage >= 80
      ? budget.percentage >= 100
        ? 'bg-red-500'
        : 'bg-amber-500'
      : 'bg-emerald-500';

  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-secondary/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{budget.categoryName}</p>
          <p className="text-sm text-muted-foreground">
            Spent Rs. {budget.spent.toFixed(0)}
            {budget.budgetAmount ? ` of Rs. ${budget.budgetAmount.toFixed(0)}` : ' · No budget set'}
          </p>
        </div>
        <p className="text-sm font-medium">{budget.budgetAmount ? `${budget.percentage.toFixed(0)}%` : '--'}</p>
      </div>
      <Progress indicatorClassName={indicatorClassName} value={percentage} />
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

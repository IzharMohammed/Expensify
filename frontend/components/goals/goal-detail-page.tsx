'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Lightbulb, Plus, Sparkles, WalletCards } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MoneyDisplay } from '@/components/ui/money-display';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import { GoalContribution, GoalInsight, GoalRecord } from '@/lib/goals-types';

export function GoalDetailPage({ goalId }: { goalId: string }) {
  const { loading } = useAuth();
  const [goal, setGoal] = useState<GoalRecord | null>(null);
  const [contributions, setContributions] = useState<GoalContribution[]>([]);
  const [insight, setInsight] = useState<GoalInsight | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([loadGoal(), loadInsight()]);
  }, [goalId]);

  async function loadGoal() {
    setStatus('loading');
    try {
      const response = await api.get(`/goals/${goalId}`);
      setGoal(response.data.goal ?? null);
      setContributions(response.data.contributions ?? []);
      setError(null);
    } catch (loadError) {
      setError(readError(loadError, 'Failed to load goal'));
    } finally {
      setStatus('idle');
    }
  }

  async function loadInsight() {
    try {
      const response = await api.get(`/goals/${goalId}/insight`);
      setInsight(response.data.insight ?? null);
    } catch {
      setInsight(null);
    }
  }

  async function addContribution() {
    if (!amount.trim()) {
      return;
    }

    setStatus('saving');
    try {
      const response = await api.post(`/goals/${goalId}/contribute`, {
        amount,
        note: note || null,
      });
      setGoal(response.data.goal ?? null);
      setContributions(response.data.contributions ?? []);
      setAmount('');
      setNote('');
      await loadInsight();
      setError(null);
    } catch (saveError) {
      setError(readError(saveError, 'Failed to add contribution'));
    } finally {
      setStatus('idle');
    }
  }

  const chartData = useMemo(() => {
    const ordered = [...contributions].reverse();
    const max = Math.max(...ordered.map((item) => item.amount), 1);
    return ordered.map((item) => ({
      ...item,
      height: Math.max(12, (item.amount / max) * 100),
    }));
  }, [contributions]);

  if (loading) {
    return (
      <AppShell title="Goal details"><PageSkeleton /></AppShell>
    );
  }

  return (
    <AppShell actions={<Link className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground" href="/goals"><ArrowLeft className="h-4 w-4" />All goals</Link>} description="Every contribution brings the finish line closer." eyebrow="Goal progress" title={goal?.name ?? 'Goal details'}>
      <div className="space-y-6">
        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <Card className="overflow-hidden bg-primary text-primary-foreground">
              <CardHeader>
                <div className="flex items-center gap-2 text-primary-foreground/60"><WalletCards className="h-4 w-4" /><span className="text-xs font-bold uppercase tracking-[0.15em]">Saved so far</span></div>
                {goal ? <MoneyDisplay amount={goal.currentAmount} className="font-display text-5xl" /> : null}
                <CardDescription className="text-primary-foreground/60">of {goal ? <MoneyDisplay amount={goal.targetAmount} /> : 'your target'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress className="bg-primary-foreground/15" indicatorClassName="bg-primary-foreground" value={goal?.progress ?? 0} />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Stat label="Remaining" value={goal ? formatMoney(goal.remainingAmount) : '--'} inverted />
                  <Stat label="Progress" value={goal ? `${goal.progress.toFixed(0)}%` : '--'} inverted />
                  <Stat label="Target date" value={goal?.targetDate ? formatDate(goal.targetDate) : 'Not set'} inverted />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display text-2xl">Contribution history</CardTitle>
                <CardDescription>Recent manual contributions toward this goal.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex h-56 items-end gap-3 overflow-x-auto rounded-2xl bg-secondary/35 p-4">
                  {chartData.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No contributions yet.</p>
                  ) : (
                    chartData.map((item) => (
                      <div className="flex min-w-16 flex-1 flex-col items-center gap-2" key={item.id}>
                        <div
                          className="w-full rounded-t-[8px] bg-primary transition-all duration-700"
                          style={{ height: `${item.height}%` }}
                        />
                        <div className="text-center text-xs text-muted-foreground">
                          <p className="font-medium text-foreground">{formatMoney(item.amount)}</p>
                          <p>{formatShortDate(item.date)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-3">
                  {contributions.map((item) => (
                    <div className="flex items-start justify-between gap-3 rounded-xl border-b border-border/50 py-3 last:border-0" key={item.id}>
                      <div>
                        <MoneyDisplay amount={item.amount} className="font-semibold" />
                        <p className="text-sm text-muted-foreground">{formatDate(item.date)}</p>
                      </div>
                      <p className="max-w-sm text-right text-sm text-muted-foreground">{item.note || 'No note'}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="xl:sticky xl:top-8">
              <CardHeader>
                <div className="mb-2 grid h-11 w-11 place-items-center rounded-xl bg-accent text-primary"><Plus className="h-5 w-5" /></div>
                <CardTitle className="font-display text-2xl">Add contribution</CardTitle>
                <CardDescription>Quickly log money already moved toward this goal.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Amount</label>
                  <Input className="money-figures" onChange={(event) => setAmount(event.target.value)} placeholder="₹0" value={amount} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Note</label>
                  <Input onChange={(event) => setNote(event.target.value)} value={note} />
                </div>
                {error ? <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p> : null}
                <Button className="w-full" disabled={status === 'saving'} onClick={() => void addContribution()} size="lg" type="button">
                  {status === 'saving' ? 'Saving...' : 'Add contribution'}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-warning/15 bg-[linear-gradient(145deg,hsl(var(--card)),hsl(var(--warning)/0.08))]">
              <CardHeader>
                <div className="flex items-center gap-2 text-warning"><Sparkles className="h-4 w-4" /><span className="text-xs font-bold uppercase tracking-[0.15em]">AI suggestion</span></div>
                <CardTitle className="font-display text-2xl">A faster path</CardTitle>
                <CardDescription>One focused cut that could move this goal forward faster.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="rounded-2xl bg-warning/10 p-4 text-sm leading-6 text-foreground">
                  {insight?.phrase ?? 'Loading suggestion...'}
                </p>
                {insight?.category ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Stat label="Suggested cut" value={insight.category} />
                    <Stat label="Monthly reduction" value={formatMoney(insight.monthlyCut)} />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, inverted = false }: { label: string; value: string; inverted?: boolean }) {
  return (
    <div className={inverted ? 'rounded-2xl bg-primary-foreground/10 p-4' : 'rounded-2xl bg-secondary/35 p-4'}>
      <p className={inverted ? 'text-sm text-primary-foreground/60' : 'text-sm text-muted-foreground'}>{label}</p>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
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

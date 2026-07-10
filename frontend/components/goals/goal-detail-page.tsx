'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/auth-provider';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import { GoalContribution, GoalInsight, GoalRecord } from '@/lib/goals-types';

export function GoalDetailPage({ goalId }: { goalId: string }) {
  const { user, logout, loading } = useAuth();
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
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Restoring session...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.14),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.7),rgba(243,246,251,1))] p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <DashboardNav />
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Link className="underline underline-offset-4" href="/goals">
                Goals
              </Link>
              <span>/</span>
              <span>{goal?.name ?? 'Detail'}</span>
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="font-medium">{user?.name}</p>
            <button className="text-muted-foreground underline underline-offset-4" onClick={() => logout()} type="button">
              Logout
            </button>
          </div>
        </div>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <Card className="border-white/60 bg-white/90 shadow-lg">
              <CardHeader>
                <CardTitle>{goal?.name ?? 'Goal'}</CardTitle>
                <CardDescription>
                  {goal
                    ? `Saved Rs. ${goal.currentAmount.toFixed(0)} of Rs. ${goal.targetAmount.toFixed(0)}`
                    : 'Loading goal'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress value={goal?.progress ?? 0} />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Stat label="Remaining" value={goal ? `Rs. ${goal.remainingAmount.toFixed(0)}` : '--'} />
                  <Stat label="Progress" value={goal ? `${goal.progress.toFixed(0)}%` : '--'} />
                  <Stat label="Target date" value={goal?.targetDate ? formatDate(goal.targetDate) : 'Not set'} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/60 bg-white/90 shadow-lg">
              <CardHeader>
                <CardTitle>Contribution history</CardTitle>
                <CardDescription>Recent manual contributions toward this goal.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex h-52 items-end gap-3 overflow-x-auto rounded-2xl border border-border/70 bg-secondary/20 p-4">
                  {chartData.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No contributions yet.</p>
                  ) : (
                    chartData.map((item) => (
                      <div className="flex min-w-16 flex-1 flex-col items-center gap-2" key={item.id}>
                        <div
                          className="w-full rounded-t-2xl bg-gradient-to-t from-emerald-500 to-emerald-300"
                          style={{ height: `${item.height}%` }}
                        />
                        <div className="text-center text-xs text-muted-foreground">
                          <p className="font-medium text-foreground">Rs. {item.amount.toFixed(0)}</p>
                          <p>{formatShortDate(item.date)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-3">
                  {contributions.map((item) => (
                    <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-white p-3" key={item.id}>
                      <div>
                        <p className="font-medium">Rs. {item.amount.toFixed(0)}</p>
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
            <Card className="border-white/60 bg-white/90 shadow-lg">
              <CardHeader>
                <CardTitle>Add contribution</CardTitle>
                <CardDescription>Quickly log money already moved toward this goal.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Amount</label>
                  <Input onChange={(event) => setAmount(event.target.value)} value={amount} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Note</label>
                  <Input onChange={(event) => setNote(event.target.value)} value={note} />
                </div>
                {error ? <p className="text-sm text-red-600">{error}</p> : null}
                <Button disabled={status === 'saving'} onClick={() => void addContribution()} type="button">
                  {status === 'saving' ? 'Saving...' : 'Add contribution'}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-white/60 bg-white/90 shadow-lg">
              <CardHeader>
                <CardTitle>AI suggestion</CardTitle>
                <CardDescription>One focused cut that could move this goal forward faster.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                  {insight?.phrase ?? 'Loading suggestion...'}
                </p>
                {insight?.category ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Stat label="Suggested cut" value={insight.category} />
                    <Stat label="Monthly reduction" value={`Rs. ${insight.monthlyCut.toFixed(0)}`} />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-secondary/20 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
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

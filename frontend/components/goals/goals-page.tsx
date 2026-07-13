'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, PiggyBank, Plus, Target } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { MoneyDisplay } from '@/components/ui/money-display';
import { PageSkeleton, Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import { GoalRecord } from '@/lib/goals-types';

export function GoalsPage() {
  const { loading } = useAuth();
  const [goals, setGoals] = useState<GoalRecord[]>([]);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadGoals();
  }, []);

  async function loadGoals() {
    setStatus('loading');
    try {
      const response = await api.get('/goals');
      setGoals(response.data.goals ?? []);
      setError(null);
    } catch (loadError) {
      setError(readError(loadError, 'Failed to load goals'));
    } finally {
      setStatus('idle');
    }
  }

  async function createGoal() {
    if (!name.trim() || !targetAmount.trim()) {
      return;
    }

    setStatus('saving');
    try {
      await api.post('/goals', {
        name,
        targetAmount,
        currentAmount: currentAmount || '0',
        targetDate: targetDate ? new Date(`${targetDate}T00:00:00.000Z`).toISOString() : null,
      });
      setName('');
      setTargetAmount('');
      setCurrentAmount('');
      setTargetDate('');
      await loadGoals();
    } catch (saveError) {
      setError(readError(saveError, 'Failed to create goal'));
      setStatus('idle');
    }
  }

  if (loading) {
    return (
      <AppShell title="Savings goals"><PageSkeleton /></AppShell>
    );
  }

  return (
    <AppShell description="Turn long-term plans into visible, measurable progress." eyebrow="Save with purpose" title="Savings goals">
      <section className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
          <Card className="h-fit xl:sticky xl:top-8">
            <CardHeader>
              <div className="mb-2 grid h-11 w-11 place-items-center rounded-xl bg-accent text-primary"><Target className="h-5 w-5" /></div>
              <CardTitle className="font-display text-2xl">Create a goal</CardTitle>
              <CardDescription>Give the next thing you’re saving for a clear target.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Goal name</label>
                <Input onChange={(event) => setName(event.target.value)} value={name} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Target amount</label>
                  <Input className="money-figures" onChange={(event) => setTargetAmount(event.target.value)} placeholder="₹0" value={targetAmount} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Current amount</label>
                  <Input className="money-figures" onChange={(event) => setCurrentAmount(event.target.value)} placeholder="₹0" value={currentAmount} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Target date</label>
                <Input onChange={(event) => setTargetDate(event.target.value)} type="date" value={targetDate} />
              </div>
              {error ? <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p> : null}
              <Button className="w-full" disabled={status === 'saving'} onClick={() => void createGoal()} size="lg" type="button">
                <Plus className="h-4 w-4" />{status === 'saving' ? 'Creating...' : 'Create goal'}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {status === 'loading' && goals.length === 0 ? [0, 1, 2].map((item) => <Skeleton className="h-44 rounded-2xl" key={item} />) : null}
            {goals.length === 0 && status !== 'loading' ? (
              <Card><EmptyState description="Create a target and every contribution will turn into visible momentum." icon={PiggyBank} title="Your first goal starts here" /></Card>
            ) : null}
            {goals.map((goal) => (
              <Link href={`/goals/${goal.id}`} key={goal.id}>
                <Card className="group hover:-translate-y-0.5 hover:border-primary/15 hover:shadow-lift">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-display text-2xl">{goal.name}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Saved <MoneyDisplay amount={goal.currentAmount} /> of <MoneyDisplay amount={goal.targetAmount} /></p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-medium">{goal.progress.toFixed(0)}%</p>
                        <p className="text-muted-foreground"><MoneyDisplay amount={goal.remainingAmount} /> left</p>
                      </div>
                    </div>
                    <Progress value={goal.progress} />
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{goal.targetDate ? `Target ${formatDate(goal.targetDate)}` : 'No target date set'}</span>
                      <span className="flex items-center gap-1 font-semibold text-foreground">Open details <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
      </section>
    </AppShell>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
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

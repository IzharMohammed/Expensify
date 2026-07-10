'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import { GoalRecord } from '@/lib/goals-types';

export function GoalsPage() {
  const { user, logout, loading } = useAuth();
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
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Restoring session...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.14),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.65),rgba(244,247,242,1))] p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <DashboardNav />
            <div>
              <h1 className="text-3xl font-semibold">Savings goals</h1>
              <p className="text-sm text-muted-foreground">
                Track progress, log contributions, and get one concrete AI suggestion to reach each target faster.
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
          <Card className="border-white/60 bg-white/90 shadow-lg">
            <CardHeader>
              <CardTitle>Create goal</CardTitle>
              <CardDescription>Add a target you want to fund over time.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Goal name</label>
                <Input onChange={(event) => setName(event.target.value)} value={name} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Target amount</label>
                  <Input onChange={(event) => setTargetAmount(event.target.value)} value={targetAmount} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Current amount</label>
                  <Input onChange={(event) => setCurrentAmount(event.target.value)} value={currentAmount} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Target date</label>
                <Input onChange={(event) => setTargetDate(event.target.value)} type="date" value={targetDate} />
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <Button disabled={status === 'saving'} onClick={() => void createGoal()} type="button">
                {status === 'saving' ? 'Saving...' : 'Create goal'}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {goals.length === 0 && status !== 'loading' ? (
              <Card className="border-white/60 bg-white/90 shadow-lg">
                <CardContent className="p-6 text-sm text-muted-foreground">
                  No goals yet. Create your first savings target to start tracking progress.
                </CardContent>
              </Card>
            ) : null}
            {goals.map((goal) => (
              <Link href={`/goals/${goal.id}`} key={goal.id}>
                <Card className="border-white/60 bg-white/90 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-semibold">{goal.name}</h2>
                        <p className="text-sm text-muted-foreground">
                          Saved Rs. {goal.currentAmount.toFixed(0)} of Rs. {goal.targetAmount.toFixed(0)}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-medium">{goal.progress.toFixed(0)}%</p>
                        <p className="text-muted-foreground">Remaining Rs. {goal.remainingAmount.toFixed(0)}</p>
                      </div>
                    </div>
                    <Progress value={goal.progress} />
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{goal.targetDate ? `Target ${formatDate(goal.targetDate)}` : 'No target date set'}</span>
                      <span>Open details</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
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

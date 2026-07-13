'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, Check, Clock3, RotateCcw, X } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { EmptyState } from '@/components/ui/empty-state';
import { MoneyDisplay } from '@/components/ui/money-display';
import { PageSkeleton, Skeleton } from '@/components/ui/skeleton';
import { RecurringExpenseRecord, RecurringListResponse, RecurringReminder } from '@/lib/recurring-types';

export function RecurringPage() {
  const { loading } = useAuth();
  const [confirmed, setConfirmed] = useState<RecurringExpenseRecord[]>([]);
  const [pending, setPending] = useState<RecurringExpenseRecord[]>([]);
  const [reminders, setReminders] = useState<RecurringReminder[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [status, setStatus] = useState<'loading' | 'idle' | 'saving'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadRecurring();
  }, []);

  async function loadRecurring() {
    setStatus('loading');
    try {
      const response = await api.get('/recurring');
      const data = response.data as RecurringListResponse;
      setConfirmed(data.recurringExpenses);
      setPending(data.pendingDetections);
      setReminders(data.reminders);
      setMonthlyTotal(data.monthlyTotal);
      setError(null);
    } catch (loadError) {
      setError(readError(loadError, 'Failed to load recurring expenses'));
    } finally {
      setStatus('idle');
    }
  }

  async function confirmDetection(id: string) {
    setStatus('saving');
    try {
      await api.post(`/recurring/${id}/confirm`);
      await loadRecurring();
    } catch (requestError) {
      setError(readError(requestError, 'Failed to confirm recurring expense'));
      setStatus('idle');
    }
  }

  async function rejectDetection(id: string) {
    setStatus('saving');
    try {
      await api.post(`/recurring/${id}/reject`);
      await loadRecurring();
    } catch (requestError) {
      setError(readError(requestError, 'Failed to reject recurring expense'));
      setStatus('idle');
    }
  }

  if (loading) {
    return (
      <AppShell title="Recurring expenses"><PageSkeleton /></AppShell>
    );
  }

  return (
    <AppShell description="Keep predictable payments visible before they arrive." eyebrow="Subscriptions" title="Recurring expenses">
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-3xl bg-primary p-7 text-primary-foreground sm:p-9">
          <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full border border-primary-foreground/10" />
          <div className="flex items-center gap-2 text-primary-foreground/60"><RotateCcw className="h-4 w-4" /><span className="text-[11px] font-bold uppercase tracking-[0.16em]">Monthly equivalent</span></div>
          <MoneyDisplay amount={monthlyTotal} className="mt-3 block font-display text-5xl sm:text-6xl" />
          <p className="mt-3 text-sm text-primary-foreground/60">Across all confirmed recurring expenses.</p>
        </div>
        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-2xl">Confirmed payments</CardTitle>
              <CardDescription>Subscriptions and recurring bills you have approved.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {status === 'loading' && confirmed.length === 0 ? [0, 1, 2].map((item) => <Skeleton className="h-24 rounded-2xl" key={item} />) : null}
              {confirmed.length === 0 && status !== 'loading' ? (
                <EmptyState description="Approved recurring payments will collect here with their next due date." icon={CalendarClock} title="Nothing recurring yet" />
              ) : null}
              {confirmed.map((item) => (
                <RecurringRow item={item} key={item.id} />
              ))}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-2xl">Needs your review</CardTitle>
                <CardDescription>Approve or reject what the pattern detector found.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {status === 'loading' && pending.length === 0 ? [0, 1].map((item) => <Skeleton className="h-32 rounded-2xl" key={item} />) : null}
                {pending.length === 0 && status !== 'loading' ? (
                  <EmptyState className="py-8" description="When a repeating pattern is detected, it will wait here for your approval." icon={Check} title="You’re all caught up" />
                ) : null}
                {pending.map((item) => (
                  <div className="space-y-4 rounded-2xl border border-warning/20 bg-warning/10 p-4" key={item.id}>
                    <RecurringRow item={item} />
                    <div className="flex gap-3">
                      <Button disabled={status === 'saving'} onClick={() => void confirmDetection(item.id)} type="button">
                        <Check className="h-4 w-4" />Confirm
                      </Button>
                      <Button disabled={status === 'saving'} onClick={() => void rejectDetection(item.id)} type="button" variant="outline">
                        <X className="h-4 w-4" />Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display text-2xl">Due tomorrow</CardTitle>
                <CardDescription>Daily generated notifications for upcoming renewals.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {reminders.length === 0 ? (
                  <EmptyState className="py-8" description="There are no confirmed renewals due tomorrow." icon={Clock3} title="A clear day ahead" />
                ) : (
                  reminders.map((item) => (
                    <div className="rounded-xl bg-secondary/45 p-4" key={item.id}>
                      <p className="font-medium">{item.message}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-danger/15 bg-danger/10 p-4 text-sm text-danger">{error}</div>
        ) : null}
      </div>
    </AppShell>
  );
}

function RecurringRow({ item }: { item: RecurringExpenseRecord }) {
  return (
    <div className="rounded-2xl bg-secondary/35 p-4 transition-colors hover:bg-secondary/55">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">{item.merchant}</p>
          <p className="text-sm text-muted-foreground">
            {item.frequency} · Next due {formatDate(item.nextDueDate)}
          </p>
        </div>
        <div className="text-right">
          <MoneyDisplay amount={item.amount} className="font-semibold" />
          <p className="text-sm text-muted-foreground">Monthly eq. <MoneyDisplay amount={item.monthlyEquivalent} /></p>
        </div>
      </div>
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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
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

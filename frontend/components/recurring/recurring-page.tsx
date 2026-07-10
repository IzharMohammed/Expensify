'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { RecurringExpenseRecord, RecurringListResponse, RecurringReminder } from '@/lib/recurring-types';

export function RecurringPage() {
  const { user, logout, loading } = useAuth();
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
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Restoring session...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.14),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.68),rgba(246,244,252,1))] p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <DashboardNav />
            <div>
              <h1 className="text-3xl font-semibold">Recurring expenses</h1>
              <p className="text-sm text-muted-foreground">
                Review auto-detected subscriptions, track confirmed recurring payments, and see what renews tomorrow.
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

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="border-white/60 bg-white/90 shadow-lg">
            <CardHeader>
              <CardTitle>Confirmed subscriptions</CardTitle>
              <CardDescription>
                Monthly equivalent total Rs. {monthlyTotal.toFixed(0)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {confirmed.length === 0 && status !== 'loading' ? (
                <p className="rounded-xl bg-secondary/40 p-4 text-sm text-muted-foreground">
                  No confirmed recurring expenses yet.
                </p>
              ) : null}
              {confirmed.map((item) => (
                <RecurringRow item={item} key={item.id} />
              ))}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-white/60 bg-white/90 shadow-lg">
              <CardHeader>
                <CardTitle>Pending detections</CardTitle>
                <CardDescription>Approve or reject what the pattern detector found.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {pending.length === 0 && status !== 'loading' ? (
                  <p className="rounded-xl bg-secondary/40 p-4 text-sm text-muted-foreground">
                    No pending detections right now.
                  </p>
                ) : null}
                {pending.map((item) => (
                  <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-4" key={item.id}>
                    <RecurringRow item={item} />
                    <div className="flex gap-3">
                      <Button disabled={status === 'saving'} onClick={() => void confirmDetection(item.id)} type="button">
                        Confirm
                      </Button>
                      <Button disabled={status === 'saving'} onClick={() => void rejectDetection(item.id)} type="button" variant="outline">
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-white/60 bg-white/90 shadow-lg">
              <CardHeader>
                <CardTitle>Tomorrow reminders</CardTitle>
                <CardDescription>Daily generated notifications for upcoming renewals.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {reminders.length === 0 ? (
                  <p className="rounded-xl bg-secondary/40 p-4 text-sm text-muted-foreground">
                    No due reminders yet.
                  </p>
                ) : (
                  reminders.map((item) => (
                    <div className="rounded-xl border border-border/70 bg-white p-4" key={item.id}>
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
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">{error}</CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}

function RecurringRow({ item }: { item: RecurringExpenseRecord }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-secondary/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">{item.merchant}</p>
          <p className="text-sm text-muted-foreground">
            {item.frequency} · Next due {formatDate(item.nextDueDate)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold">Rs. {item.amount.toFixed(0)}</p>
          <p className="text-sm text-muted-foreground">
            Monthly eq. Rs. {item.monthlyEquivalent.toFixed(0)}
          </p>
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

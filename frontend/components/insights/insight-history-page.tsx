'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { InsightHistoryResponse, InsightRecord } from '@/lib/dashboard-types';
import { InsightCard } from './insight-card';

export function InsightHistoryPage() {
  const { user, logout } = useAuth();
  const [items, setItems] = useState<InsightRecord[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadPage(1);
  }, []);

  async function loadPage(nextPage: number) {
    setLoading(true);
    try {
      const response = await api.get('/insights/history', {
        params: { page: nextPage, limit },
      });
      const data = response.data as InsightHistoryResponse;
      setItems((current) => (nextPage === 1 ? data.items : [...current, ...data.items]));
      setPage(data.page);
      setTotal(data.total);
      setError(null);
    } catch {
      setError('Failed to load insight history');
    } finally {
      setLoading(false);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, InsightRecord[]>();
    for (const item of items) {
      const key = item.date.slice(0, 10);
      const existing = map.get(key);
      if (existing) {
        existing.push(item);
      } else {
        map.set(key, [item]);
      }
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.64),rgba(246,247,250,1))] p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <DashboardNav />
            <div>
              <h1 className="text-3xl font-semibold">Insight history</h1>
              <p className="text-sm text-muted-foreground">
                Track how your spending behavior changes across days, weeks, and months.
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

        <Card className="border-white/60 bg-white/90 shadow-lg">
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
            <CardDescription>Newest insights first.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {grouped.length === 0 && !loading ? (
              <p className="rounded-xl bg-secondary/50 p-4 text-sm text-muted-foreground">
                No historical insights yet.
              </p>
            ) : null}
            {grouped.map(([date, records]) => (
              <section className="space-y-3" key={date}>
                <h2 className="text-lg font-semibold">{formatDateHeading(date)}</h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {records.map((record) => (
                    <InsightCard insight={record} key={record.id} />
                  ))}
                </div>
              </section>
            ))}
            {items.length < total ? (
              <Button disabled={loading} onClick={() => void loadPage(page + 1)} type="button" variant="outline">
                {loading ? 'Loading...' : 'Load more'}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function formatDateHeading(date: string) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
  });
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { InsightHistoryResponse, InsightRecord } from '@/lib/dashboard-types';
import { InsightCard } from './insight-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Lightbulb } from 'lucide-react';

export function InsightHistoryPage() {
  useAuth();
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
    <AppShell description="A chronological record of how your financial habits evolve." eyebrow="Behavior timeline" title="Insight history">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">Your timeline</CardTitle>
            <CardDescription>Newest insights first.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {error ? <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p> : null}
            {grouped.length === 0 && !loading ? (
              <EmptyState description="Your nightly insights will form a timeline here as your spending history grows." icon={Lightbulb} title="No history yet" />
            ) : null}
            {grouped.map(([date, records]) => (
              <section className="space-y-3" key={date}>
                <div className="flex items-center gap-3"><span className="h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-accent" /><h2 className="font-display text-xl">{formatDateHeading(date)}</h2></div>
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
    </AppShell>
  );
}

function formatDateHeading(date: string) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
  });
}

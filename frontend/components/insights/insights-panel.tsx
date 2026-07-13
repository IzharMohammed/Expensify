'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { InsightRecord } from '@/lib/dashboard-types';
import { InsightCard } from './insight-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

export function InsightsPanel() {
  const [insights, setInsights] = useState<InsightRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadInsights();

    const timeout = window.setTimeout(() => {
      void loadInsights();
    }, msUntilNextDay());

    return () => window.clearTimeout(timeout);
  }, []);

  async function loadInsights() {
    try {
      const response = await api.get('/insights/latest');
      setInsights(response.data.insights ?? []);
      setError(null);
    } catch {
      setError('Failed to load insights');
    } finally {
      setLoading(false);
    }
  }

  const empty = useMemo(() => insights.length === 0, [insights.length]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4" /><span className="text-[11px] font-bold uppercase tracking-[0.18em]">Nightly intelligence</span></div>
          <CardTitle className="font-display text-2xl">Worth noticing</CardTitle>
          <CardDescription>Nightly patterns, suggestions, and month-end projections.</CardDescription>
        </div>
        <Link className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground" href="/insights">
          History <ArrowRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent>
        {error ? <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p> : null}
        {loading ? <div className="flex gap-4 overflow-hidden">{[0, 1, 2].map((item) => <Skeleton className="h-48 min-w-[290px] rounded-2xl" key={item} />)}</div> : empty ? (
          <EmptyState className="py-8" description="The nightly analysis will begin building your timeline after expenses accumulate." icon={Sparkles} title="Insights are taking shape" />
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {insights.map((insight) => (
              <InsightCard insight={insight} key={insight.id} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function msUntilNextDay() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}

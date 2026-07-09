'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { InsightRecord } from '@/lib/dashboard-types';
import { InsightCard } from './insight-card';

export function InsightsPanel() {
  const [insights, setInsights] = useState<InsightRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

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
    }
  }

  const empty = useMemo(() => insights.length === 0, [insights.length]);

  return (
    <Card className="border-white/60 bg-white/88 shadow-lg">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>AI insights</CardTitle>
          <CardDescription>Nightly patterns, suggestions, and month-end projections.</CardDescription>
        </div>
        <Link className="text-sm text-muted-foreground underline underline-offset-4" href="/insights">
          Insight history
        </Link>
      </CardHeader>
      <CardContent>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {empty ? (
          <p className="rounded-xl bg-secondary/50 p-4 text-sm text-muted-foreground">
            No insights generated yet. The nightly batch will start building a timeline after expenses accumulate.
          </p>
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

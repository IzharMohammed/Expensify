'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '@/components/auth/auth-provider';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import {
  CategoryDistributionItem,
  HeatmapDay,
  NetworthTrendPoint,
  SavingsTrendPoint,
  SpendingPoint,
} from '@/lib/analytics-types';

const COLORS = ['#ea580c', '#0f766e', '#2563eb', '#ca8a04', '#7c3aed', '#db2777', '#16a34a'];

export function AnalyticsPage() {
  const { user, logout, loading } = useAuth();
  const [range, setRange] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [year, setYear] = useState(new Date().getUTCFullYear().toString());
  const [spending, setSpending] = useState<SpendingPoint[]>([]);
  const [distribution, setDistribution] = useState<CategoryDistributionItem[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapDay[]>([]);
  const [savingsTrend, setSavingsTrend] = useState<SavingsTrendPoint[]>([]);
  const [networthTrend, setNetworthTrend] = useState<NetworthTrendPoint[]>([]);
  const [status, setStatus] = useState<'loading' | 'idle'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadAll();
  }, [range, month, year]);

  async function loadAll() {
    setStatus('loading');
    try {
      const [spendingResponse, distributionResponse, heatmapResponse, savingsResponse, networthResponse] =
        await Promise.all([
          api.get('/analytics/spending', { params: { range } }),
          api.get('/analytics/category-distribution', { params: { month } }),
          api.get('/analytics/heatmap', { params: { year } }),
          api.get('/analytics/savings-trend'),
          api.get('/analytics/networth-trend'),
        ]);

      setSpending(spendingResponse.data.points ?? []);
      setDistribution(distributionResponse.data.items ?? []);
      setHeatmap(heatmapResponse.data.days ?? []);
      setSavingsTrend(savingsResponse.data.points ?? []);
      setNetworthTrend(networthResponse.data.points ?? []);
      setError(null);
    } catch (loadError) {
      setError(readError(loadError, 'Failed to load analytics'));
    } finally {
      setStatus('idle');
    }
  }

  const monthlyBars = useMemo(
    () =>
      savingsTrend.map((item) => ({
        month: item.month.slice(5),
        spend: item.spend,
      })),
    [savingsTrend],
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Restoring session...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.15),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.72),rgba(242,247,251,1))] p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <DashboardNav />
            <div>
              <h1 className="text-3xl font-semibold">Analytics</h1>
              <p className="text-sm text-muted-foreground">
                Explore spending patterns, category mix, savings momentum, and yearly intensity in one place.
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

        {error ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">{error}</CardContent>
          </Card>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-2">
          <Card className="border-white/60 bg-white/90 shadow-lg">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Spending over time</CardTitle>
                  <CardDescription>Toggle the bucket size to zoom in or out.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((item) => (
                    <Button
                      key={item}
                      onClick={() => setRange(item)}
                      type="button"
                      variant={range === item ? 'default' : 'outline'}
                    >
                      {item}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={spending}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" minTickGap={20} />
                  <YAxis />
                  <Tooltip />
                  <Line dataKey="total" stroke="#ea580c" strokeWidth={3} type="monotone" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-white/60 bg-white/90 shadow-lg">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Category distribution</CardTitle>
                  <CardDescription>Share of spending for the selected month.</CardDescription>
                </div>
                <input
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  onChange={(event) => setMonth(event.target.value)}
                  type="month"
                  value={month}
                />
              </div>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distribution} dataKey="total" nameKey="category" outerRadius={100}>
                    {distribution.map((entry, index) => (
                      <Cell fill={COLORS[index % COLORS.length]} key={entry.category} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-white/60 bg-white/90 shadow-lg">
            <CardHeader>
              <CardTitle>Monthly spending comparison</CardTitle>
              <CardDescription>Quick year view built from the monthly savings dataset.</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyBars}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="spend" fill="#0f766e" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-white/60 bg-white/90 shadow-lg">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Calendar heatmap</CardTitle>
                  <CardDescription>Daily spending intensity across the year.</CardDescription>
                </div>
                <input
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  onChange={(event) => setYear(event.target.value)}
                  type="number"
                  value={year}
                />
              </div>
            </CardHeader>
            <CardContent>
              <HeatmapGrid days={heatmap} />
            </CardContent>
          </Card>

          <Card className="border-white/60 bg-white/90 shadow-lg">
            <CardHeader>
              <CardTitle>Savings trend</CardTitle>
              <CardDescription>Monthly income, spending, and savings for the year.</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={savingsTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line dataKey="income" stroke="#2563eb" strokeWidth={2} type="monotone" />
                  <Line dataKey="spend" stroke="#ea580c" strokeWidth={2} type="monotone" />
                  <Line dataKey="savings" stroke="#16a34a" strokeWidth={3} type="monotone" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-white/60 bg-white/90 shadow-lg">
            <CardHeader>
              <CardTitle>Net worth trend</CardTitle>
              <CardDescription>Cumulative net cashflow trend over the year.</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={networthTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line dataKey="networth" stroke="#7c3aed" strokeWidth={3} type="monotone" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>

        {status === 'loading' ? (
          <Card className="border-white/60 bg-white/90 shadow-lg">
            <CardContent className="p-4 text-sm text-muted-foreground">Loading analytics...</CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}

function HeatmapGrid({ days }: { days: HeatmapDay[] }) {
  const max = Math.max(...days.map((day) => day.total), 0);

  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(18, minmax(0, 1fr))' }}>
      {days.map((day) => {
        const intensity = max > 0 ? day.total / max : 0;
        const background =
          intensity === 0
            ? 'bg-slate-100'
            : intensity < 0.25
              ? 'bg-emerald-200'
              : intensity < 0.5
                ? 'bg-emerald-300'
                : intensity < 0.75
                  ? 'bg-emerald-400'
                  : 'bg-emerald-500';

        return (
          <div
            className={`h-4 w-4 rounded-sm ${background}`}
            key={day.date}
            title={`${day.date}: Rs. ${day.total.toFixed(0)}`}
          />
        );
      })}
    </div>
  );
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

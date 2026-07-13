'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
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
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { MoneyDisplay } from '@/components/ui/money-display';
import { PageSkeleton } from '@/components/ui/skeleton';
import { BarChart3 } from 'lucide-react';
import { api } from '@/lib/api';
import {
  CategoryDistributionItem,
  HeatmapDay,
  NetworthTrendPoint,
  SavingsTrendPoint,
  SpendingPoint,
} from '@/lib/analytics-types';

const COLORS = ['#32705b', '#c2883b', '#b45f4d', '#477f88', '#7c7652', '#d08b72', '#668b68'];

export function AnalyticsPage() {
  const { loading } = useAuth();
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
      <AppShell title="Reports"><PageSkeleton /></AppShell>
    );
  }

  return (
    <AppShell description="See the shape of your spending, not just the total." eyebrow="Trends" title="Reports">
      <div className="space-y-6">
        {error ? (
          <div className="rounded-2xl border border-danger/15 bg-danger/10 p-4 text-sm text-danger">{error}</div>
        ) : null}

        {status === 'loading' && spending.length === 0 ? <PageSkeleton /> : (
        <section className="grid gap-6 xl:grid-cols-12">
          <Card className="xl:col-span-8">
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="font-display text-2xl">Spending rhythm</CardTitle>
                  <CardDescription>Your expenses grouped by the selected interval.</CardDescription>
                </div>
                <div className="flex rounded-xl bg-secondary p-1">
                  {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((item) => (
                    <button className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize transition ${range === item ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`} key={item} onClick={() => setRange(item)} type="button">
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="h-[320px] pl-0 sm:h-[380px] sm:pl-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={spending} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.45} vertical={false} />
                  <XAxis axisLine={false} dataKey="label" minTickGap={24} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} />
                  <YAxis axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={compactNumber} tickLine={false} width={52} />
                  <Tooltip content={<FinanceTooltip />} cursor={{ stroke: 'hsl(var(--border))' }} />
                  <Line activeDot={{ r: 5, fill: '#32705b', stroke: 'hsl(var(--card))', strokeWidth: 3 }} dataKey="total" dot={false} stroke="#32705b" strokeWidth={2.5} type="monotone" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="xl:col-span-4">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="font-display text-2xl">Where it went</CardTitle>
                  <CardDescription>Category mix for this month.</CardDescription>
                </div>
                <input
                  className="h-10 rounded-[10px] border border-input bg-card px-2 text-xs"
                  onChange={(event) => setMonth(event.target.value)}
                  type="month"
                  value={month}
                />
              </div>
            </CardHeader>
            <CardContent>
              {distribution.length ? <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                  <Pie cornerRadius={5} data={distribution} dataKey="total" innerRadius={62} nameKey="category" outerRadius={88} paddingAngle={2} stroke="none">
                    {distribution.map((entry, index) => (
                      <Cell fill={COLORS[index % COLORS.length]} key={entry.category} />
                    ))}
                  </Pie>
                  <Tooltip content={<FinanceTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2.5 border-t border-border/50 pt-4">
                {distribution.slice(0, 6).map((entry, index) => (
                  <div className="flex items-center justify-between gap-3 text-sm" key={entry.category}>
                    <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[index % COLORS.length] }} /><span className="text-muted-foreground">{entry.category}</span></div>
                    <MoneyDisplay amount={entry.total} className="font-semibold" />
                  </div>
                ))}
              </div></> : <EmptyState description="Category totals will appear after expenses are recorded for this month." icon={BarChart3} title="No category data yet" />}
            </CardContent>
          </Card>

          <Card className="xl:col-span-6">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Year at a glance</CardTitle>
              <CardDescription>Quick year view built from the monthly savings dataset.</CardDescription>
            </CardHeader>
            <CardContent className="h-72 pl-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyBars}>
                  <XAxis axisLine={false} dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} />
                  <YAxis axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={compactNumber} tickLine={false} width={50} />
                  <Tooltip content={<FinanceTooltip />} cursor={{ fill: 'hsl(var(--secondary))', opacity: 0.5 }} />
                  <Bar dataKey="spend" fill="#32705b" maxBarSize={32} radius={[7, 7, 7, 7]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="xl:col-span-6">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="font-display text-2xl">Spending calendar</CardTitle>
                  <CardDescription>Daily spending intensity across the year.</CardDescription>
                </div>
                <input
                  className="h-10 w-24 rounded-[10px] border border-input bg-card px-3 text-sm"
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

          <Card className="xl:col-span-6">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Savings momentum</CardTitle>
              <CardDescription>Monthly income, spending, and savings for the year.</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={savingsTrend} margin={{ left: 0, right: 12, top: 12 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
                  <XAxis axisLine={false} dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} />
                  <YAxis axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={compactNumber} tickLine={false} width={52} />
                  <Tooltip content={<FinanceTooltip />} />
                  <Line dataKey="income" dot={false} stroke="#477f88" strokeWidth={1.8} type="monotone" />
                  <Line dataKey="spend" dot={false} stroke="#b45f4d" strokeWidth={1.8} type="monotone" />
                  <Line dataKey="savings" dot={false} stroke="#32705b" strokeWidth={2.8} type="monotone" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="xl:col-span-6">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Net cashflow</CardTitle>
              <CardDescription>Cumulative net cashflow trend over the year.</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={networthTrend} margin={{ left: 0, right: 12, top: 12 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
                  <XAxis axisLine={false} dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} />
                  <YAxis axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={compactNumber} tickLine={false} width={52} />
                  <Tooltip content={<FinanceTooltip />} />
                  <Line activeDot={{ r: 4 }} dataKey="networth" dot={false} stroke="#c2883b" strokeWidth={2.8} type="monotone" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>)}
      </div>
    </AppShell>
  );
}

function HeatmapGrid({ days }: { days: HeatmapDay[] }) {
  const max = Math.max(...days.map((day) => day.total), 0);

  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid w-max grid-flow-col grid-rows-7 gap-1.5">
      {days.map((day) => {
        const intensity = max > 0 ? day.total / max : 0;
        const background =
          intensity === 0
            ? 'hsl(var(--secondary))'
            : intensity < 0.25
              ? '#bcd7c8'
              : intensity < 0.5
                ? '#7fb49d'
                : intensity < 0.75
                  ? '#4b8d72'
                  : '#245d49';

        return (
          <div
            className="h-3.5 w-3.5 rounded-[4px] transition-transform hover:scale-125 sm:h-4 sm:w-4"
            key={day.date}
            style={{ background }}
            title={`${day.date}: ${formatCurrency(day.total)}`}
          />
        );
      })}
      </div>
      <div className="mt-4 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground"><span>Less</span>{['hsl(var(--secondary))', '#bcd7c8', '#7fb49d', '#4b8d72', '#245d49'].map((color) => <span className="h-3 w-3 rounded-[3px]" key={color} style={{ background: color }} />)}<span>More</span></div>
    </div>
  );
}

function FinanceTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: ReadonlyArray<{ name?: string; value?: number | string; color?: string }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-36 rounded-xl border border-border/60 bg-card/95 p-3 shadow-lift backdrop-blur">
      {label !== undefined ? <p className="mb-2 text-xs font-semibold text-muted-foreground">{label}</p> : null}
      {payload.map((item, index) => (
        <div className="flex items-center justify-between gap-4 text-xs" key={`${item.name}-${index}`}>
          <span className="capitalize text-muted-foreground">{item.name ?? 'Amount'}</span>
          <span className="money-figures font-bold">{formatCurrency(Number(item.value) || 0)}</span>
        </div>
      ))}
    </div>
  );
}

function compactNumber(value: number) {
  return new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
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

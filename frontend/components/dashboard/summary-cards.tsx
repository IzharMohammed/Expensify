'use client';

import { DashboardSummary } from '@/lib/dashboard-types';
import { ArrowDownRight, CalendarDays, Clock3, WalletCards } from 'lucide-react';
import { MoneyDisplay } from '@/components/ui/money-display';
import { Skeleton } from '@/components/ui/skeleton';

const summaryLabels: Array<{ key: keyof DashboardSummary; label: string; icon: typeof Clock3 }> = [
  { key: 'today', label: 'Today', icon: Clock3 },
  { key: 'yesterday', label: 'Yesterday', icon: ArrowDownRight },
  { key: 'thisWeek', label: 'This week', icon: CalendarDays },
  { key: 'remaining', label: 'Remaining', icon: WalletCards },
];

export function SummaryCards({ summary }: { summary: DashboardSummary | null }) {
  return (
    <section className="overflow-hidden rounded-3xl bg-primary text-primary-foreground shadow-soft">
      <div className="grid lg:grid-cols-[1.05fr_1.45fr]">
        <div className="relative overflow-hidden border-primary-foreground/10 p-6 sm:p-8 lg:border-r lg:p-10">
          <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full border border-primary-foreground/10" />
          <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full border border-primary-foreground/10" />
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-foreground/65">Spent this month</p>
          {summary ? (
            <MoneyDisplay amount={summary.thisMonth} className="mt-4 block font-display text-5xl tracking-[-0.035em] sm:text-6xl" />
          ) : (
            <Skeleton className="mt-4 h-16 w-64 bg-primary-foreground/10" />
          )}
          <p className="mt-5 max-w-xs text-sm leading-6 text-primary-foreground/65">Your live total updates the moment a confirmed expense lands.</p>
        </div>
        <div className="grid grid-cols-2 border-t border-primary-foreground/10 lg:border-t-0">
          {summaryLabels.map((item, index) => {
            const Icon = item.icon;
            return (
              <div className={`p-5 sm:p-6 ${index % 2 === 0 ? 'border-r' : ''} ${index < 2 ? 'border-b' : ''} border-primary-foreground/10`} key={item.key}>
                <div className="flex items-center gap-2 text-primary-foreground/60">
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                  <p className="text-xs font-semibold uppercase tracking-[0.12em]">{item.label}</p>
                </div>
                {summary ? <MoneyDisplay amount={summary[item.key]} className="mt-3 block text-xl font-bold sm:text-2xl" /> : <Skeleton className="mt-3 h-8 w-28 bg-primary-foreground/10" />}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

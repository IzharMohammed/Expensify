'use client';

import { DashboardSummary } from '@/lib/dashboard-types';
import { Card, CardContent } from '@/components/ui/card';

const summaryLabels: Array<{ key: keyof DashboardSummary; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'thisWeek', label: 'This Week' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'remaining', label: 'Remaining' },
];

export function SummaryCards({ summary }: { summary: DashboardSummary | null }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {summaryLabels.map((item) => (
        <Card key={item.key} className="border-white/60 bg-white/88 shadow-sm">
          <CardContent className="space-y-1 p-4">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className="text-2xl font-semibold">Rs. {formatAmount(summary?.[item.key] ?? 0)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function formatAmount(value: number) {
  return value.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

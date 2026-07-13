'use client';

import { Brain, CalendarRange, Lightbulb, LineChart } from 'lucide-react';
import { InsightRecord } from '@/lib/dashboard-types';
import { Card, CardContent } from '@/components/ui/card';

const typeMeta = {
  spending_pattern: { label: 'Pattern', icon: CalendarRange },
  comparison: { label: 'Comparison', icon: LineChart },
  suggestion: { label: 'Suggestion', icon: Lightbulb },
  prediction: { label: 'Prediction', icon: Brain },
} satisfies Record<InsightRecord['type'], { label: string; icon: typeof Brain }>;

const priorityTone = {
  low: 'bg-success/10 text-success',
  medium: 'bg-warning/10 text-warning',
  high: 'bg-danger/10 text-danger',
} satisfies Record<InsightRecord['priority'], string>;

export function InsightCard({ insight }: { insight: InsightRecord }) {
  const meta = typeMeta[insight.type];
  const Icon = meta.icon;

  return (
    <Card className="min-w-[290px] max-w-sm shadow-none hover:-translate-y-0.5 hover:border-primary/15 hover:shadow-soft">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-accent p-2.5 text-primary">
              <Icon className="h-4 w-4" strokeWidth={1.8} />
            </span>
            <div>
              <p className="text-sm font-medium">{meta.label}</p>
              <p className="text-xs text-muted-foreground">{formatDate(insight.date)}</p>
            </div>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${priorityTone[insight.priority]}`}>
            {insight.priority}
          </span>
        </div>
        <p className="text-[15px] font-medium leading-6 text-foreground">{insight.insightText}</p>
        <div className="flex flex-wrap gap-2 text-xs">
          {insight.category ? (
            <span className="rounded-full bg-secondary px-2.5 py-1 text-muted-foreground">{insight.category}</span>
          ) : null}
          <span className="rounded-full bg-secondary px-2 py-1 text-muted-foreground">
            {meta.label}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

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
  low: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
} satisfies Record<InsightRecord['priority'], string>;

export function InsightCard({ insight }: { insight: InsightRecord }) {
  const meta = typeMeta[insight.type];
  const Icon = meta.icon;

  return (
    <Card className="min-w-[280px] border-white/60 bg-white/90 shadow-sm">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-secondary p-2">
              <Icon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-medium">{meta.label}</p>
              <p className="text-xs text-muted-foreground">{formatDate(insight.date)}</p>
            </div>
          </div>
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${priorityTone[insight.priority]}`}>
            {insight.priority}
          </span>
        </div>
        <p className="text-sm leading-6 text-foreground">{insight.insightText}</p>
        <div className="flex flex-wrap gap-2 text-xs">
          {insight.category ? (
            <span className="rounded-full bg-secondary px-2 py-1 text-muted-foreground">{insight.category}</span>
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

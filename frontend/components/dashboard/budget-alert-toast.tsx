'use client';

import { BudgetAlert } from '@/lib/dashboard-types';
import { AlertTriangle, X } from 'lucide-react';
import { MoneyDisplay } from '@/components/ui/money-display';

export function BudgetAlertToast({
  alert,
  onDismiss,
}: {
  alert: BudgetAlert;
  onDismiss: () => void;
}) {
  const tone =
    alert.threshold >= 100
      ? 'border-danger/20 bg-danger/10 text-danger'
      : 'border-warning/20 bg-warning/10 text-warning';

  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-soft ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div className="space-y-1">
          <p className="font-semibold">
            {alert.categoryName} crossed {alert.threshold}%
          </p>
          <p>
            Spent <MoneyDisplay amount={alert.spent} /> of <MoneyDisplay amount={alert.budgetAmount} /> for {alert.month}.
          </p>
        </div></div>
        <button aria-label="Dismiss alert" className="rounded-lg p-1 hover:bg-foreground/5" onClick={onDismiss} type="button">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

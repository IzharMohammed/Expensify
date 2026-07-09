'use client';

import { BudgetAlert } from '@/lib/dashboard-types';

export function BudgetAlertToast({
  alert,
  onDismiss,
}: {
  alert: BudgetAlert;
  onDismiss: () => void;
}) {
  const tone =
    alert.threshold >= 100
      ? 'border-red-300 bg-red-50 text-red-800'
      : 'border-amber-300 bg-amber-50 text-amber-800';

  return (
    <div className={`rounded-xl border px-4 py-3 shadow-lg ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 text-sm">
          <p className="font-semibold">
            {alert.categoryName} crossed {alert.threshold}%
          </p>
          <p>
            Spent Rs. {alert.spent.toFixed(0)} of Rs. {alert.budgetAmount.toFixed(0)} for {alert.month}.
          </p>
        </div>
        <button className="text-xs underline underline-offset-4" onClick={onDismiss} type="button">
          Dismiss
        </button>
      </div>
    </div>
  );
}

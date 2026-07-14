'use client';

import { Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Household } from '@/lib/household-types';
import { cn } from '@/lib/utils';

export type SharingDraft = {
  householdId: string;
  mode: 'equal' | 'custom' | 'percentage';
  values: Record<string, string>;
};

export function SharedSplitSelector({
  amount,
  disabled,
  households,
  onChange,
  value,
}: {
  amount: string | null;
  disabled: boolean;
  households: Household[];
  onChange: (value: SharingDraft) => void;
  value: SharingDraft;
}) {
  const household = households.find((item) => item.id === value.householdId);
  const total = household?.members.reduce((sum, member) => sum + Number(value.values[member.userId] || 0), 0) ?? 0;
  const expected = value.mode === 'percentage' ? 100 : Number(amount || 0);

  function selectHousehold(householdId: string) {
    const selected = households.find((item) => item.id === householdId);
    const values: Record<string, string> = {};
    selected?.members.forEach((member) => { values[member.userId] = ''; });
    onChange({ householdId, mode: 'equal', values });
  }

  function selectMode(mode: SharingDraft['mode']) {
    const values: Record<string, string> = {};
    if (household && mode === 'percentage') {
      const base = 100 / household.members.length;
      household.members.forEach((member, index) => {
        values[member.userId] = index === household.members.length - 1
          ? (100 - base * (household.members.length - 1)).toFixed(2)
          : base.toFixed(2);
      });
    } else if (household && mode === 'custom') {
      const base = Number(amount || 0) / household.members.length;
      household.members.forEach((member, index) => {
        values[member.userId] = index === household.members.length - 1
          ? (Number(amount || 0) - base * (household.members.length - 1)).toFixed(2)
          : base.toFixed(2);
      });
    }
    onChange({ ...value, mode, values });
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border/60 bg-secondary/30 p-4">
      <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><p className="text-sm font-semibold">Share this expense</p></div>
      <select className="flex h-11 w-full rounded-[10px] border border-input bg-card px-3 text-sm focus:outline-none focus:ring-4 focus:ring-ring/10" disabled={disabled} onChange={(event) => selectHousehold(event.target.value)} value={value.householdId}>
        <option value="">Personal expense</option>
        {households.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.members.length} members</option>)}
      </select>

      {household ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            {(['equal', 'custom', 'percentage'] as const).map((mode) => <button className={cn('rounded-xl border px-2 py-2.5 text-xs font-semibold capitalize transition-colors', value.mode === mode ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-secondary')} disabled={disabled} key={mode} onClick={() => selectMode(mode)} type="button">{mode}</button>)}
          </div>
          {value.mode === 'equal' ? <p className="rounded-xl bg-card p-3 text-sm text-muted-foreground">Split equally across all {household.members.length} members. Any remaining paisa is assigned deterministically.</p> : (
            <div className="space-y-3">
              {household.members.map((member) => (
                <div className="grid grid-cols-[1fr_120px] items-center gap-3" key={member.userId}>
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{member.name}</p><p className="truncate text-xs text-muted-foreground">{member.email}</p></div>
                  <div className="relative"><Input disabled={disabled} min="0" onChange={(event) => onChange({ ...value, values: { ...value.values, [member.userId]: event.target.value } })} step="0.01" type="number" value={value.values[member.userId] ?? ''} /><span className="pointer-events-none absolute right-3 top-3 text-xs text-muted-foreground">{value.mode === 'percentage' ? '%' : '₹'}</span></div>
                </div>
              ))}
              <p className={cn('text-right text-xs font-semibold', Math.abs(total - expected) < 0.005 ? 'text-primary' : 'text-danger')}>Total {total.toFixed(2)} / {expected.toFixed(2)} {value.mode === 'percentage' ? '%' : '₹'}</p>
            </div>
          )}
        </>
      ) : null}
      {!households.length ? <p className="text-xs text-muted-foreground">Create a household first to share expenses.</p> : null}
    </div>
  );
}

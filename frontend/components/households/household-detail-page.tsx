'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Copy, Link2, Scale, Users } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { MoneyDisplay } from '@/components/ui/money-display';
import { PageSkeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { Household, HouseholdBalances, HouseholdDebt, HouseholdMember } from '@/lib/household-types';

export function HouseholdDetailPage({ householdId }: { householdId: string }) {
  const [household, setHousehold] = useState<Household | null>(null);
  const [balances, setBalances] = useState<HouseholdBalances | null>(null);
  const [inviteUrl, setInviteUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void load(); }, [householdId]);

  async function load() {
    try {
      const [householdResponse, balancesResponse] = await Promise.all([
        api.get(`/households/${householdId}`),
        api.get(`/households/${householdId}/balances`),
      ]);
      setHousehold(householdResponse.data.household);
      setBalances(balancesResponse.data);
    } catch (requestError) {
      setError(readError(requestError, 'Could not load household'));
    }
  }

  async function createInvite() {
    setBusy(true);
    try {
      const response = await api.post(`/households/${householdId}/invite`);
      setInviteUrl(response.data.inviteUrl);
    } catch (requestError) {
      setError(readError(requestError, 'Could not create invite'));
    } finally { setBusy(false); }
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function settle(debt: HouseholdDebt) {
    setBusy(true);
    try {
      await api.post('/settlements', { householdId, ...debt });
      await load();
    } catch (requestError) {
      setError(readError(requestError, 'Could not record settlement'));
    } finally { setBusy(false); }
  }

  if (!household || !balances) return <AppShell title="Household"><PageSkeleton /></AppShell>;
  const memberById = new Map(balances.members.map((member) => [member.userId, member]));

  return (
    <AppShell actions={<Link className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground" href="/households"><ArrowLeft className="h-4 w-4" />All households</Link>} description="A clear ledger of shared costs and the shortest path to settle them." eyebrow="Shared wallet" title={household.name}>
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-3xl">Balances</CardTitle>
            <CardDescription>Settling one suggested transfer updates the household ledger.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {balances.debts.length === 0 ? <EmptyState description="Shared expenses are balanced. No one needs to pay anyone." icon={Scale} title="Everyone is settled" /> : null}
            {balances.debts.map((debt) => {
              const from = memberById.get(debt.fromUserId);
              const to = memberById.get(debt.toUserId);
              return (
                <div className="flex flex-col gap-4 rounded-2xl border border-border/50 bg-secondary/35 p-4 sm:flex-row sm:items-center" key={`${debt.fromUserId}-${debt.toUserId}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{balanceLabel(debt, balances.currentUserId, from, to)}</p>
                    <MoneyDisplay amount={debt.amount} className="mt-1 block font-display text-3xl" />
                  </div>
                  {debt.fromUserId === balances.currentUserId || household.role === 'owner' ? <Button disabled={busy} onClick={() => void settle(debt)}><Check className="h-4 w-4" />Settle up</Button> : null}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="font-display text-2xl">Members</CardTitle><CardDescription>{household.members.length} people share this wallet.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {household.members.map((member) => <MemberRow key={member.userId} member={member} />)}
            </CardContent>
          </Card>
          {household.role === 'owner' ? (
            <Card>
              <CardHeader><CardTitle className="font-display text-2xl">Invite someone</CardTitle><CardDescription>Links expire after seven days and can only join this household.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {!inviteUrl ? <Button className="w-full" disabled={busy} onClick={() => void createInvite()} variant="outline"><Link2 className="h-4 w-4" />Generate invite link</Button> : <Button className="w-full" onClick={() => void copyInvite()}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Copied' : 'Copy invite link'}</Button>}
              </CardContent>
            </Card>
          ) : null}
          {error ? <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p> : null}
        </div>
      </div>
    </AppShell>
  );
}

function MemberRow({ member }: { member: HouseholdMember }) {
  return <div className="flex items-center gap-3 rounded-xl bg-secondary/35 p-3"><div className="grid h-10 w-10 place-items-center rounded-[10px] bg-accent font-semibold text-accent-foreground">{member.name.charAt(0).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate font-semibold">{member.name}</p><p className="truncate text-xs text-muted-foreground">{member.email}</p></div><span className="rounded-full bg-card px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">{member.role}</span></div>;
}

function balanceLabel(debt: HouseholdDebt, userId: string, from?: HouseholdMember, to?: HouseholdMember) {
  if (debt.fromUserId === userId) return `You owe ${to?.name ?? 'a member'}`;
  if (debt.toUserId === userId) return `${from?.name ?? 'A member'} owes you`;
  return `${from?.name ?? 'A member'} owes ${to?.name ?? 'a member'}`;
}

function readError(error: unknown, fallback: string) {
  return (error as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback;
}

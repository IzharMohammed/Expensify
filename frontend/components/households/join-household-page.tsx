'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Home, Users } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';

export function JoinHouseholdPage({ householdId }: { householdId: string }) {
  const code = useSearchParams().get('code') ?? '';
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    try {
      await api.post(`/households/${householdId}/join`, { code });
      router.replace(`/households/${householdId}`);
    } catch (requestError) {
      setError((requestError as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'This invite could not be used');
      setBusy(false);
    }
  }

  return <AppShell description="Join a shared wallet to split expenses and keep balances transparent." eyebrow="Invitation" title="You have been invited"><div className="mx-auto max-w-lg"><Card className="overflow-hidden"><CardHeader className="items-center bg-primary py-10 text-center text-primary-foreground"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary-foreground/10"><Users className="h-7 w-7" /></div><CardTitle className="mt-3 font-display text-3xl">Join this household</CardTitle><CardDescription className="text-primary-foreground/65">Your personal expenses remain private. Only expenses explicitly shared with this household appear here.</CardDescription></CardHeader><CardContent className="space-y-4 pt-6"><Button className="w-full" disabled={busy || !code} onClick={() => void join()} size="lg"><Home className="h-4 w-4" />{busy ? 'Joining...' : 'Accept invitation'}</Button>{!code ? <p className="text-center text-sm text-danger">The invite code is missing from this link.</p> : null}{error ? <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p> : null}</CardContent></Card></div></AppShell>;
}

'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Home, Plus, Users } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageSkeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { Household } from '@/lib/household-types';

export function HouseholdsPage() {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'loading' | 'idle' | 'saving'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    try {
      const response = await api.get('/households');
      setHouseholds(response.data.households);
      setError(null);
    } catch (requestError) {
      setError(readError(requestError, 'Could not load households'));
    } finally {
      setStatus('idle');
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setStatus('saving');
    try {
      const response = await api.post('/households', { name: name.trim() });
      setHouseholds((current) => [response.data.household, ...current]);
      setName('');
      setError(null);
    } catch (requestError) {
      setError(readError(requestError, 'Could not create household'));
    } finally {
      setStatus('idle');
    }
  }

  if (status === 'loading') return <AppShell title="Households"><PageSkeleton /></AppShell>;

  return (
    <AppShell description="Share everyday costs without losing sight of who paid and who owes." eyebrow="Shared money" title="Households">
      <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
        <Card className="h-fit overflow-hidden">
          <CardHeader className="bg-primary text-primary-foreground">
            <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-primary-foreground/10"><Home className="h-5 w-5" /></div>
            <CardTitle className="font-display text-3xl">Create a shared wallet</CardTitle>
            <CardDescription className="text-primary-foreground/65">Start with a name. Invite family or flatmates after creation.</CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <form className="space-y-3" onSubmit={create}>
              <Input onChange={(event) => setName(event.target.value)} placeholder="e.g. Sharma family" value={name} />
              <Button className="w-full" disabled={status === 'saving' || name.trim().length < 2} type="submit"><Plus className="h-4 w-4" />{status === 'saving' ? 'Creating...' : 'Create household'}</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-3xl">Your shared wallets</CardTitle>
            <CardDescription>Open one to invite members, review balances, or settle up.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {households.length === 0 ? <EmptyState description="Create a household here, or open an invite link sent by an owner." icon={Users} title="No shared wallets yet" /> : null}
            {households.map((household) => (
              <Link className="group flex items-center gap-4 rounded-2xl bg-secondary/40 p-4 transition-all hover:-translate-y-0.5 hover:bg-secondary/65" href={`/households/${household.id}`} key={household.id}>
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent font-display text-xl text-accent-foreground">{household.name.charAt(0).toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold">{household.name}</p>
                  <p className="text-sm text-muted-foreground">{household.members.length} {household.members.length === 1 ? 'member' : 'members'} · {household.role}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </Link>
            ))}
            {error ? <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p> : null}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function readError(error: unknown, fallback: string) {
  const value = error as { response?: { data?: { message?: string } } };
  return value.response?.data?.message ?? fallback;
}

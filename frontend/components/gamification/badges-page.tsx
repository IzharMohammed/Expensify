'use client';

import { useEffect, useState } from 'react';
import { Award, CookingPot, Flame, Lock, PiggyBank, ReceiptText, Trophy } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { useGamificationEvents } from '@/components/gamification/gamification-events-provider';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSkeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { BadgeRecord } from '@/lib/gamification-types';
import { cn } from '@/lib/utils';

const ICONS = { Award, CookingPot, Flame, PiggyBank, ReceiptText, Trophy };

export function BadgesPage() {
  const { latestAward } = useGamificationEvents();
  const [badges, setBadges] = useState<BadgeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void load(); }, [latestAward?.id]);

  async function load() {
    try {
      const response = await api.get('/gamification/badges');
      setBadges(response.data.badges);
      setError(null);
    } catch {
      setError('Could not load badges');
    } finally { setLoading(false); }
  }

  if (loading) return <AppShell title="Badges"><PageSkeleton /></AppShell>;
  const earned = badges.filter((badge) => badge.earned).length;

  return (
    <AppShell description="Small, durable habits become visible milestones over time." eyebrow="Momentum" title="Badges">
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-3xl bg-primary p-7 text-primary-foreground sm:p-9"><div className="absolute -right-12 -top-20 h-60 w-60 rounded-full border border-primary-foreground/10" /><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary-foreground/60">Collection progress</p><div className="mt-3 flex items-end gap-3"><span className="font-display text-6xl">{earned}</span><span className="pb-2 text-primary-foreground/60">of {badges.length} unlocked</span></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-primary-foreground/10"><div className="h-full rounded-full bg-primary-foreground transition-all duration-700" style={{ width: `${badges.length ? (earned / badges.length) * 100 : 0}%` }} /></div></section>
        {badges.length === 0 ? <EmptyState description="Badge definitions will appear after the gamification migration is applied." icon={Award} title="No badges available" /> : null}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {badges.map((badge) => {
            const Icon = ICONS[badge.icon as keyof typeof ICONS] ?? Award;
            return <Card className={cn('overflow-hidden transition-all', badge.earned ? 'border-warning/20 hover:-translate-y-1 hover:shadow-soft' : 'border-border/45 bg-secondary/20 opacity-70')} key={badge.id}><CardContent className="p-5 sm:p-6"><div className="flex items-start justify-between"><span className={cn('grid h-14 w-14 place-items-center rounded-2xl', badge.earned ? 'bg-warning/15 text-warning' : 'bg-secondary text-muted-foreground')}><Icon className="h-7 w-7" /></span>{badge.earned ? <span className="rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-success">Earned</span> : <Lock className="h-4 w-4 text-muted-foreground" />}</div><h2 className="mt-5 font-display text-2xl">{badge.name}</h2><p className="mt-2 min-h-10 text-sm leading-5 text-muted-foreground">{badge.description}</p><p className="mt-5 text-xs font-medium text-muted-foreground">{badge.earnedAt ? `Unlocked ${formatDate(badge.earnedAt)}` : 'Keep building the habit to unlock'}</p></CardContent></Card>;
          })}
        </section>
        {error ? <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p> : null}
      </div>
    </AppShell>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

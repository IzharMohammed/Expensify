import Link from 'next/link';
import { ArrowRight, Flame } from 'lucide-react';
import { StreakSummary } from '@/lib/gamification-types';

export function StreakCard({ streak }: { streak: StreakSummary | null }) {
  return (
    <Link className="group flex flex-col gap-5 overflow-hidden rounded-3xl border border-warning/15 bg-gradient-to-br from-warning/14 via-card to-card p-5 transition-all hover:-translate-y-0.5 hover:border-warning/30 hover:shadow-soft sm:flex-row sm:items-center sm:p-6" href="/badges">
      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-warning/15 text-warning"><Flame className="h-7 w-7 fill-warning/15" /></div>
      <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-warning">Daily momentum</p><div className="mt-1 flex items-baseline gap-2"><span className="font-display text-4xl tabular-nums">{streak?.currentStreak ?? 0}</span><span className="font-semibold">day streak</span></div><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{streak?.rule ?? 'Your streak is evaluated once each day.'}</p></div>
      <div className="flex items-center justify-between gap-4 border-t border-warning/10 pt-4 sm:block sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0"><div><p className="text-xs text-muted-foreground">Personal best</p><p className="mt-1 text-lg font-bold tabular-nums">{streak?.longestStreak ?? 0} days</p></div><ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 sm:mt-3" /></div>
    </Link>
  );
}

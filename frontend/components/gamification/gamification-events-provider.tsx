'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Award, X } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { DASHBOARD_STREAM_URL } from '@/lib/config';
import { BadgeAward } from '@/lib/gamification-types';

const GamificationEventsContext = createContext<{ latestAward: BadgeAward | null }>({
  latestAward: null,
});

const CONFETTI = [
  { x: -120, color: '#E2A64B', rotate: -180, delay: 0 },
  { x: -82, color: '#5BAE8A', rotate: 210, delay: 0.04 },
  { x: -42, color: '#D86F5F', rotate: -130, delay: 0.08 },
  { x: 4, color: '#E7C86A', rotate: 260, delay: 0.02 },
  { x: 48, color: '#69AEB5', rotate: -240, delay: 0.1 },
  { x: 88, color: '#CB7658', rotate: 190, delay: 0.06 },
  { x: 126, color: '#77A46B', rotate: -210, delay: 0.12 },
];

export function GamificationEventsProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, user } = useAuth();
  const [awardQueue, setAwardQueue] = useState<BadgeAward[]>([]);
  const latestAward = awardQueue[0] ?? null;

  useEffect(() => {
    if (!user || !accessToken) return;
    const stream = new EventSource(
      `${DASHBOARD_STREAM_URL}?token=${encodeURIComponent(accessToken)}`,
    );
    stream.addEventListener('badge_earned', (event) => {
      const award = JSON.parse((event as MessageEvent<string>).data) as BadgeAward;
      setAwardQueue((current) =>
        current.some((item) => item.id === award.id) ? current : [...current, award],
      );
    });
    return () => stream.close();
  }, [accessToken, user]);

  useEffect(() => {
    if (!latestAward) return;
    const timeout = window.setTimeout(() => setAwardQueue((current) => current.slice(1)), 6500);
    return () => window.clearTimeout(timeout);
  }, [latestAward]);

  return (
    <GamificationEventsContext.Provider value={{ latestAward }}>
      {children}
      <AnimatePresence>
        {latestAward ? (
          <motion.aside animate={{ opacity: 1, y: 0, scale: 1 }} aria-live="polite" className="fixed inset-x-3 top-20 z-[100] mx-auto max-w-md overflow-hidden rounded-3xl border border-warning/25 bg-card p-5 shadow-lift sm:inset-x-auto sm:right-6 sm:top-6 sm:mx-0 sm:w-[390px]" exit={{ opacity: 0, y: -14, scale: 0.97 }} initial={{ opacity: 0, y: -24, scale: 0.94 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
            <div className="pointer-events-none absolute left-1/2 top-2">
              {CONFETTI.map((piece) => <motion.span animate={{ x: piece.x, y: 105, rotate: piece.rotate, opacity: [0, 1, 1, 0] }} className="absolute h-2.5 w-1.5 rounded-sm" initial={{ x: 0, y: 0, opacity: 0 }} key={piece.x} style={{ backgroundColor: piece.color }} transition={{ delay: piece.delay, duration: 1.35, ease: 'easeOut' }} />)}
            </div>
            <div className="relative flex items-start gap-4">
              <motion.span animate={{ rotate: [0, -10, 8, 0], scale: [1, 1.16, 1] }} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-warning/15 text-warning" transition={{ delay: 0.25, duration: 0.6 }}><Award className="h-6 w-6" /></motion.span>
              <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-warning">Badge unlocked</p><p className="mt-1 font-display text-2xl">{latestAward.name}</p><p className="mt-1 text-sm leading-5 text-muted-foreground">{latestAward.description}</p></div>
              <button aria-label="Dismiss badge award" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" onClick={() => setAwardQueue((current) => current.slice(1))} type="button"><X className="h-4 w-4" /></button>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </GamificationEventsContext.Provider>
  );
}

export function useGamificationEvents() {
  return useContext(GamificationEventsContext);
}

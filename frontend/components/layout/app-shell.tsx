'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  Bot,
  CalendarClock,
  ChevronUp,
  Gauge,
  Lightbulb,
  Medal,
  Menu,
  PiggyBank,
  ReceiptText,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { NotificationBell } from '@/components/dashboard/notification-bell';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { cn } from '@/lib/utils';

const links = [
  { href: '/', label: 'Dashboard', icon: Gauge },
  { href: '/analytics', label: 'Reports', icon: BarChart3 },
  { href: '/budgets', label: 'Budgets', icon: ReceiptText },
  { href: '/goals', label: 'Goals', icon: PiggyBank },
  { href: '/badges', label: 'Badges', icon: Medal },
  { href: '/households', label: 'Households', icon: Users },
  { href: '/recurring', label: 'Recurring', icon: CalendarClock },
  { href: '/insights', label: 'Insights', icon: Lightbulb },
  { href: '/chat', label: 'AI Chat', icon: Bot },
];

const mobilePrimary = links.filter((link) => ['/', '/analytics', '/budgets', '/goals'].includes(link.href));
const mobileSecondary = links.filter((link) => !mobilePrimary.includes(link));

export function AppShell({
  title,
  eyebrow,
  description,
  actions,
  children,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = mobileSecondary.some((link) => isActive(pathname, link.href));

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[84px] flex-col border-r border-border/55 bg-card/80 px-3 py-5 backdrop-blur-xl md:flex lg:w-[252px] lg:px-4">
        <Link className="flex items-center justify-center gap-3 lg:justify-start lg:px-3" href="/">
          <BrandMark />
          <div className="hidden lg:block">
            <p className="font-display text-xl leading-none">Expensify</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Personal finance</p>
          </div>
        </Link>

        <nav className="mt-10 space-y-1">
          {links.map((link) => <NavLink key={link.href} link={link} pathname={pathname} />)}
        </nav>

        <div className="mt-auto border-t border-border/60 pt-4">
          <div className="flex flex-col items-center gap-2 rounded-xl py-2 lg:flex-row lg:gap-3 lg:px-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-accent text-xs font-bold text-accent-foreground">
              {initials(user?.name)}
            </div>
            <div className="hidden min-w-0 flex-1 lg:block">
              <p className="truncate text-sm font-semibold">{user?.name ?? 'Your account'}</p>
              <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => logout()} type="button">Sign out</button>
            </div>
            <div className="lg:hidden"><NotificationBell /></div>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/50 bg-background/85 px-4 backdrop-blur-xl md:hidden">
        <Link className="flex items-center gap-2" href="/">
          <BrandMark compact />
          <span className="font-display text-xl">Ledger</span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <NotificationBell />
        </div>
      </header>

      <div className="md:pl-[84px] lg:pl-[252px]">
        <main className="mx-auto min-h-screen max-w-[1500px] px-4 pb-28 pt-7 sm:px-6 sm:pt-9 md:pb-12 lg:px-10 lg:pt-10 xl:px-12">
          <header className="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              {eyebrow ? <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">{eyebrow}</p> : null}
              <h1 className="font-display text-[2.35rem] leading-[1.02] tracking-[-0.025em] sm:text-5xl">{title}</h1>
              {description ? <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">{description}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              {actions}
              <div className="hidden lg:block"><NotificationBell /></div>
            </div>
          </header>

          <motion.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 8 }} key={pathname} transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}>
            {children}
          </motion.div>
        </main>
      </div>

      <AnimatePresence>
        {moreOpen ? (
          <motion.div animate={{ opacity: 1 }} className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm md:hidden" exit={{ opacity: 0 }} initial={{ opacity: 0 }} onClick={() => setMoreOpen(false)}>
            <motion.div animate={{ y: 0 }} className="absolute inset-x-3 bottom-24 rounded-3xl border border-border/60 bg-card p-3 shadow-lift" exit={{ y: 24 }} initial={{ y: 24 }} onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between px-3 pb-2 pt-1">
                <p className="text-sm font-semibold">More</p>
                <button className="rounded-lg p-2 text-muted-foreground" onClick={() => setMoreOpen(false)} type="button"><X className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {mobileSecondary.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link className="flex flex-col items-center gap-2 rounded-2xl bg-secondary/60 px-2 py-4 text-xs font-semibold" href={link.href} key={link.href} onClick={() => setMoreOpen(false)}>
                      <Icon className="h-5 w-5" strokeWidth={1.8} />{link.label}
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <nav className="fixed inset-x-3 bottom-3 z-50 flex h-[68px] items-center justify-around rounded-[22px] border border-border/60 bg-card/92 px-1 shadow-lift backdrop-blur-xl md:hidden">
        {mobilePrimary.map((link) => {
          const Icon = link.icon;
          const active = isActive(pathname, link.href);
          return (
            <Link className={cn('flex min-w-[58px] flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold transition-colors', active ? 'text-primary' : 'text-muted-foreground')} href={link.href} key={link.href}>
              <Icon className={cn('h-5 w-5', active && 'fill-primary/10')} strokeWidth={active ? 2.2 : 1.8} />{link.label}
            </Link>
          );
        })}
        <button className={cn('flex min-w-[58px] flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold', moreOpen || moreActive ? 'text-primary' : 'text-muted-foreground')} onClick={() => setMoreOpen((current) => !current)} type="button">
          {moreOpen ? <ChevronUp className="h-5 w-5" /> : <Menu className="h-5 w-5" />}More
        </button>
      </nav>
    </div>
  );
}

function NavLink({ link, pathname }: { link: (typeof links)[number]; pathname: string }) {
  const Icon = link.icon;
  const active = isActive(pathname, link.href);
  return (
    <Link className={cn('group flex items-center justify-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors lg:justify-start', active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-secondary/65 hover:text-foreground')} href={link.href}>
      <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.2 : 1.7} />
      <span className="hidden lg:inline">{link.label}</span>
      {active ? <motion.span className="ml-auto hidden h-1.5 w-1.5 rounded-full bg-primary lg:block" layoutId="nav-dot" /> : null}
    </Link>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return <span className={cn('relative grid place-items-center rounded-[11px] bg-primary text-primary-foreground shadow-sm', compact ? 'h-8 w-8' : 'h-10 w-10')}><span className="font-display text-lg italic">L</span></span>;
}

function initials(name?: string) {
  return name?.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'ME';
}

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

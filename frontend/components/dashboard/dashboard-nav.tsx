'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NotificationBell } from '@/components/dashboard/notification-bell';
import { cn } from '@/lib/utils';

export function DashboardNav() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Capture' },
    { href: '/analytics', label: 'Analytics' },
    { href: '/budgets', label: 'Budgets' },
    { href: '/goals', label: 'Goals' },
    { href: '/recurring', label: 'Recurring' },
    { href: '/insights', label: 'Insights' },
    { href: '/chat', label: 'Chat' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <nav className="flex flex-wrap gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition',
              pathname === link.href
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-foreground hover:bg-secondary',
            )}
            href={link.href}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <NotificationBell />
    </div>
  );
}

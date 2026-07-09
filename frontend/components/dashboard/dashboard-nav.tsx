'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function DashboardNav() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Capture' },
    { href: '/budgets', label: 'Budgets' },
  ];

  return (
    <nav className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={link.href}
          className={cn(
            'rounded-full px-4 py-2 text-sm font-medium transition',
            pathname === link.href
              ? 'bg-primary text-primary-foreground'
              : 'bg-white/80 text-foreground hover:bg-white',
          )}
          href={link.href}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

'use client';

import { animate } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export function MoneyDisplay({
  amount,
  className,
  decimals = 0,
  compact = false,
}: {
  amount: number | string;
  className?: string;
  decimals?: number;
  compact?: boolean;
}) {
  const numericAmount = Number(amount) || 0;
  const previous = useRef(0);
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const controls = animate(previous.current, numericAmount, {
      duration: 0.55,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: setDisplayed,
    });
    previous.current = numericAmount;
    return () => controls.stop();
  }, [numericAmount]);

  return (
    <span className={cn('money-figures whitespace-nowrap', className)}>
      {new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        notation: compact ? 'compact' : 'standard',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(displayed)}
    </span>
  );
}

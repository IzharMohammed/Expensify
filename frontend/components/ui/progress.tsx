import { cn } from '@/lib/utils';

export function Progress({
  className,
  indicatorClassName,
  value,
}: {
  className?: string;
  indicatorClassName?: string;
  value: number;
}) {
  const normalized = Math.max(0, Math.min(100, value));

  return (
    <div className={cn('relative h-3 w-full overflow-hidden rounded-full bg-secondary', className)}>
      <div
        className={cn('h-full rounded-full transition-all', indicatorClassName)}
        style={{ width: `${normalized}%` }}
      />
    </div>
  );
}

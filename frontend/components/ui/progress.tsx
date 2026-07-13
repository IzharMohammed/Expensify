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
    <div className={cn('relative h-2 w-full overflow-hidden rounded-full bg-secondary', className)}>
      <div
        className={cn('h-full rounded-full bg-primary transition-all duration-700 ease-out', indicatorClassName)}
        style={{ width: `${normalized}%` }}
      />
    </div>
  );
}

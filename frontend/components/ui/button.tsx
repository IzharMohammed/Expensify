import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-semibold transition-[transform,background-color,color,border-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-[0_1px_2px_hsl(var(--primary)/0.18)] hover:-translate-y-px hover:bg-primary/90 hover:shadow-md',
        outline: 'border border-border bg-card text-foreground hover:border-primary/25 hover:bg-accent/60',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/75',
        ghost: 'text-muted-foreground hover:bg-secondary hover:text-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2',
        lg: 'h-12 px-6 text-[15px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

export { Button, buttonVariants };

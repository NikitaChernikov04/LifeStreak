import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Buttons are stamps and form fields: cut corners, hairline rules, condensed
 * caps. Pressing one moves it down a pixel, the way a rubber stamp meets paper.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none border font-display uppercase leading-none tracking-[0.14em] transition-[transform,background-color,color,border-color] duration-100 active:translate-y-px disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        // The one action that matters on any screen: writing the day down.
        default: 'border-ink bg-ink text-paper hover:bg-ink-soft',
        outline: 'border-ink/40 bg-transparent text-ink hover:border-ink hover:bg-ink/[0.04]',
        quiet: 'border-transparent bg-transparent text-graphite hover:text-ink',
        // Vermilion means a break in the record — recovery is the only button that wears it.
        danger: 'border-vermilion bg-vermilion/[0.06] text-vermilion hover:bg-vermilion/[0.12]',
      },
      size: {
        default: 'h-11 px-5 text-[0.9375rem]',
        sm: 'h-8 px-3 text-xs tracking-[0.12em]',
        lg: 'h-12 px-6 text-base',
        icon: 'h-9 w-9 px-0',
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
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  ),
);
Button.displayName = 'Button';

export { Button, buttonVariants };

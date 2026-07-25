import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Every screen is a sheet of the notebook: a ruled left margin with room for
 * marginalia, and the body of the page to the right of it. Children that want
 * to write in the margin position themselves at `-left-11`.
 */
export function Sheet({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('relative mx-auto min-h-full w-full max-w-md pb-32 pl-12 pr-4 pt-5', className)}>
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-12 w-px bg-vermilion/40" />
      {children}
    </div>
  );
}

/** Page masthead — matches the rule and weight of the home screen's greeting. */
export function SheetTitle({ children, meta }: { children: ReactNode; meta?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 border-b border-ink pb-2">
      {/* Same fluid step as the home greeting, so page mastheads match. */}
      <h1 className="min-w-0 font-display text-[clamp(1.25rem,6.5vw,1.625rem)] uppercase leading-tight tracking-[0.04em]">
        {children}
      </h1>
      {meta !== undefined && (
        <span className="figure shrink-0 text-label text-graphite">{meta}</span>
      )}
    </header>
  );
}

/** A pre-printed field label with a rule running to the end of the line. */
export function FieldHeading({
  children,
  count,
  className,
}: {
  children: ReactNode;
  count?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <h2 className="field-label shrink-0">{children}</h2>
      <span aria-hidden className="h-px flex-1 bg-ink/15" />
      {count !== undefined && <span className="figure text-label text-graphite">{count}</span>}
    </div>
  );
}

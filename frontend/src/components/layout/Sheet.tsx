import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Every screen is a sheet of the notebook. The page runs edge to edge with a
 * single modest margin: on a 320px phone a ruled gutter costs a sixth of the
 * measure, and the entries themselves already read as a ruled page.
 */
export function Sheet({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('relative mx-auto min-h-full w-full max-w-md px-4 pb-28 pt-5', className)}>
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

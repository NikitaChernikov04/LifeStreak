import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Every screen is a sheet of the notebook.
 *
 * The sheet has a margin rule: one hairline down the left, the way a Russian
 * school notebook prints поля, and everything written respects it. It is the
 * only structural line the page draws for itself, and it is doing work rather
 * than decorating — it is what makes headings, entries, figures and blocks
 * share a single left edge instead of each finding their own. On a 320px
 * screen it costs eight pixels of measure, which is what a page costs.
 */
export function Sheet({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'relative mx-auto min-h-full w-full max-w-md pb-28 pl-[calc(var(--margin-rule)+var(--margin-gutter))] pr-4 pt-5',
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-[var(--margin-rule)] w-px bg-ink/[0.13]"
      />
      {children}
    </div>
  );
}

/**
 * Page masthead. Sits under the heaviest rule on the sheet — full-weight ink,
 * against the hairlines everything below it uses. Three weights of rule is the
 * whole hierarchy: page, section, entry.
 */
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

/**
 * A section heading: a pre-printed field label with its rule running to the
 * end of the line.
 *
 * Three weights of rule carry the whole hierarchy — full ink under the page
 * masthead, ink/20 under a section, ink/15 under an entry — and the label
 * starts exactly where every entry below it starts. Nothing else is needed to
 * say a section has begun, so nothing else is drawn.
 */
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
      <h2 className="field-label shrink-0 text-ink-soft">{children}</h2>
      <span aria-hidden className="h-px flex-1 bg-ink/20" />
      {count !== undefined && <span className="figure text-label text-graphite">{count}</span>}
    </div>
  );
}

import { cn } from '@/lib/utils';

/**
 * The signature element: one streak rendered as a strip of the notebook's
 * record — one cell per day, four weeks wide.
 *
 * Every mark encodes a real rule of the game rather than decorating it:
 *  · a full-height tick is a day that earned a heart (every 7th day)
 *  · a short tick is an ordinary recorded day
 *  · a dotted cell is today, still unwritten — the caret blinks there
 *  · a vermilion bar is a missed day, the only place that colour appears
 *  · faint dots are days before the streak began, when nothing was observed
 */

const WINDOW = 28; // four weeks — 7 is the unit the game actually pays out on

type CellKind = 'blank' | 'day' | 'heartday' | 'today' | 'gap';

interface Cell {
  kind: CellKind;
  dayInStreak?: number;
}

export function buildTape(count: number, doneToday: boolean, hasGap: boolean): Cell[] {
  // Today always sits in the last position; the record is built backwards from it.
  const todayIndex = WINDOW - 1;
  const lastRecorded = doneToday ? todayIndex : hasGap ? todayIndex - 2 : todayIndex - 1;

  const cells: Cell[] = Array.from({ length: WINDOW }, () => ({ kind: 'blank' }) as Cell);

  for (let i = lastRecorded; i >= 0; i--) {
    const dayInStreak = count - (lastRecorded - i);
    if (dayInStreak < 1) break;
    cells[i] = {
      kind: dayInStreak % 7 === 0 ? 'heartday' : 'day',
      dayInStreak,
    };
  }

  if (hasGap) cells[todayIndex - 1] = { kind: 'gap' };
  if (!doneToday) cells[todayIndex] = { kind: 'today' };

  return cells;
}

interface RecordTapeProps {
  count: number;
  doneToday: boolean;
  hasGap?: boolean;
  /** Larger scale for the exported share image. */
  large?: boolean;
  className?: string;
}

export function RecordTape({ count, doneToday, hasGap = false, large, className }: RecordTapeProps) {
  const cells = buildTape(count, doneToday, hasGap);
  const overflows = count > (doneToday ? WINDOW : WINDOW - 1);

  // Ordinary days sit low, heart days rise to full height: the strip reads as a
  // ruled scale where the tall marks are the payouts, not as a solid bar.
  const h = large
    ? { base: 'h-16', tick: 'h-6', heart: 'h-16', blank: 'h-1.5' }
    : { base: 'h-8', tick: 'h-3', heart: 'h-8', blank: 'h-[3px]' };

  return (
    <div className={cn('flex items-end gap-[3px]', h.base, className)} aria-hidden>
      {overflows && (
        <span
          className={cn(
            'mr-0.5 shrink-0 font-mono leading-none text-graphite',
            large ? 'text-sm' : 'text-micro',
          )}
        >
          …
        </span>
      )}
      {cells.map((cell, i) => {
        const isNewest = cell.dayInStreak === count && doneToday;
        const key = isNewest ? `newest-${count}` : `${i}-${cell.kind}`;

        if (cell.kind === 'heartday') {
          return (
            <span
              key={key}
              className={cn(
                'min-w-0 flex-1 bg-ink',
                h.heart,
                isNewest && 'origin-bottom animate-stamp',
              )}
            />
          );
        }
        if (cell.kind === 'day') {
          return (
            <span
              key={key}
              className={cn(
                'min-w-0 flex-1 bg-ink',
                h.tick,
                isNewest && 'origin-bottom animate-stamp',
              )}
            />
          );
        }
        if (cell.kind === 'gap') {
          return <span key={key} className={cn('min-w-0 flex-1 bg-vermilion', h.heart)} />;
        }
        if (cell.kind === 'today') {
          // The blank waiting to be written in — full height so it reads as the
          // next thing to do, not as a gap in the data.
          return (
            <span
              key={key}
              className={cn(
                'min-w-0 flex-1 animate-caret border border-dashed border-indigo bg-indigo/15',
                h.heart,
              )}
            />
          );
        }
        return <span key={key} className={cn('min-w-0 flex-1 bg-grid', h.blank)} />;
      })}
    </div>
  );
}

/** Days remaining until the next heart (streaks pay out one every 7 days). */
export function daysToNextHeart(count: number): number {
  return 7 - (count % 7);
}

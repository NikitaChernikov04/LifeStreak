import { cn } from '@/lib/utils';

/**
 * The signature element: one streak rendered as a strip of the notebook's
 * record — one square cell per day, two weeks wide.
 *
 * Every mark encodes a real rule of the game rather than decorating it:
 *  · a filled cell is a recorded day
 *  · an ochre cell is a day that paid out a heart (every 7th)
 *  · a hollow cell is a day carried over from before the journal
 *  · a dashed cell is today, still unwritten — the caret blinks there
 *  · a vermilion cell is a missed day, the only place that colour appears
 *  · a hairline outline is a day before the streak began
 */

const WINDOW = 14; // two weeks — wide enough to always show a heart day

type CellKind = 'blank' | 'day' | 'heartday' | 'imported' | 'today' | 'gap';

interface Cell {
  kind: CellKind;
  dayInStreak?: number;
}

export function buildTape(
  count: number,
  doneToday: boolean,
  hasGap: boolean,
  importedCount = 0,
): Cell[] {
  // Today always sits in the last position; the record is built backwards from it.
  const todayIndex = WINDOW - 1;
  const lastRecorded = doneToday ? todayIndex : hasGap ? todayIndex - 2 : todayIndex - 1;

  const cells: Cell[] = Array.from({ length: WINDOW }, () => ({ kind: 'blank' }) as Cell);

  for (let i = lastRecorded; i >= 0; i--) {
    const dayInStreak = count - (lastRecorded - i);
    if (dayInStreak < 1) break;
    cells[i] = {
      // Carried-over days were never observed here, so they are drawn hollow —
      // the heart payout only applies to days actually recorded in the app.
      kind:
        dayInStreak <= importedCount
          ? 'imported'
          : dayInStreak % 7 === 0
            ? 'heartday'
            : 'day',
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
  /** Days carried over from before the user joined — drawn hollow. */
  importedCount?: number;
  /** Larger scale for the exported share image. */
  large?: boolean;
  className?: string;
}

const CELL: Record<CellKind, string> = {
  day: 'bg-ink border-ink',
  heartday: 'bg-ochre border-ochre',
  imported: 'bg-transparent border-ink/55',
  gap: 'bg-vermilion border-vermilion',
  today: 'animate-caret border-dashed border-indigo bg-indigo/15',
  blank: 'bg-transparent border-ink/15',
};

export function RecordTape({
  count,
  doneToday,
  hasGap = false,
  importedCount = 0,
  large,
  className,
}: RecordTapeProps) {
  const cells = buildTape(count, doneToday, hasGap, importedCount);
  const overflows = count > (doneToday ? WINDOW : WINDOW - 1);

  return (
    <div className={cn('flex w-full items-center gap-[3px]', className)} aria-hidden>
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
        return (
          <span
            key={isNewest ? `newest-${count}` : `${i}-${cell.kind}`}
            className={cn(
              'aspect-square min-w-0 flex-1 border',
              large ? 'max-w-[24px]' : 'max-w-[16px]',
              CELL[cell.kind],
              isNewest && 'origin-bottom animate-stamp',
            )}
          />
        );
      })}
    </div>
  );
}

/** Days remaining until the next heart (streaks pay out one every 7 days). */
export function daysToNextHeart(count: number): number {
  return 7 - (count % 7);
}

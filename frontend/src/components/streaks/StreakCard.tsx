import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import type { Streak } from '@/types/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isCheckedInToday, isRecoverable } from '@/lib/streak';
import { useArchiveStreak, useCheckinStreak, useRecoverStreak } from '@/hooks/useStreaks';
import { RecordTape, daysToNextHeart } from './RecordTape';

interface StreakCardProps {
  streak: Streak;
  onShare?: (streak: Streak) => void;
}

/**
 * One observation in the journal. Deliberately not a card: entries are ruled
 * off from each other, so the page reads as a sheet rather than a feed. The
 * streak's own colour appears once, on the margin tab — everything else is ink.
 */
export function StreakCard({ streak, onShare }: StreakCardProps) {
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const checkin = useCheckinStreak();
  const recover = useRecoverStreak();
  const archive = useArchiveStreak();

  const doneToday = isCheckedInToday(streak);
  const canRecover = !doneToday && isRecoverable(streak);
  const toHeart = daysToNextHeart(streak.currentCount);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.25 }}
      className="relative border-b border-ink/15 py-5"
      onDoubleClick={() => onShare?.(streak)}
    >
      {/* Margin tab: the only place a streak's colour is spent. */}
      <div
        className="absolute -left-12 top-5 flex h-10 w-10 items-center justify-center border text-lg"
        style={{ borderColor: streak.color, backgroundColor: `${streak.color}1F` }}
      >
        {streak.icon}
      </div>

      {/* The title gets the full measure — pinning actions beside it squeezed
          long names into a four-word-tall column on narrow phones. */}
      <h3 className="font-display text-xl uppercase leading-tight tracking-[0.05em]">
        {streak.title}
      </h3>

      {/* The count and its action share a line: the day's work is one gesture,
          and a full-width button per entry would turn the page into a stack of
          black bars. */}
      <div className="mt-1.5 flex flex-wrap items-end gap-x-3 gap-y-2">
        <div className="flex items-end gap-2">
          <AnimatePresence mode="popLayout">
            <motion.span
              key={streak.currentCount}
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 8, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="font-display text-5xl leading-[0.85] tabular-nums"
            >
              {streak.currentCount}
            </motion.span>
          </AnimatePresence>
          <span className="pb-0.5 font-mono text-micro uppercase leading-tight text-graphite">
            {pluralizeDays(streak.currentCount)}
            <br />
            подряд
          </span>
        </div>

        {doneToday ? (
          <span className="ml-auto border border-ink/30 px-2.5 py-1.5 font-mono text-micro uppercase text-graphite">
            ✓ Записано
          </span>
        ) : canRecover ? (
          <Button
            size="sm"
            className="ml-auto h-9"
            variant="danger"
            disabled={recover.isPending}
            onClick={() => recover.mutate(streak.id)}
          >
            Восстановить
          </Button>
        ) : (
          <Button
            size="sm"
            className="ml-auto h-9"
            disabled={checkin.isPending}
            onClick={() => checkin.mutate(streak)}
          >
            Записать день
          </Button>
        )}
      </div>

      <RecordTape
        className="mt-3"
        count={streak.currentCount}
        doneToday={doneToday}
        hasGap={canRecover}
      />

      {/* Entry footer: the reading on the left, the entry's own controls on the
          right. Wraps rather than collides when the measure runs out. */}
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 font-mono text-micro uppercase">
        {canRecover ? (
          <p className="text-vermilion">Пропущен вчерашний день · спишется 1 сердце</p>
        ) : (
          <p className="text-graphite">
            До сердца {toHeart} · веха {streak.nextGoal}
          </p>
        )}

        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => onShare?.(streak)}
            className="uppercase text-graphite transition-colors hover:text-ink"
          >
            Вырезка
          </button>
          <button
            onClick={() => (confirmingArchive ? archive.mutate(streak.id) : setConfirmingArchive(true))}
            onBlur={() => setConfirmingArchive(false)}
            className={cn(
              'uppercase transition-colors hover:text-ink',
              confirmingArchive ? 'text-vermilion underline underline-offset-2' : 'text-graphite',
            )}
          >
            {confirmingArchive ? 'Точно?' : 'В архив'}
          </button>
        </div>
      </div>
    </motion.article>
  );
}

function pluralizeDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'дней';
  if (mod10 === 1) return 'день';
  if (mod10 >= 2 && mod10 <= 4) return 'дня';
  return 'дней';
}

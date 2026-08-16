import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import type { Streak } from '@/types/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isCheckedInToday, isRecoverable, pluralizeDays } from '@/lib/streak';
import { useArchiveStreak, useCheckinStreak, useRecoverStreak } from '@/hooks/useStreaks';
import { RecordTape, daysToNextHeart } from './RecordTape';

interface StreakCardProps {
  streak: Streak;
  onShare?: (streak: Streak) => void;
}

/**
 * One observation in the journal. Deliberately not a card: entries are ruled
 * off from each other, so the page reads as a sheet rather than a feed — and
 * so a run you keep alone stays visibly a different kind of thing from a goal
 * you hold with somebody, which is boxed. The streak's own colour appears
 * once, on the icon tile; everything else is ink.
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
      className="entry flex gap-3"
      onDoubleClick={() => onShare?.(streak)}
    >
      {/* The tile is the only place a streak's colour is spent. */}
      <div
        className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center border text-lg"
        style={{ borderColor: streak.color, backgroundColor: `${streak.color}1F` }}
      >
        {streak.icon}
      </div>

      <div className="min-w-0 flex-1">
        {/* Title and count on the left, the day's one action pinned right. */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-lg uppercase leading-tight tracking-[0.05em]">
              {streak.title}
            </h3>

            <div className="mt-1 flex items-end gap-2">
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={streak.currentCount}
                  initial={{ y: -8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 8, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="font-display text-[2.75rem] leading-[0.8] tabular-nums"
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
          </div>

          {doneToday ? (
            <span className="chip mt-0.5 shrink-0">✓ Записано</span>
          ) : canRecover ? (
            <Button
              size="sm"
              className="mt-0.5 shrink-0"
              variant="danger"
              disabled={recover.isPending}
              onClick={() => recover.mutate(streak.id)}
            >
              Восстановить
            </Button>
          ) : (
            <Button
              size="sm"
              className="mt-0.5 shrink-0"
              disabled={checkin.isPending}
              onClick={() => checkin.mutate(streak)}
            >
              Записать
            </Button>
          )}
        </div>

        <RecordTape
          className="mt-3"
          count={streak.currentCount}
          doneToday={doneToday}
          hasGap={canRecover}
          importedCount={streak.importedCount}
        />

        {/* Entry footer: the reading on the left, the entry's own controls on the
            right. The controls are underlined and the reading is not — without
            that they were the same grey micro caps and ran together as one
            sentence. Wraps rather than collides when the measure runs out. */}
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 font-mono text-micro uppercase">
          {canRecover ? (
            <p className="text-vermilion">Пропущен вчера · спишется 1 сердце</p>
          ) : (
            <p className="text-graphite">
              До сердца {toHeart} · веха {streak.nextGoal}
            </p>
          )}

          <div className="ml-auto flex items-center gap-4">
            <button onClick={() => onShare?.(streak)} className="entry-action">
              Вырезка
            </button>
            <button
              onClick={() =>
                confirmingArchive ? archive.mutate(streak.id) : setConfirmingArchive(true)
              }
              onBlur={() => setConfirmingArchive(false)}
              className={cn(
                'entry-action',
                confirmingArchive && 'border-vermilion text-vermilion hover:border-vermilion hover:text-vermilion',
              )}
            >
              {confirmingArchive ? 'Точно?' : 'В архив'}
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

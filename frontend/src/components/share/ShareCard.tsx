import { forwardRef } from 'react';
import type { Streak } from '@/types/api';
import { RecordTape } from '@/components/streaks/RecordTape';
import { isCheckedInToday } from '@/lib/streak';

interface ShareCardProps {
  streak: Streak;
}

// Exported as an image, so every colour is written out literally rather than
// left to a custom property the serialiser would have to resolve.
const PAPER = '#F4F1E7';
const PAPER_EDGE = '#EEEADD';
const INK = '#26211D';
const GRID = '#CAC2AF';
const GRAPHITE = '#7D7569';

/** A clipping torn from the journal: same paper, same rules, no app chrome. */
export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(({ streak }, ref) => {
  const doneToday = isCheckedInToday(streak);

  return (
    <div
      ref={ref}
      className="flex aspect-[4/5] w-full flex-col justify-between p-7"
      style={{
        backgroundColor: PAPER,
        color: INK,
        border: `1px solid ${INK}`,
        backgroundImage: `repeating-linear-gradient(to right, ${GRID}55 0 1px, transparent 1px 22px), repeating-linear-gradient(to bottom, ${GRID}55 0 1px, transparent 1px 22px)`,
      }}
    >
      <div
        className="flex items-baseline justify-between pb-2 font-mono uppercase"
        style={{ borderBottom: `1px solid ${INK}`, fontSize: '0.625rem', letterSpacing: '0.12em' }}
      >
        <span>LifeStreak</span>
        <span style={{ color: GRAPHITE }}>
          {new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
        </span>
      </div>

      <div>
        <div
          className="mb-4 flex h-11 w-11 items-center justify-center text-xl"
          style={{ border: `1px solid ${streak.color}`, backgroundColor: `${streak.color}1F` }}
        >
          {streak.icon}
        </div>

        <p className="font-display text-2xl uppercase leading-tight" style={{ letterSpacing: '0.05em' }}>
          {streak.title}
        </p>

        <div className="mt-2 flex items-baseline gap-2.5">
          <span className="font-display leading-none tabular-nums" style={{ fontSize: '5.5rem' }}>
            {streak.currentCount}
          </span>
          <span
            className="font-mono uppercase"
            style={{ color: GRAPHITE, fontSize: '0.6875rem', letterSpacing: '0.12em' }}
          >
            {pluralizeDays(streak.currentCount)}
            <br />
            подряд
          </span>
        </div>

        <RecordTape className="mt-5" count={streak.currentCount} doneToday={doneToday} large />
      </div>

      <p
        className="pt-3 text-center text-xs italic"
        style={{ borderTop: `1px solid ${PAPER_EDGE}`, color: GRAPHITE }}
      >
        «Стань человеком, которым всегда хотел быть»
      </p>
    </div>
  );
});
ShareCard.displayName = 'ShareCard';

function pluralizeDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'дней';
  if (mod10 === 1) return 'день';
  if (mod10 >= 2 && mod10 <= 4) return 'дня';
  return 'дней';
}

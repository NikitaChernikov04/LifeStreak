import { HeartsDisplay } from '@/components/hearts/HeartsDisplay';
import type { User } from '@/types/api';

const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

function greetingForHour(hour: number): string {
  if (hour < 5) return 'Доброй ночи';
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

/** Days since the user started keeping the journal — the sheet number. */
function sheetNumber(createdAt: string): number {
  const start = new Date(createdAt);
  const days = Math.floor((Date.now() - start.getTime()) / 86_400_000);
  return Math.max(1, days + 1);
}

export function TopBar({ user }: { user: User }) {
  const now = new Date();
  const greeting = greetingForHour(now.getHours());

  return (
    <header className="relative">
      <div className="flex items-center justify-between gap-3 font-mono text-micro uppercase text-graphite">
        <span>
          Лист {sheetNumber(user.createdAt)} · {now.getDate()} {MONTHS[now.getMonth()]}
        </span>
        <HeartsDisplay hearts={user.hearts} maxHearts={user.maxHearts} />
      </div>

      {/* Level and XP live on the profile sheet; the greeting gets the full
          measure here so long names never collide with a figure. */}
      <h1 className="mt-1.5 border-b border-ink pb-2 font-display text-[clamp(1.25rem,6.5vw,1.625rem)] uppercase leading-tight tracking-[0.04em]">
        {greeting}, {user.firstName}
      </h1>
    </header>
  );
}

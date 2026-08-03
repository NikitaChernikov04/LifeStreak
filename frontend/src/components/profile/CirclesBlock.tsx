import { FieldHeading } from '@/components/layout/Sheet';
import { useCircles, useLeaveCircle } from '@/hooks/useCircles';
import { openTelegramLink } from '@/lib/telegram';

/**
 * The circle that already exists.
 *
 * Everything here is a view onto Telegram, not a thing the app owns: joining
 * happens in the chat, because posting there is the only proof of belonging to
 * it. What the app adds is the way in — and the way out, which someone may
 * well want to take without announcing it to everyone.
 */
export function CirclesBlock({ className }: { className?: string }) {
  const { data } = useCircles();
  const leave = useLeaveCircle();

  if (!data) return null;

  return (
    <section className={className}>
      <FieldHeading>Круги в чатах</FieldHeading>

      <p className="mt-2 text-[0.8125rem] leading-snug text-graphite">
        Добавь бота в общий чат и напиши там <span className="font-mono">/join</span>. Каждый вечер
        туда будет уходить одна строка: кто отметился сегодня, а кто нет. Что именно вы отмечаете,
        бот не показывает — только счёт.
      </p>

      {data.circles.length > 0 && (
        <ul className="mt-3 border border-ink/25">
          {data.circles.map((circle, index) => (
            <li
              key={circle.id}
              className={`flex items-center gap-3 p-3 ${index > 0 ? 'border-t border-ink/15' : ''}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-base uppercase leading-tight tracking-[0.04em]">
                  {circle.title}
                </span>
                <span className="mt-0.5 block font-mono text-micro uppercase text-graphite">
                  {circle.memberCount}{' '}
                  {plural(circle.memberCount, 'участник', 'участника', 'участников')}
                </span>
              </span>
              <button
                type="button"
                onClick={() => leave.mutate(circle.id)}
                className="shrink-0 font-mono text-micro uppercase text-graphite underline underline-offset-2"
              >
                Выйти
              </button>
            </li>
          ))}
        </ul>
      )}

      {data.addToGroupLink && (
        <button
          type="button"
          onClick={() => openTelegramLink(data.addToGroupLink!)}
          className="mt-3 w-full border border-ink px-4 py-2.5 font-display text-base uppercase tracking-[0.04em]"
        >
          Добавить бота в чат
        </button>
      )}
    </section>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = n % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

import { FieldHeading } from '@/components/layout/Sheet';
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
} from '@/hooks/useNotificationSettings';
import { openTelegramLink } from '@/lib/telegram';
import { cn } from '@/lib/utils';

/**
 * What the bot is allowed to say out loud.
 *
 * The screen states the rule rather than listing every event: the bot writes
 * about what happened without you, and once in the evening. A list of
 * checkboxes would imply the app might otherwise write about everything, which
 * is the habit this policy exists to avoid.
 */
export function NotificationsBlock({ className }: { className?: string }) {
  const { data: settings } = useNotificationSettings();
  const update = useUpdateNotificationSettings();

  if (!settings) return null;

  return (
    <section className={className}>
      <FieldHeading>Сообщения от бота</FieldHeading>

      <div className="mt-3 border border-ink/25">
        <button
          type="button"
          onClick={() => update.mutate(!settings.dmEnabled)}
          className="flex w-full items-start gap-3 p-3 text-left"
        >
          <Box checked={settings.dmEnabled} />
          <span className="min-w-0 flex-1">
            <span className="block font-display text-base uppercase leading-tight tracking-[0.04em]">
              Писать в Telegram
            </span>
            <span className="mt-0.5 block text-[0.8125rem] leading-snug text-graphite">
              {settings.dmEnabled
                ? 'Заявки, приглашения в общие цели и одно напоминание вечером, если день не отмечен.'
                : 'Бот молчит. Всё то же самое остаётся внутри приложения.'}
            </span>
          </span>
        </button>
      </div>

      {/* Telegram will not deliver to a chat the user has never opened, and the
          app cannot fix that from its side — only say so plainly. */}
      {settings.dmEnabled && settings.botBlocked && (
        <div className="mt-2 border border-vermilion/50 p-3">
          <p className="font-mono text-micro uppercase text-vermilion">Бот не может написать</p>
          <p className="mt-1.5 text-[0.8125rem] leading-snug text-graphite">
            Ты не открывал чат с ботом или закрыл его. Нажми «Запустить» в чате — после этого
            сообщения начнут приходить.
          </p>
          {settings.botLink && (
            <button
              type="button"
              onClick={() => openTelegramLink(settings.botLink!)}
              className="mt-2 font-mono text-micro uppercase underline underline-offset-2"
            >
              Открыть чат с ботом
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/** A checkbox drawn the way a paper form prints one. */
function Box({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border text-xs leading-none',
        checked ? 'border-ink bg-ink text-paper' : 'border-ink/35',
      )}
    >
      {checked ? '✓' : ''}
    </span>
  );
}

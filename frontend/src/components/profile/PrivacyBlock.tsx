import { FieldHeading } from '@/components/layout/Sheet';
import { usePrivacySettings, useSetStreakSharing, useUpdatePrivacy } from '@/hooks/useSocial';
import { cn } from '@/lib/utils';

/**
 * Two levels of consent, in the order they apply: who may read the profile at
 * all, and which streaks they get to see once allowed in. Both default to the
 * closed position — a habit journal is nobody's business until its owner says
 * otherwise, so the screen has to state what is currently visible rather than
 * assume the user remembers.
 */
export function PrivacyBlock({ className }: { className?: string }) {
  const { data: settings } = usePrivacySettings();
  const updatePrivacy = useUpdatePrivacy();
  const setSharing = useSetStreakSharing();

  if (!settings) return null;

  const open = settings.profileVisibility === 'OPEN';
  const sharedCount = settings.streaks.filter((s) => s.isShared).length;

  return (
    <section className={className}>
      <FieldHeading>Кто тебя видит</FieldHeading>

      <div className="mt-3 border border-ink/25">
        <button
          type="button"
          onClick={() =>
            updatePrivacy.mutate({ profileVisibility: open ? 'PRIVATE' : 'OPEN' })
          }
          disabled={updatePrivacy.isPending}
          className="flex w-full items-start gap-3 border-b border-ink/15 p-3 text-left"
        >
          <Box checked={open} />
          <span className="min-w-0 flex-1">
            <span className="block font-display text-base uppercase leading-tight tracking-[0.04em]">
              Открытый профиль
            </span>
            <span className="mt-0.5 block text-[0.8125rem] leading-snug text-graphite">
              {open
                ? 'Подписаться можно без твоего подтверждения.'
                : 'Каждая заявка ждёт твоего подтверждения.'}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => updatePrivacy.mutate({ isDiscoverable: !settings.isDiscoverable })}
          disabled={updatePrivacy.isPending}
          className="flex w-full items-start gap-3 p-3 text-left"
        >
          <Box checked={settings.isDiscoverable} />
          <span className="min-w-0 flex-1">
            <span className="block font-display text-base uppercase leading-tight tracking-[0.04em]">
              Виден в поиске
            </span>
            <span className="mt-0.5 block text-[0.8125rem] leading-snug text-graphite">
              {settings.isDiscoverable
                ? 'Тебя можно найти по имени и юзернейму.'
                : 'Тебя найдут только по ссылке-приглашению.'}
            </span>
          </span>
        </button>
      </div>

      <FieldHeading className="mt-6" count={`${sharedCount} из ${settings.streaks.length}`}>
        Что видят подписчики
      </FieldHeading>

      {settings.streaks.length === 0 ? (
        <p className="py-3 text-sm leading-snug text-graphite">
          Серий пока нет. Появятся — сможешь выбрать, какие показывать.
        </p>
      ) : (
        <>
          <p className="mt-2 text-[0.8125rem] leading-snug text-graphite">
            Подтверждённая заявка открывает профиль, а не каждую привычку. Отмечай только те серии,
            которые готов показать.
          </p>
          <div className="mt-2 border border-ink/25">
            {settings.streaks.map((streak, index) => (
              <button
                key={streak.id}
                type="button"
                onClick={() =>
                  setSharing.mutate({ streakId: streak.id, isShared: !streak.isShared })
                }
                className={cn(
                  'flex w-full items-center gap-3 p-3 text-left',
                  index < settings.streaks.length - 1 && 'border-b border-ink/15',
                )}
              >
                <Box checked={streak.isShared} />
                <span aria-hidden className="text-base leading-none">{streak.icon}</span>
                <span className="min-w-0 flex-1 truncate font-display text-base uppercase leading-tight tracking-[0.04em]">
                  {streak.title}
                </span>
                <span className="figure shrink-0 text-micro uppercase text-graphite">
                  {streak.isShared ? 'видна' : 'скрыта'}
                </span>
              </button>
            ))}
          </div>
        </>
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

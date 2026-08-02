import { Link, useNavigate, useParams } from 'react-router-dom';
import { Sheet, SheetTitle, FieldHeading } from '@/components/layout/Sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FriendButton } from '@/components/social/PersonRow';
import { usePublicProfile } from '@/hooks/useSocial';
import { displayName, friendsLine, initials } from '@/lib/social';
import { pluralizeDays } from '@/lib/streak';

/**
 * Somebody else's page. What it shows is decided entirely by the server —
 * a closed profile returns no streaks at all, so there is nothing here that
 * could leak by rendering it.
 */
export function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { data: profile, isLoading, isError } = usePublicProfile(userId);

  if (isLoading) {
    return (
      <Sheet>
        <div className="paper-shimmer mt-6 h-24 w-full" />
      </Sheet>
    );
  }

  if (isError || !profile) {
    return (
      <Sheet>
        <SheetTitle>Профиль</SheetTitle>
        <p className="mt-6 text-sm text-graphite">Не удалось открыть профиль.</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 font-mono text-micro uppercase text-graphite underline underline-offset-4"
        >
          Назад
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet>
      <SheetTitle>Профиль</SheetTitle>

      <div className="mt-5 flex items-start gap-4">
        <Avatar className="h-16 w-16 shrink-0">
          {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} />}
          <AvatarFallback className="bg-indigo text-2xl text-paper">
            {initials(profile)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-2xl uppercase leading-none tracking-[0.04em]">
            {displayName(profile)}
          </p>
          <p className="mt-1.5 truncate font-mono text-micro uppercase text-graphite">
            {profile.username && <>@{profile.username} · </>}уровень {profile.level}
          </p>
          <p className="mt-1 font-mono text-micro uppercase text-graphite">
            {friendsLine(profile.friends)}
          </p>
        </div>
      </div>

      {profile.friendState !== 'SELF' && (
        <div className="mt-4">
          <FriendButton person={profile} />
        </div>
      )}

      {!profile.canView ? (
        <div className="mt-8 border border-dashed border-ink/40 bg-paper-edge/60 p-6 text-center">
          <p className="font-display text-lg uppercase tracking-[0.05em]">Записи скрыты</p>
          <p className="mt-2 text-sm leading-snug text-graphite">
            {profile.friendState === 'OUTGOING'
              ? 'Заявка отправлена. Записи откроются, когда её примут.'
              : profile.friendState === 'INCOMING'
                ? 'Этот человек уже позвал тебя в друзья — прими заявку.'
                : 'Записи видны только друзьям.'}
          </p>
        </div>
      ) : (
        <>
          {profile.statistics && (
            <>
              <FieldHeading className="mt-8">Сводка</FieldHeading>
              <dl className="mt-2 grid grid-cols-2 gap-px border border-ink/15 bg-ink/15">
                <Cell label="Всего отметок" value={profile.statistics.totalCheckins} />
                <Cell label="Лучшая серия" value={profile.statistics.longestStreakEver} />
                <Cell label="Активных серий" value={profile.statistics.activeStreaksCount} />
                <Cell label="Опыт" value={profile.statistics.totalXp} />
              </dl>
            </>
          )}

          <FieldHeading className="mt-8">
            {profile.friendState === 'SELF' ? 'Твои серии' : 'Открытые серии'}
          </FieldHeading>
          {profile.streaks.length === 0 ? (
            <p className="py-3 text-sm leading-snug text-graphite">
              Пока не открыто ни одной серии — это решает их владелец.
            </p>
          ) : (
            <div className="mt-1">
              {profile.streaks.map((streak) => (
                <div key={streak.id} className="flex items-center gap-3 border-b border-ink/15 py-3">
                  <span
                    aria-hidden
                    className="flex h-10 w-10 shrink-0 items-center justify-center border text-lg"
                    style={{ borderColor: streak.color, backgroundColor: `${streak.color}1F` }}
                  >
                    {streak.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-base uppercase leading-tight tracking-[0.04em]">
                      {streak.title}
                    </p>
                    <p className="font-mono text-micro uppercase text-graphite">
                      лучшая — <span className="figure">{streak.longestCount}</span>
                      {streak.importedCount > 0 && ` · перенесено ${streak.importedCount}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="font-display text-2xl leading-none tabular-nums">
                      {streak.currentCount}
                    </span>
                    <span className="ml-1 font-mono text-micro uppercase text-graphite">
                      {pluralizeDays(streak.currentCount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Link
        to="/friends"
        className="mt-8 inline-block font-mono text-micro uppercase text-graphite underline underline-offset-4"
      >
        ← К друзьям
      </Link>
    </Sheet>
  );
}

function Cell({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-paper px-3 py-2.5">
      <dt className="field-label">{label}</dt>
      <dd className="figure mt-0.5 text-xl">{value}</dd>
    </div>
  );
}

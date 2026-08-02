import { useState } from 'react';
import { Sheet, SheetTitle, FieldHeading } from '@/components/layout/Sheet';
import { Button } from '@/components/ui/button';
import { FeedEntry } from '@/components/social/FeedEntry';
import { PersonRow } from '@/components/social/PersonRow';
import {
  useFeed,
  useFollowRequests,
  useFollowers,
  useFollowing,
  useRespondToRequest,
  useUserSearch,
} from '@/hooks/useSocial';
import { displayName, initials } from '@/lib/social';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

type Tab = 'feed' | 'people';

export function FriendsPage() {
  const [tab, setTab] = useState<Tab>('feed');
  const { data: requests } = useFollowRequests();
  const pending = requests?.length ?? 0;

  return (
    <Sheet>
      <SheetTitle meta={pending > 0 ? `${pending} заявки` : undefined}>Друзья</SheetTitle>

      {/* Two segments of one ruled control — not pills. */}
      <div className="mt-4 flex border border-ink/30">
        {(
          [
            ['feed', 'Лента'],
            ['people', 'Люди'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              'relative flex-1 py-2.5 font-display text-sm uppercase tracking-[0.12em] transition-colors',
              tab === value ? 'bg-ink text-paper' : 'text-graphite hover:text-ink',
            )}
          >
            {label}
            {value === 'people' && pending > 0 && (
              <span
                className={cn(
                  'ml-1.5 figure text-micro',
                  tab === value ? 'text-paper/80' : 'text-vermilion',
                )}
              >
                {pending}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'feed' ? <FeedTab onFindPeople={() => setTab('people')} /> : <PeopleTab />}
    </Sheet>
  );
}

function FeedTab({ onFindPeople }: { onFindPeople: () => void }) {
  const { data, isLoading } = useFeed();

  if (isLoading) {
    return (
      <div className="mt-6 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="paper-shimmer h-20 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="mt-8 border border-dashed border-ink/40 bg-paper-edge/60 p-6 text-center">
        <p className="font-display text-lg uppercase tracking-[0.05em]">Здесь пока пусто</p>
        <p className="mt-2 text-sm leading-snug text-graphite">
          Лента показывает отметки тех, на кого ты подписан, — и только по тем сериям, которые они
          сами открыли.
        </p>
        <Button className="mt-4" size="sm" onClick={onFindPeople}>
          Найти людей
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      {data.items.map((entry) => (
        <FeedEntry key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

function PeopleTab() {
  const [query, setQuery] = useState('');
  const { data: results, isFetching } = useUserSearch(query);
  const { data: requests } = useFollowRequests();
  const { data: following } = useFollowing();
  const { data: followers } = useFollowers();
  const respond = useRespondToRequest();

  const searching = query.trim().length >= 2;

  return (
    <div className="mt-6">
      {requests && requests.length > 0 && (
        <section className="mb-8">
          <FieldHeading count={`${requests.length}`}>Заявки</FieldHeading>
          {requests.map((request) => (
            <div key={request.id} className="flex items-center gap-3 border-b border-ink/15 py-3">
              <Avatar className="h-10 w-10 shrink-0">
                {request.user.avatarUrl && <AvatarImage src={request.user.avatarUrl} />}
                <AvatarFallback className="bg-indigo text-sm text-paper">
                  {initials(request.user)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-base uppercase leading-tight tracking-[0.04em]">
                  {displayName(request.user)}
                </p>
                <p className="truncate font-mono text-micro uppercase text-graphite">
                  {request.user.username ? `@${request.user.username} · ` : ''}хочет читать тебя
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button
                  size="sm"
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ id: request.id, accept: true })}
                >
                  Принять
                </Button>
                <Button
                  size="sm"
                  variant="quiet"
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ id: request.id, accept: false })}
                >
                  Нет
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section>
        <FieldHeading>Найти человека</FieldHeading>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Имя или @юзернейм"
          maxLength={32}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="field-input mt-2"
        />

        {searching && (
          <div className="mt-2">
            {results && results.length > 0 ? (
              results.map((person) => <PersonRow key={person.id} person={person} />)
            ) : (
              <p className="py-3 font-mono text-micro uppercase text-graphite">
                {isFetching ? 'Ищу…' : 'Никого не нашлось'}
              </p>
            )}
          </div>
        )}
      </section>

      <PeopleList title="Ты читаешь" people={following ?? []} className="mt-8" />
      <PeopleList title="Читают тебя" people={followers ?? []} className="mt-8" />
    </div>
  );
}

function PeopleList({
  title,
  people,
  className,
}: {
  title: string;
  people: Parameters<typeof PersonRow>[0]['person'][];
  className?: string;
}) {
  return (
    <section className={className}>
      <FieldHeading count={people.length > 0 ? `${people.length}` : undefined}>{title}</FieldHeading>
      {people.length === 0 ? (
        <p className="py-3 font-mono text-micro uppercase text-graphite">Пока никого</p>
      ) : (
        people.map((person) => <PersonRow key={person.id} person={person} />)
      )}
    </section>
  );
}

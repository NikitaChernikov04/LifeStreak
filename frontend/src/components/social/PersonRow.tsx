import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useFollow, useUnfollow } from '@/hooks/useSocial';
import { displayName, initials } from '@/lib/social';
import type { PersonCard } from '@/types/api';

/**
 * A person in a list. The button states the next action, not the current
 * relationship: "Подписаться" / "Ждёт" / "Отписаться" — a pending request is
 * shown as waiting rather than as something to press again.
 */
export function PersonRow({ person, action }: { person: PersonCard; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-ink/15 py-3">
      <Link to={`/u/${person.id}`} className="shrink-0">
        <Avatar className="h-10 w-10">
          {person.avatarUrl && <AvatarImage src={person.avatarUrl} />}
          <AvatarFallback className="bg-indigo text-sm text-paper">
            {initials(person)}
          </AvatarFallback>
        </Avatar>
      </Link>

      <Link to={`/u/${person.id}`} className="min-w-0 flex-1">
        <p className="truncate font-display text-base uppercase leading-tight tracking-[0.04em]">
          {displayName(person)}
        </p>
        <p className="truncate font-mono text-micro uppercase text-graphite">
          {person.username ? `@${person.username} · ` : ''}ур. {person.level}
          {person.followsMe && ' · читает тебя'}
        </p>
      </Link>

      <div className="shrink-0">{action ?? <FollowButton person={person} />}</div>
    </div>
  );
}

export function FollowButton({ person }: { person: PersonCard }) {
  const follow = useFollow();
  const unfollow = useUnfollow();
  const busy = follow.isPending || unfollow.isPending;

  if (person.followState === 'SELF') {
    return <span className="chip">Это ты</span>;
  }

  if (person.followState === 'PENDING') {
    return (
      <Button size="sm" variant="quiet" disabled={busy} onClick={() => unfollow.mutate(person.id)}>
        Ждёт · отменить
      </Button>
    );
  }

  if (person.followState === 'ACCEPTED') {
    return (
      <Button size="sm" variant="outline" disabled={busy} onClick={() => unfollow.mutate(person.id)}>
        Отписаться
      </Button>
    );
  }

  return (
    <Button size="sm" disabled={busy} onClick={() => follow.mutate(person.id)}>
      Подписаться
    </Button>
  );
}

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAddFriend, useRemoveFriend } from '@/hooks/useSocial';
import { displayName, initials } from '@/lib/social';
import type { PersonCard } from '@/types/api';

export function PersonRow({ person, action }: { person: PersonCard; action?: ReactNode }) {
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
        </p>
      </Link>

      <div className="shrink-0">{action ?? <FriendButton person={person} />}</div>
    </div>
  );
}

/**
 * The button says what happens next, not what the relationship currently is.
 * An incoming request is the one case with two answers, so it is the one case
 * that shows two buttons — deciding it anywhere else would hide the choice.
 */
export function FriendButton({ person }: { person: PersonCard }) {
  const add = useAddFriend();
  const remove = useRemoveFriend();
  const busy = add.isPending || remove.isPending;

  if (person.friendState === 'SELF') {
    return <span className="chip">Это ты</span>;
  }

  if (person.friendState === 'FRIENDS') {
    return (
      <Button size="sm" variant="outline" disabled={busy} onClick={() => remove.mutate(person.id)}>
        В друзьях
      </Button>
    );
  }

  if (person.friendState === 'OUTGOING') {
    return (
      <Button size="sm" variant="quiet" disabled={busy} onClick={() => remove.mutate(person.id)}>
        Ждёт · отменить
      </Button>
    );
  }

  if (person.friendState === 'INCOMING') {
    return (
      <div className="flex gap-1.5">
        <Button size="sm" disabled={busy} onClick={() => add.mutate(person.id)}>
          Принять
        </Button>
        <Button size="sm" variant="quiet" disabled={busy} onClick={() => remove.mutate(person.id)}>
          Нет
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" disabled={busy} onClick={() => add.mutate(person.id)}>
      Добавить
    </Button>
  );
}

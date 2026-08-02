import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLeaderboard } from '@/hooks/useSocial';
import { displayName, initials } from '@/lib/social';
import { pluralizeDays } from '@/lib/streak';
import { cn } from '@/lib/utils';

/**
 * Ranked by the longest streak each friend is currently holding. The figure
 * counts every streak, including the ones kept private — it says how long,
 * never what, and titles stay behind their own flag.
 */
export function Leaderboard() {
  const { data: rows, isLoading } = useLeaderboard();

  if (isLoading) {
    return (
      <div className="mt-6 space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="paper-shimmer h-14 w-full" />
        ))}
      </div>
    );
  }

  if (!rows || rows.length === 0) return null;

  const alone = rows.length === 1;

  return (
    <div className="mt-6">
      {alone && (
        <p className="mb-4 border border-dashed border-ink/40 bg-paper-edge/60 p-4 text-center text-sm leading-snug text-graphite">
          Пока в таблице только ты. Добавь друзей — считаться будет с ними.
        </p>
      )}

      <ol>
        {rows.map((row) => (
          <li
            key={row.id}
            className={cn(
              'flex items-center gap-3 border-b border-ink/15 py-3',
              row.isMe && 'bg-ink/[0.04]',
            )}
          >
            {/* The rank is the loudest thing in the row — it is the point. */}
            <span
              className={cn(
                'figure w-7 shrink-0 text-center text-lg leading-none',
                row.rank === 1 ? 'text-ochre' : 'text-graphite',
              )}
            >
              {row.rank}
            </span>

            <Link to={row.isMe ? '/profile' : `/u/${row.id}`} className="shrink-0">
              <Avatar className="h-9 w-9">
                {row.avatarUrl && <AvatarImage src={row.avatarUrl} />}
                <AvatarFallback className="bg-indigo text-xs text-paper">
                  {initials(row)}
                </AvatarFallback>
              </Avatar>
            </Link>

            <Link to={row.isMe ? '/profile' : `/u/${row.id}`} className="min-w-0 flex-1">
              <p className="truncate font-display text-base uppercase leading-tight tracking-[0.04em]">
                {displayName(row)}
                {row.isMe && <span className="ml-1.5 font-mono text-micro text-graphite">ты</span>}
              </p>
              <p className="truncate font-mono text-micro uppercase text-graphite">
                ур. {row.level} · отметок {row.totalCheckins}
              </p>
            </Link>

            <div className="shrink-0 text-right">
              <span className="font-display text-2xl leading-none tabular-nums">
                {row.bestStreak}
              </span>
              <span className="ml-1 font-mono text-micro uppercase text-graphite">
                {pluralizeDays(row.bestStreak)}
              </span>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-3 font-mono text-micro uppercase leading-relaxed text-graphite">
        Считается самая длинная серия, которую ты ведёшь прямо сейчас. Название серии никому не
        видно — только число.
      </p>
    </div>
  );
}

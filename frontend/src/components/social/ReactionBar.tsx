import { cn } from '@/lib/utils';
import { REACTIONS } from '@/lib/social';
import { useReact } from '@/hooks/useSocial';
import type { ReactionKey, ReactionSummary } from '@/types/api';

/**
 * All five marks are always on the page rather than hidden behind a picker.
 * Support is worth nothing if it takes two taps to give, and at this scale a
 * row of five stamps costs less room than the button that would open them.
 */
export function ReactionBar({
  checkinId,
  summary,
  className,
}: {
  checkinId: string;
  summary: ReactionSummary;
  className?: string;
}) {
  const react = useReact();
  const counts = new Map(summary.reactions.map((r) => [r.key, r.count]));

  function toggle(key: ReactionKey) {
    react.mutate({ checkinId, key: summary.myReaction === key ? null : key });
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {REACTIONS.map(({ key, glyph, label }) => {
        const count = counts.get(key) ?? 0;
        const mine = summary.myReaction === key;

        return (
          <button
            key={key}
            type="button"
            aria-label={label}
            aria-pressed={mine}
            disabled={react.isPending}
            onClick={() => toggle(key)}
            className={cn(
              'flex h-8 min-w-8 items-center justify-center gap-1 border px-1.5 text-sm leading-none transition-colors disabled:opacity-50',
              mine ? 'border-ink bg-ink/[0.07]' : 'border-ink/20 hover:border-ink/45',
              count === 0 && !mine && 'opacity-55',
            )}
          >
            <span aria-hidden>{glyph}</span>
            {count > 0 && <span className="figure text-micro text-graphite">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

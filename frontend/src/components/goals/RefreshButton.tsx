import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { hapticImpact } from '@/lib/telegram';
import { cn } from '@/lib/utils';

/** Long enough for the turn to register as a turn rather than a flicker. */
const MIN_SPIN_MS = 450;

/**
 * Pulls the goals again on demand.
 *
 * The card is the one place in the app where something changes because
 * *somebody else* did it — a day marked, a proof attached, a sprint settled —
 * and until now the only way to find out was to close the app and open it
 * again. React Query refetches on focus, which a Telegram mini app never
 * really loses.
 */
export function RefreshButton({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const [spinning, setSpinning] = useState(false);

  async function refresh() {
    if (spinning) return;
    setSpinning(true);
    hapticImpact('light');
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['social', 'goals'] }),
        new Promise((resolve) => setTimeout(resolve, MIN_SPIN_MS)),
      ]);
    } finally {
      setSpinning(false);
    }
  }

  return (
    <button
      onClick={refresh}
      disabled={spinning}
      aria-label="Обновить"
      title="Обновить"
      className={cn(
        'shrink-0 p-0.5 text-graphite transition-colors hover:text-ink disabled:text-ink',
        className,
      )}
    >
      {/* Drawn rather than imported: a hairline stroke sits with the ruled
          dividers, where a filled glyph would read as a different alphabet. */}
      <svg
        viewBox="0 0 16 16"
        width="15"
        height="15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="square"
        aria-hidden
        className={cn('block', spinning && 'animate-spin')}
      >
        <path d="M13.5 8a5.5 5.5 0 1 1-1.9-4.16" />
        <path d="M13.2 1.6v2.9h-2.9" />
      </svg>
    </button>
  );
}

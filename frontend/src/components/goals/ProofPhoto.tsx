import { useState } from 'react';
import { useProofImage } from '@/hooks/useProofImage';
import { ProofViewer } from '@/components/goals/ProofViewer';
import { cn } from '@/lib/utils';

/**
 * One proof photo wherever it appears: the thumbnail, the way into the full
 * screen view, and what to show while the bytes are still coming.
 *
 * The failure state is a button rather than a sentence. These bytes travel
 * from private storage through our own route, and that hop does fail on a bad
 * connection — leaving somebody looking at the words "не открылось" with
 * nothing to do about it is the wrong end of a passing problem.
 */
export function ProofPhoto({
  goalId,
  checkinId,
  caption,
  author,
  enabled = true,
  className,
}: {
  goalId: string;
  checkinId: string;
  caption: string;
  author: string;
  enabled?: boolean;
  className?: string;
}) {
  const { url, isPending, isError, isFetching, retry } = useProofImage(goalId, checkinId, enabled);
  const [viewing, setViewing] = useState(false);

  if (url) {
    return (
      <>
        {/* A card-sized thumbnail cannot show a commit hash or a receipt, so
            the small one is only ever the way into the big one. */}
        <button
          onClick={() => setViewing(true)}
          aria-label={`Открыть пруф крупнее — ${caption}`}
          className="block w-full cursor-zoom-in"
        >
          <img
            src={url}
            alt={`Пруф — ${author}`}
            className={cn('w-full border border-ink/20 object-contain', className ?? 'max-h-56')}
          />
        </button>
        <ProofViewer src={url} caption={caption} open={viewing} onOpenChange={setViewing} />
      </>
    );
  }

  if (isError) {
    return (
      <button
        onClick={() => retry()}
        disabled={isFetching}
        className="flex h-14 w-full items-center justify-center border border-dashed border-vermilion/50 font-mono text-micro uppercase text-vermilion transition-colors hover:border-vermilion disabled:opacity-60"
      >
        {isFetching ? 'пробую снова…' : 'фото не открылось · повторить'}
      </button>
    );
  }

  return (
    <div className="flex h-14 items-center justify-center border border-dashed border-ink/25 font-mono text-micro uppercase text-graphite">
      {isPending || isFetching ? 'загружаю фото…' : 'фото'}
    </div>
  );
}

import { motion } from 'framer-motion';
import { useTodayChallenge, useCompleteChallenge } from '@/hooks/useChallenges';
import { Button } from '@/components/ui/button';
import { InkHeart } from '@/components/hearts/HeartsDisplay';

/**
 * The daily challenge is a slip pasted into the journal — the one dashed-edge
 * element on the page, so it reads as inserted rather than written. Its reward
 * is set in ochre, the colour of everything the user earns.
 */
export function DailyChallengeCard() {
  const { data: challenge, isLoading } = useTodayChallenge();
  const complete = useCompleteChallenge();

  if (isLoading || !challenge) {
    return <div className="h-32 paper-shimmer" />;
  }

  const isDone = challenge.status === 'COMPLETED';
  const paysHeart = challenge.template.rewardType === 'HEART';

  return (
    <motion.section layout className="border border-dashed border-ink/45 bg-paper-edge/60 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="field-label text-ink">Задание дня</span>
        <span className="flex shrink-0 items-center gap-1 font-mono text-micro uppercase text-ochre">
          {paysHeart ? (
            <>
              <InkHeart filled className="h-3 w-3" /> сердце
            </>
          ) : (
            `+${challenge.template.xpReward} XP`
          )}
        </span>
      </div>

      <div className="mt-3 flex items-start gap-3">
        <span className="text-xl leading-none">{challenge.template.icon}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg uppercase leading-tight tracking-[0.04em]">
            {challenge.template.title}
          </h3>
          <p className="mt-0.5 text-[0.8125rem] leading-snug text-graphite">
            {challenge.template.description}
          </p>
        </div>
      </div>

      <div className="mt-4">
        {isDone ? (
          <p className="flex h-11 items-center justify-center border border-dashed border-ochre/50 font-display text-[0.9375rem] uppercase tracking-[0.14em] text-ochre">
            Выполнено
          </p>
        ) : (
          <Button
            className="w-full"
            variant="reward"
            disabled={complete.isPending}
            onClick={() => complete.mutate(challenge.id)}
          >
            Выполнить
          </Button>
        )}
      </div>
    </motion.section>
  );
}

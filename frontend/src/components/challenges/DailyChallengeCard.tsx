import { motion } from 'framer-motion';
import { useTodayChallenge, useCompleteChallenge } from '@/hooks/useChallenges';
import { Button } from '@/components/ui/button';
import { InkHeart } from '@/components/hearts/HeartsDisplay';

/**
 * The daily challenge is a slip pasted into the journal — the one boxed element
 * on the page, set on a slightly different paper stock so it reads as inserted
 * rather than written. Its legend is cut into the rule, like a form fieldset.
 */
export function DailyChallengeCard() {
  const { data: challenge, isLoading } = useTodayChallenge();
  const complete = useCompleteChallenge();

  if (isLoading || !challenge) {
    return <div className="h-28 paper-shimmer" />;
  }

  const isDone = challenge.status === 'COMPLETED';
  const paysHeart = challenge.template.rewardType === 'HEART';

  return (
    <motion.section layout className="relative border border-ink/30 bg-paper-edge px-4 pb-4 pt-5">
      <span className="absolute -top-[7px] left-3 bg-paper-edge px-1.5 font-mono text-micro font-medium uppercase text-ink">
        Задание дня
      </span>
      <span className="absolute -top-[7px] right-3 flex items-center gap-1 bg-paper-edge px-1.5 font-mono text-micro uppercase text-graphite">
        {paysHeart ? (
          <>
            <InkHeart filled className="h-3 w-3 text-ochre" /> сердце
          </>
        ) : (
          `+${challenge.template.xpReward} XP`
        )}
      </span>

      <div className="flex items-start gap-3">
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

      <div className="mt-3.5">
        {isDone ? (
          <p className="flex h-11 items-center justify-center border border-dashed border-ink/30 font-display text-[0.9375rem] uppercase tracking-[0.14em] text-graphite">
            Выполнено
          </p>
        ) : (
          <Button
            className="w-full"
            variant="outline"
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

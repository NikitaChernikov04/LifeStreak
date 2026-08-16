import { AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Sheet, FieldHeading } from '@/components/layout/Sheet';
import { TopBar } from '@/components/layout/TopBar';
import { DailyChallengeCard } from '@/components/challenges/DailyChallengeCard';
import { StreakCard } from '@/components/streaks/StreakCard';
import { CreateStreakDialog } from '@/components/streaks/CreateStreakDialog';
import { GoalCard } from '@/components/goals/GoalCard';
import { VersusCard } from '@/components/goals/VersusCard';
import { CreateGoalDialog } from '@/components/goals/CreateGoalDialog';
import { ShareCardModal } from '@/components/share/ShareCardModal';
import { useStreaks } from '@/hooks/useStreaks';
import { useGoals } from '@/hooks/useSocial';
import { useAuthStore } from '@/store/useAuthStore';
import type { Streak } from '@/types/api';

export function HomePage() {
  const user = useAuthStore((s) => s.user);
  const { data: streaks, isLoading } = useStreaks();
  const { data: goals } = useGoals();
  const [shareStreak, setShareStreak] = useState<Streak | null>(null);

  // Goals people hold together are marked on the same screen as personal
  // ones — the day is recorded in one sitting, not in two places.
  const openGoals = goals?.filter((goal) => goal.status !== 'ABANDONED') ?? [];
  // Held-together and competed-over are different promises and get their own
  // headings. Mixing them would put two different meanings of "N из M" under
  // one title.
  const heldGoals = openGoals.filter((goal) => goal.mode !== 'VERSUS');
  const bets = openGoals.filter((goal) => goal.mode === 'VERSUS');

  if (!user) return null;

  return (
    <Sheet>
      <TopBar user={user} />

      <div className="mt-6">
        <DailyChallengeCard />
      </div>

      {/* Section gaps are deliberately much larger than the gaps inside a
          section. When both were the same, a new section and the next entry
          announced themselves identically and the page read as one long list. */}
      <FieldHeading className="mt-10" count={streaks?.length ? `${streaks.length}` : undefined}>
        Серии
      </FieldHeading>

      <div className="mt-1">
        {isLoading && (
          <>
            <div className="mt-5 h-36 paper-shimmer" />
            <div className="mt-5 h-36 paper-shimmer" />
          </>
        )}

        <AnimatePresence initial={false}>
          {streaks?.map((streak) => (
            <StreakCard key={streak.id} streak={streak} onShare={setShareStreak} />
          ))}
        </AnimatePresence>

        {!isLoading && streaks?.length === 0 && (
          <p className="border-b border-ink/15 py-8 text-[0.9375rem] leading-relaxed text-graphite">
            Лист пока пустой. Заведи первую серию — и завтра тебе будет что не терять.
          </p>
        )}
      </div>

      <div className="mt-6">
        <CreateStreakDialog />
      </div>

      <FieldHeading className="mt-10" count={heldGoals.length > 0 ? `${heldGoals.length}` : undefined}>
        Общие цели
      </FieldHeading>

      <div className="mt-1">
        {heldGoals.map((goal) => (
          <GoalCard key={goal.id} goal={goal} />
        ))}

        {heldGoals.length === 0 && (
          <p className="border-b border-ink/15 py-6 text-[0.9375rem] leading-relaxed text-graphite">
            Цель, которую держат вдвоём, рвётся втрое реже. День засчитывается, только когда
            отметились все.
          </p>
        )}
      </div>

      {bets.length > 0 && (
        <>
          <FieldHeading className="mt-10" count={`${bets.length}`}>
            Споры
          </FieldHeading>

          <div className="mt-1">
            {bets.map((goal) => (
              <VersusCard key={goal.id} goal={goal} />
            ))}
          </div>
        </>
      )}

      <div className="mt-6">
        <CreateGoalDialog />
      </div>

      <ShareCardModal streak={shareStreak} onOpenChange={(open) => !open && setShareStreak(null)} />
    </Sheet>
  );
}

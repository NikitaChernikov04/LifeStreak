import { AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Sheet, FieldHeading } from '@/components/layout/Sheet';
import { TopBar } from '@/components/layout/TopBar';
import { DailyChallengeCard } from '@/components/challenges/DailyChallengeCard';
import { StreakCard } from '@/components/streaks/StreakCard';
import { CreateStreakDialog } from '@/components/streaks/CreateStreakDialog';
import { FirstRun } from '@/components/streaks/FirstRun';
import { GoalCard } from '@/components/goals/GoalCard';
import { VersusCard } from '@/components/goals/VersusCard';
import { GoalArchive } from '@/components/goals/GoalArchive';
import { isGoalClosed } from '@/lib/goals';
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
  const visibleGoals = goals?.filter((goal) => goal.status !== 'ABANDONED') ?? [];
  // Anything finished is folded into the archive at the foot of the page: it
  // has no action left on it, and a full block each meant scrolling past dead
  // panels to reach a live one.
  const openGoals = visibleGoals.filter((goal) => !isGoalClosed(goal));
  const closedGoals = visibleGoals.filter(isGoalClosed);
  // Held-together and competed-over are different promises and get their own
  // headings. Mixing them would put two different meanings of "N из M" under
  // one title.
  const heldGoals = openGoals.filter((goal) => goal.mode !== 'VERSUS');
  const bets = openGoals.filter((goal) => goal.mode === 'VERSUS');

  if (!user) return null;

  // Nothing recorded yet: the whole sheet becomes one decision. Everything the
  // normal screen offers — the challenge, shared goals, bets — is worth
  // nothing to somebody who has not started, and measurably costs the start.
  // Waits for the list to actually arrive, so a slow network never flashes the
  // beginner's screen at somebody with forty-six days behind them.
  if (!isLoading && streaks?.length === 0) {
    return <FirstRun user={user} />;
  }

  return (
    <Sheet>
      <TopBar user={user} />

      {/* Section gaps are deliberately much larger than the gaps inside a
          section. When both were the same, a new section and the next entry
          announced themselves identically and the page read as one long list. */}
      <FieldHeading className="mt-8" count={streaks?.length ? `${streaks.length}` : undefined}>
        Серии
      </FieldHeading>

      <div className="mt-1">
        {isLoading && (
          <>
            <div className="mt-5 h-36 paper-shimmer" />
            <div className="mt-5 h-36 paper-shimmer" />
          </>
        )}

        {/* No empty state here: an empty list is handled before this renders,
            by the first-run screen. */}
        <AnimatePresence initial={false}>
          {streaks?.map((streak) => (
            <StreakCard key={streak.id} streak={streak} onShare={setShareStreak} />
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-6">
        <CreateStreakDialog />
      </div>

      {/* Below the record, not above it. The challenge is a slip pasted into
          the journal — a side quest that pays XP — and it used to open the
          page as the largest and only coloured thing on it. To somebody who
          had just created their first streak it sat above that streak and
          competed with the one press the whole product depends on. */}
      <div className="mt-10">
        <DailyChallengeCard />
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

      <GoalArchive goals={closedGoals} />

      <ShareCardModal streak={shareStreak} onOpenChange={(open) => !open && setShareStreak(null)} />
    </Sheet>
  );
}

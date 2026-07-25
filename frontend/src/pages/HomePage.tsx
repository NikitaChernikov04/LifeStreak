import { AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Sheet, FieldHeading } from '@/components/layout/Sheet';
import { TopBar } from '@/components/layout/TopBar';
import { DailyChallengeCard } from '@/components/challenges/DailyChallengeCard';
import { StreakCard } from '@/components/streaks/StreakCard';
import { CreateStreakDialog } from '@/components/streaks/CreateStreakDialog';
import { ShareCardModal } from '@/components/share/ShareCardModal';
import { useStreaks } from '@/hooks/useStreaks';
import { useAuthStore } from '@/store/useAuthStore';
import type { Streak } from '@/types/api';

export function HomePage() {
  const user = useAuthStore((s) => s.user);
  const { data: streaks, isLoading } = useStreaks();
  const [shareStreak, setShareStreak] = useState<Streak | null>(null);

  if (!user) return null;

  return (
    <Sheet>
      <TopBar user={user} />

      <div className="mt-6">
        <DailyChallengeCard />
      </div>

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

      <div className="mt-5">
        <CreateStreakDialog />
      </div>

      <ShareCardModal streak={shareStreak} onOpenChange={(open) => !open && setShareStreak(null)} />
    </Sheet>
  );
}

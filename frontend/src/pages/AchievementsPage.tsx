import { motion } from 'framer-motion';
import { Sheet, SheetTitle } from '@/components/layout/Sheet';
import { useAllAchievements, useMyAchievements } from '@/hooks/useAchievements';
import { cn } from '@/lib/utils';

/**
 * A register, not a trophy grid. Locked rows keep their blanks visible — an
 * unfilled date field is a better invitation than a padlock.
 */
export function AchievementsPage() {
  const { data: all, isLoading } = useAllAchievements();
  const { data: mine } = useMyAchievements();

  const unlockedByKey = new Map((mine ?? []).map((a) => [a.definition.key, a]));

  return (
    <Sheet>
      <SheetTitle meta={`${mine?.length ?? 0}/${all?.length ?? 0}`}>Достижения</SheetTitle>

      <div className="mt-1">
        {isLoading &&
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="mt-4 h-14 paper-shimmer" />)}

        {all?.map((achievement, i) => {
          const unlocked = unlockedByKey.get(achievement.key);
          return (
            <motion.div
              key={achievement.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.24) }}
              className="relative flex items-baseline gap-3 border-b border-ink/15 py-4"
            >
              {/* Margin: the award's own mark once earned, a blank rule until then. */}
              <span
                aria-hidden
                className={cn(
                  'absolute -left-12 top-4 flex h-6 w-10 items-center justify-center text-base',
                  !unlocked && 'text-graphite/40',
                )}
              >
                {unlocked ? achievement.icon : '—'}
              </span>

              <div className="min-w-0 flex-1">
                <h3
                  className={cn(
                    'font-display text-lg uppercase leading-tight tracking-[0.05em]',
                    !unlocked && 'text-graphite',
                  )}
                >
                  {achievement.title}
                </h3>
                <p className="mt-0.5 text-[0.8125rem] leading-snug text-graphite">
                  {achievement.description}
                </p>
              </div>

              <span
                className={cn(
                  'figure shrink-0 text-micro uppercase',
                  unlocked ? 'text-ochre' : 'text-graphite/50',
                )}
              >
                {unlocked
                  ? new Date(unlocked.unlockedAt).toLocaleDateString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit',
                    })
                  : '··.··.··'}
              </span>
            </motion.div>
          );
        })}
      </div>
    </Sheet>
  );
}

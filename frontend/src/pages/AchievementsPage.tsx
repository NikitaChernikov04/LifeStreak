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
              className="flex items-start gap-3 border-b border-ink/15 py-4"
            >
              {/* The award's own mark once earned, a ruled blank until then. */}
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border text-base',
                  unlocked ? 'border-ochre/60 bg-ochre/10' : 'border-ink/15 text-graphite/40',
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
                  'figure mt-1 shrink-0 text-micro uppercase',
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

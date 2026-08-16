import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { goalOutcome } from '@/lib/goals';
import { cn } from '@/lib/utils';
import type { GroupGoal } from '@/types/api';

/**
 * Finished goals and bets, folded away.
 *
 * Labelled "Закрытые" rather than "Архив" because a streak entry already
 * carries a control called "В архив", and the two mean different things: one
 * puts a streak away, the other holds goals that ended. One word for two
 * actions on one screen is a promise the app does not keep — an archived
 * streak never appears here.
 *
 * A closed goal kept its full block — icon, progress bar, member chips,
 * footer — long after there was anything left to do with it, so a person who
 * had held three goals scrolled past three dead panels to reach the live one.
 *
 * Folded, and unfolded into single lines rather than the same blocks: a
 * finished goal owes exactly one thing, which is how it ended. Buttons on it
 * would be buttons for a decision nobody can still make.
 */
export function GoalArchive({ goals }: { goals: GroupGoal[] }) {
  const [open, setOpen] = useState(false);
  if (goals.length === 0) return null;

  return (
    <section className="mt-10">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3"
      >
        <span className="field-label shrink-0 text-ink-soft">Закрытые</span>
        <span aria-hidden className="h-px flex-1 bg-ink/20" />
        <span className="figure shrink-0 text-label text-graphite">{goals.length}</span>
        <span
          aria-hidden
          className={cn('shrink-0 text-graphite transition-transform', open && 'rotate-180')}
        >
          ▾
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            {goals.map((goal) => (
              <li
                key={goal.id}
                className="flex items-center gap-3 border-b border-ink/10 py-3 last:border-b-0"
              >
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center border text-sm opacity-60"
                  style={{ borderColor: goal.color, backgroundColor: `${goal.color}14` }}
                >
                  {goal.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[0.9375rem] uppercase leading-tight tracking-[0.04em] text-ink-soft">
                    {goal.title}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-micro uppercase text-graphite">
                    {goalOutcome(goal)}
                  </span>
                </span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </section>
  );
}

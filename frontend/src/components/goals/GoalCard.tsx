import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useCheckinGoal, useJoinGoal, useLeaveGoal, useRescueGoal } from '@/hooks/useSocial';
import { pluralizeDays } from '@/lib/streak';
import { cn } from '@/lib/utils';
import type { GroupGoal } from '@/types/api';

/**
 * A goal several people hold at once. The card's job is to answer one question
 * before any other: is today done, and if not, by whom. Everything else — the
 * count, the target, the rescue — is subordinate to that.
 */
export function GoalCard({ goal }: { goal: GroupGoal }) {
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const checkin = useCheckinGoal();
  const rescue = useRescueGoal();
  const join = useJoinGoal();
  const leave = useLeaveGoal();

  const invited = goal.myStatus === 'INVITED';
  const done = goal.status === 'COMPLETED';
  const progress = Math.min(100, (goal.currentCount / goal.targetDays) * 100);
  const waiting = goal.waitingOn.filter((m) => !m.isMe);

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex gap-3 border-b border-ink/15 py-4"
    >
      <div
        className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center border text-lg"
        style={{ borderColor: goal.color, backgroundColor: `${goal.color}1F` }}
      >
        {goal.icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg uppercase leading-tight tracking-[0.05em]">
              {goal.title}
            </h3>
            <p className="mt-0.5 font-mono text-micro uppercase text-graphite">
              вместе · <span className="figure">{goal.currentCount}</span> из {goal.targetDays}{' '}
              {pluralizeDays(goal.targetDays)}
            </p>
          </div>

          {done ? (
            <span className="chip mt-0.5 shrink-0 border-ochre text-ochre">✓ Взята</span>
          ) : invited ? (
            <Button
              size="sm"
              className="mt-0.5 shrink-0"
              disabled={join.isPending}
              onClick={() => join.mutate(goal.id)}
            >
              Вступить
            </Button>
          ) : goal.markedToday ? (
            <span className="chip mt-0.5 shrink-0">✓ Записано</span>
          ) : (
            <Button
              size="sm"
              className="mt-0.5 shrink-0"
              disabled={checkin.isPending}
              onClick={() => checkin.mutate(goal)}
            >
              Записать
            </Button>
          )}
        </div>

        {/* Progress towards the finish line, drawn as a measured scale. */}
        <div className="mt-3 h-2 w-full border border-ink/25">
          <div
            className="h-full"
            style={{ width: `${progress}%`, backgroundColor: done ? undefined : goal.color }}
          />
        </div>

        {/* Who is still holding the day open. This is the social pressure the
            whole feature exists for, so it is stated plainly. */}
        {!done && !invited && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {/* Name plus a drawn state, no avatar: at chip size a photo is a
                smudge, and the border already says whether the day is closed. */}
            {goal.members.map((member) => (
              <span
                key={member.id}
                className={cn(
                  'flex max-w-[9rem] items-center gap-1 border px-2 py-1 font-mono text-micro uppercase',
                  member.markedToday
                    ? 'border-ink/30 text-ink'
                    : 'border-dashed border-vermilion/60 text-vermilion',
                )}
              >
                <span aria-hidden>{member.markedToday ? '✓' : '·'}</span>
                <span className="truncate">{member.isMe ? 'ты' : member.firstName}</span>
              </span>
            ))}
          </div>
        )}

        {invited && goal.invited.length >= 0 && (
          <p className="mt-2 text-[0.8125rem] leading-snug text-graphite">
            Тебя позвали держать эту цель. День засчитывается группе, только когда отметились все.
          </p>
        )}

        {goal.atRisk && (
          <p className="mt-2 font-mono text-micro uppercase leading-relaxed text-vermilion">
            Вчера закрыли не все — ещё день, и счёт обнулится
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center justify-end gap-3 font-mono text-micro uppercase">
          {goal.canRescue && (
            <button
              onClick={() => rescue.mutate(goal.id)}
              disabled={rescue.isPending}
              className="text-vermilion underline underline-offset-2 disabled:opacity-50"
            >
              Спасти вчера · 1 сердце
            </button>
          )}

          {!done && (
            <button
              onClick={() => (confirmingLeave ? leave.mutate(goal.id) : setConfirmingLeave(true))}
              onBlur={() => setConfirmingLeave(false)}
              className={cn(
                'uppercase transition-colors hover:text-ink',
                confirmingLeave ? 'text-vermilion underline underline-offset-2' : 'text-graphite',
              )}
            >
              {confirmingLeave
                ? goal.isOwner
                  ? 'Закрыть для всех?'
                  : 'Точно?'
                : invited
                  ? 'Отказаться'
                  : goal.isOwner
                    ? 'Закрыть цель'
                    : 'Выйти'}
            </button>
          )}
        </div>

        {waiting.length > 0 && !done && !invited && (
          <p className="mt-1 text-right font-mono text-micro uppercase text-graphite">
            ждём: {waiting.map((m) => m.firstName).join(', ')}
          </p>
        )}
      </div>
    </motion.article>
  );
}

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  useCheckinGoal,
  useCompleteGoal,
  useJoinGoal,
  useLeaveGoal,
  useRescueGoal,
} from '@/hooks/useSocial';
import { RefreshButton } from '@/components/goals/RefreshButton';
import { pluralizeDays } from '@/lib/streak';
import { cn } from '@/lib/utils';
import type { GroupGoal } from '@/types/api';

/**
 * A goal several people hold at once. The card's job is to answer one question
 * before any other: is today done, and if not, by whom. Everything else — the
 * count, the target, the rescue — is subordinate to that.
 */
export function GoalCard({ goal }: { goal: GroupGoal }) {
  // Both destructive-ish actions ask twice, and only one of them may be asking
  // at a time — two live confirmations side by side is how you tap the wrong one.
  const [confirming, setConfirming] = useState<'leave' | 'complete' | null>(null);
  const checkin = useCheckinGoal();
  const rescue = useRescueGoal();
  const join = useJoinGoal();
  const leave = useLeaveGoal();
  const complete = useCompleteGoal();

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
          {/* The refresh sits with the title because that is the thing being
              refreshed — whether the others have closed their day. */}
          <div className="flex min-w-0 items-center gap-1.5">
            <h3 className="min-w-0 truncate font-display text-lg uppercase leading-tight tracking-[0.05em]">
              {goal.title}
            </h3>
            <RefreshButton />
          </div>

          {done ? (
            <span className="chip mt-0.5 shrink-0 border-ochre text-ochre">✓ Выполнена</span>
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
            <span className="chip mt-0.5 shrink-0">✓ День отмечен</span>
          ) : (
            <Button
              size="sm"
              className="mt-0.5 shrink-0"
              disabled={checkin.isPending}
              onClick={() => checkin.mutate({ goal })}
            >
              Отметить день
            </Button>
          )}
        </div>

        {/* Below the button rather than beside it: the count is a full line of
            text, and sharing a row with a button leaves it wrapping three times
            on a 320px screen. */}
        <p className="mt-0.5 font-mono text-micro uppercase text-graphite">
          держим вместе · <span className="figure">{goal.currentCount}</span> из {goal.targetDays}{' '}
          {pluralizeDays(goal.targetDays)}
        </p>

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

          {/* The finish, reachable from day one. A goal can come true before its
              day count runs out, and until this existed the only way to close
              one early was to abandon it — which is the opposite statement. */}
          {!done && goal.myStatus === 'JOINED' && (
            <button
              onClick={() =>
                confirming === 'complete' ? complete.mutate(goal.id) : setConfirming('complete')
              }
              onBlur={() => setConfirming(null)}
              disabled={complete.isPending}
              className={cn(
                'uppercase transition-colors hover:text-ink disabled:opacity-50',
                confirming === 'complete'
                  ? 'text-ochre underline underline-offset-2'
                  : 'text-graphite',
              )}
            >
              {confirming === 'complete' ? 'Точно выполнена?' : 'Цель выполнена'}
            </button>
          )}

          {!done && (
            <button
              onClick={() =>
                confirming === 'leave' ? leave.mutate(goal.id) : setConfirming('leave')
              }
              onBlur={() => setConfirming(null)}
              className={cn(
                'uppercase transition-colors hover:text-ink',
                confirming === 'leave'
                  ? 'text-vermilion underline underline-offset-2'
                  : 'text-graphite',
              )}
            >
              {confirming === 'leave'
                ? goal.isOwner
                  ? 'Бросить для всех?'
                  : 'Точно?'
                : invited
                  ? 'Отказаться'
                  : goal.isOwner
                    ? 'Бросить цель'
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

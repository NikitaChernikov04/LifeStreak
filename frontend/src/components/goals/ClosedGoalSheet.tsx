import { useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ProofHistory } from '@/components/goals/ProofHistory';
import { goalOutcome } from '@/lib/goals';
import { pluralizeDays } from '@/lib/streak';
import { cn } from '@/lib/utils';
import type { GroupGoal } from '@/types/api';

/**
 * A finished goal or bet, opened up.
 *
 * The archive collapses these to one line each, which is right for scanning
 * and wrong for remembering: the whole point of holding something for thirty
 * days with somebody is that afterwards you can look at what it was. So the
 * line opens, and everything the goal still has is here — how it ended, who
 * held it, and for a bet the final table and the day-by-day record with its
 * proofs.
 *
 * Nothing is editable. A closed goal has no decisions left in it, and a
 * control that cannot change anything is a lie about what is possible.
 */
export function ClosedGoalSheet({
  goal,
  open,
  onOpenChange,
}: {
  goal: GroupGoal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [history, setHistory] = useState(false);
  const versus = goal.versus;
  const isBet = goal.mode === 'VERSUS';

  return (
    <>
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/30" />
          <DialogPrimitive.Content
            className="fixed inset-0 z-50 flex flex-col bg-paper outline-none"
            aria-describedby={undefined}
          >
            <header className="shrink-0 border-b border-ink px-4 pb-2 pt-5">
              <div className="mx-auto flex w-full max-w-md items-end justify-between gap-3">
                <div className="min-w-0">
                  <DialogPrimitive.Title className="truncate font-display text-[clamp(1.25rem,6.5vw,1.625rem)] uppercase leading-tight tracking-[0.04em]">
                    {goal.title}
                  </DialogPrimitive.Title>
                  <p className="mt-0.5 truncate font-mono text-micro uppercase text-graphite">
                    {isBet ? 'спор' : 'общая цель'} · закрыт{isBet ? '' : 'а'}
                  </p>
                </div>
                <DialogPrimitive.Close
                  className="shrink-0 pb-1 font-mono text-micro uppercase tracking-[0.1em] text-graphite transition-colors hover:text-ink"
                  aria-label="Закрыть"
                >
                  Закрыть
                </DialogPrimitive.Close>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-md px-4 pb-10 pt-5">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="flex h-12 w-12 shrink-0 items-center justify-center border text-xl"
                    style={{ borderColor: goal.color, backgroundColor: `${goal.color}1F` }}
                  >
                    {goal.icon}
                  </span>
                  <p className="min-w-0 flex-1 font-display text-lg uppercase leading-tight tracking-[0.04em] text-ink-soft">
                    {goalOutcome(goal)}
                  </p>
                </div>

                <dl className="mt-6 border-t border-ink/15">
                  <Fact label="начата" value={formatInstant(goal.createdAt)} />
                  {goal.completedAt && (
                    <Fact label="закрыта" value={formatInstant(goal.completedAt)} />
                  )}
                  {isBet && versus ? (
                    <>
                      <Fact
                        label="спринт"
                        value={`${versus.sprintDays} ${pluralizeDays(versus.sprintDays)}`}
                      />
                      <Fact label="спринтов всего" value={String(versus.sprintCount)} />
                    </>
                  ) : (
                    <Fact
                      label="дней засчитано"
                      value={`${goal.currentCount} из ${goal.targetDays}`}
                    />
                  )}
                </dl>

                {isBet && versus ? (
                  <section className="mt-8">
                    <div className="flex items-center gap-3">
                      <h3 className="field-label shrink-0 text-ink-soft">Итог</h3>
                      <span aria-hidden className="h-px flex-1 bg-ink/20" />
                    </div>

                    <div className="mt-3 flex items-baseline justify-between gap-2 border-b border-ink/20 pb-1 font-mono text-[0.5625rem] uppercase tracking-[0.1em] text-graphite">
                      <span>кто</span>
                      <span className="flex shrink-0 items-baseline gap-3">
                        <span>чисто</span>
                        <span className="w-8 text-right">взято</span>
                      </span>
                    </div>

                    {versus.standings.map((person) => (
                      <div
                        key={person.id}
                        className="flex items-baseline justify-between gap-2 border-b border-ink/10 py-2 font-mono text-micro uppercase last:border-b-0"
                      >
                        <span className={cn('min-w-0 truncate', person.isMe && 'text-ink')}>
                          {person.isMe ? 'ты' : person.firstName}
                        </span>
                        <span className="flex shrink-0 items-baseline gap-3 text-graphite">
                          <span className="figure">{person.sprintsPerfect}</span>
                          <span className="figure w-8 text-right text-[1.0625rem] text-ink">
                            {person.sprintsWon}
                          </span>
                        </span>
                      </div>
                    ))}

                    {versus.standings[0]?.sprintsDrawn > 0 && (
                      <p className="mt-1.5 font-mono text-micro uppercase text-graphite">
                        ничьих <span className="figure">{versus.standings[0].sprintsDrawn}</span>
                      </p>
                    )}

                    <button
                      onClick={() => setHistory(true)}
                      className="entry-action mt-4 inline-block"
                    >
                      Прошлые дни
                    </button>
                  </section>
                ) : (
                  <section className="mt-8">
                    <div className="flex items-center gap-3">
                      <h3 className="field-label shrink-0 text-ink-soft">Держали</h3>
                      <span aria-hidden className="h-px flex-1 bg-ink/20" />
                    </div>
                    <ul className="mt-3">
                      {goal.members.map((member) => (
                        <li
                          key={member.id}
                          className="border-b border-ink/10 py-2 font-mono text-micro uppercase last:border-b-0"
                        >
                          <span className={member.isMe ? 'text-ink' : 'text-graphite'}>
                            {member.isMe ? 'ты' : member.firstName}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* The record itself, day by day, unchanged from the live card — a closed
          bet's proofs are still readable to the people who were in it. */}
      <ProofHistory goalId={goal.id} title={goal.title} open={history} onOpenChange={setHistory} />
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ink/10 py-2">
      <dt className="shrink-0 font-mono text-micro uppercase text-graphite">{label}</dt>
      <dd className="min-w-0 truncate font-mono text-micro uppercase text-ink-soft">{value}</dd>
    </div>
  );
}

/** A real instant, so it is read in the reader's own time, not in UTC. */
function formatInstant(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

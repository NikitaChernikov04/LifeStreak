import { useEffect, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useGoalProofs, useProofDays } from '@/hooks/useSocial';
import { ProofPhoto } from '@/components/goals/ProofPhoto';
import { formatDayLong, formatDayMark } from '@/lib/streak';
import { cn } from '@/lib/utils';
import type { GoalProofEntry, ProofDay } from '@/types/api';

/**
 * The record of a bet, read one day at a time.
 *
 * A single endless scroll of every proof ever posted is the wrong shape for
 * this: on a hundred-day bet it is two hundred entries, and the thing anybody
 * actually wants is a particular day. So the day is chosen first and then
 * read as a card — which also means only that day's photos are ever fetched.
 */
export function ProofHistory({
  goalId,
  title,
  open,
  onOpenChange,
}: {
  goalId: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [day, setDay] = useState<string | null>(null);

  const { data: days, isPending: daysPending } = useProofDays(goalId, open);
  const { data: proofs, isPending: proofsPending } = useGoalProofs(goalId, day);

  // Open on the most recent day rather than on an empty frame — that is the
  // day somebody came to look at nine times out of ten.
  useEffect(() => {
    if (open && day === null && days?.length) setDay(days[0].date);
  }, [open, day, days]);

  // A fresh open should not resume on whatever day was left selected weeks ago.
  useEffect(() => {
    if (!open) {
      setDay(null);
      setPicking(false);
    }
  }, [open]);

  const selected = days?.find((d) => d.date === day) ?? null;
  const entries = proofs?.items ?? [];
  const total = days?.reduce((sum, d) => sum + d.count, 0) ?? 0;

  return (
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
                  Прошлые дни
                </DialogPrimitive.Title>
                <p className="mt-0.5 truncate font-mono text-micro uppercase text-graphite">
                  {title}
                  {total > 0 && (
                    <>
                      {' · '}
                      <span className="figure">{total}</span> {pluralEntries(total)}
                    </>
                  )}
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
            <div className="mx-auto w-full max-w-md px-4 pb-10 pt-4">
              {daysPending && (
                <p className="py-8 text-center font-mono text-micro uppercase text-graphite">
                  открываю записи…
                </p>
              )}

              {!daysPending && (days?.length ?? 0) === 0 && (
                <p className="border-b border-ink/15 py-6 text-[0.9375rem] leading-relaxed text-graphite">
                  Пока ни одного пруфа. Приложи к своему дню фото, ссылку или строку — и здесь
                  начнёт копиться история.
                </p>
              )}

              {days && days.length > 0 && (
                <>
                  <DayPicker
                    days={days}
                    selected={selected}
                    open={picking}
                    onOpenChange={setPicking}
                    onPick={(date) => {
                      setDay(date);
                      setPicking(false);
                    }}
                  />

                  {selected && (
                    <section className="mt-5">
                      <div className="flex items-center gap-3">
                        <h3 className="field-label shrink-0">{formatDayLong(selected.date)}</h3>
                        <span aria-hidden className="h-px flex-1 bg-ink/15" />
                        {selected.sprint !== null && (
                          <span className="shrink-0 font-mono text-micro uppercase text-graphite">
                            спринт <span className="figure">{selected.sprint}</span>
                          </span>
                        )}
                      </div>

                      {proofsPending && (
                        <p className="py-6 text-center font-mono text-micro uppercase text-graphite">
                          читаю день…
                        </p>
                      )}

                      <div className="mt-3 space-y-3">
                        {entries.map((entry) => (
                          <DayCard key={entry.id} goalId={goalId} entry={entry} />
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * The button and the list of days behind it. Deliberately not a native
 * `<select>`: each row carries its sprint and how many entries it holds, and
 * a select can only show a line of text.
 */
function DayPicker({
  days,
  selected,
  open,
  onOpenChange,
  onPick,
}: {
  days: ProofDay[];
  selected: ProofDay | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (date: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);

  // Tapping anywhere else puts the list away, the way a dropdown should.
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) onOpenChange(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open, onOpenChange]);

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center justify-between gap-3 border px-3 py-3 font-mono text-micro uppercase tracking-[0.08em] transition-colors',
          open ? 'border-ink bg-ink/[0.05] text-ink' : 'border-ink/25 text-graphite hover:border-ink/50',
        )}
      >
        <span>Просмотреть день</span>
        <span className="flex min-w-0 items-center gap-2 text-ink">
          <span className="truncate">{selected ? formatDayMark(selected.date) : '—'}</span>
          <span aria-hidden className={cn('transition-transform', open && 'rotate-180')}>
            ▾
          </span>
        </span>
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-10 max-h-72 overflow-y-auto border border-ink bg-paper-edge shadow-[4px_4px_0_hsl(var(--ink)/0.14)]">
          {days.map((option) => {
            const active = option.date === selected?.date;
            return (
              <button
                key={option.date}
                onClick={() => onPick(option.date)}
                className={cn(
                  'flex w-full items-baseline justify-between gap-3 border-b border-ink/10 px-3 py-2.5 text-left font-mono text-micro uppercase transition-colors last:border-b-0',
                  active ? 'bg-ink/[0.06] text-ink' : 'text-graphite hover:bg-ink/[0.03] hover:text-ink',
                )}
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  <span aria-hidden className={active ? 'text-ochre' : 'text-transparent'}>
                    ✓
                  </span>
                  <span className="truncate">{formatDayLong(option.date)}</span>
                </span>
                <span className="shrink-0 text-graphite">
                  {option.sprint !== null && (
                    <>
                      сп. <span className="figure">{option.sprint}</span>
                      {' · '}
                    </>
                  )}
                  <span className="figure">{option.count}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** One person's day: what they wrote, what they linked, what they showed. */
function DayCard({ goalId, entry }: { goalId: string; entry: GoalProofEntry }) {
  const author = entry.author?.firstName ?? 'участник';
  const caption = `${author} · ${formatDayMark(entry.date)}`;

  return (
    <article className="border border-ink/20 bg-paper-edge p-3">
      <p className="border-b border-ink/15 pb-1.5 font-mono text-micro uppercase tracking-[0.08em]">
        {entry.author?.firstName ?? '—'}
      </p>

      {entry.note ? (
        <p className="mt-2 break-words text-[0.9375rem] leading-snug">{entry.note}</p>
      ) : (
        <p className="mt-2 font-mono text-micro uppercase text-graphite">без записи</p>
      )}

      {entry.url && (
        <a
          href={entry.url}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-1.5 inline-block break-all font-mono text-[0.75rem] text-ochre underline underline-offset-2"
        >
          {entry.url.replace(/^https?:\/\//, '')}
        </a>
      )}

      {entry.hasImage && (
        <div className="mt-2">
          <ProofPhoto
            goalId={goalId}
            checkinId={entry.id}
            caption={caption}
            author={author}
            className="max-h-64"
          />
        </div>
      )}
    </article>
  );
}

function pluralEntries(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'записей';
  if (mod10 === 1) return 'запись';
  if (mod10 >= 2 && mod10 <= 4) return 'записи';
  return 'записей';
}

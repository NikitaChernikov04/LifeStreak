import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCreateGoal, useFriends } from '@/hooks/useSocial';
import { displayName, initials } from '@/lib/social';
import { pluralizeDays } from '@/lib/streak';
import { COLORS, ICONS } from '@/lib/palette';
import { cn } from '@/lib/utils';
import type { GoalMode } from '@/types/api';

const TARGETS = [7, 14, 30, 60, 100];

/** Short enough to restart often, long enough that one bad day is not the verdict. */
const SPRINT_LENGTHS = [3, 5, 7];
const SPRINT_COUNTS = [4, 10, 20];

const MODES = [
  { value: 'TOGETHER', label: 'Держим вместе' },
  { value: 'VERSUS', label: 'Спорим' },
] as const;

/**
 * A shared goal cannot be made alone, so the friend picker is not an optional
 * step at the bottom — it is the field that gates the button.
 */
export function CreateGoalDialog() {
  const [open, setOpen] = useState(false);
  const { data: friends } = useFriends();
  const createGoal = useCreateGoal();

  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState(ICONS[1]);
  const [color, setColor] = useState(COLORS[4]);
  const [mode, setMode] = useState<GoalMode>('TOGETHER');
  const [targetDays, setTargetDays] = useState(30);
  const [sprintDays, setSprintDays] = useState(5);
  const [sprintCount, setSprintCount] = useState(20);
  const [members, setMembers] = useState<string[]>([]);

  const hasFriends = (friends?.length ?? 0) > 0;
  const versus = mode === 'VERSUS';

  function reset() {
    setTitle('');
    setIcon(ICONS[1]);
    setColor(COLORS[4]);
    setMode('TOGETHER');
    setTargetDays(30);
    setSprintDays(5);
    setSprintCount(20);
    setMembers([]);
  }

  function toggleMember(id: string) {
    setMembers((current) =>
      current.includes(id) ? current.filter((m) => m !== id) : [...current, id],
    );
  }

  function handleCreate() {
    if (!title.trim() || members.length === 0) return;
    createGoal.mutate(
      {
        title: title.trim(),
        icon,
        color,
        mode,
        // A competition's length is a product of sprints, so it never leaves a
        // short final one; a joint goal is simply a number of days.
        ...(versus ? { sprintDays, sprintCount } : { targetDays }),
        memberIds: members,
      },
      {
        onSuccess: () => {
          setOpen(false);
          reset();
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          Цель или спор
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto no-scrollbar">
        <DialogTitle>{versus ? 'Спор' : 'Общая цель'}</DialogTitle>

        {!hasFriends ? (
          <p className="mt-5 text-sm leading-relaxed text-graphite">
            Договариваться не с кем: сначала добавь друзей на вкладке «Друзья». Позвать можно только
            тех, кто принял заявку.
          </p>
        ) : (
          <div className="mt-5 space-y-5">
            <fieldset>
              <legend className="field-label mb-1.5">Название</legend>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например, зарядка каждое утро"
                maxLength={40}
                className="field-input"
              />
            </fieldset>

            <fieldset>
              <legend className="field-label mb-2">Как договоримся</legend>
              <div className="flex gap-1.5">
                {MODES.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setMode(option.value)}
                    aria-pressed={mode === option.value}
                    className={cn(
                      'flex-1 border px-2 py-2 font-mono text-xs uppercase transition-colors',
                      mode === option.value
                        ? 'border-ink bg-ink/[0.06] text-ink'
                        : 'border-ink/20 text-graphite hover:border-ink/50',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[0.8125rem] leading-snug text-graphite">
                {versus
                  ? 'Каждый считает свои дни. Счёт идёт по спринтам, а не одной суммой за всё время — отставший всегда в одном спринте от того, чтобы сравняться.'
                  : 'Один счёт на всех. День засчитывается, только когда отметились все.'}
              </p>
            </fieldset>

            {versus ? (
              <>
                <fieldset>
                  <legend className="field-label mb-2">Спринт</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {SPRINT_LENGTHS.map((days) => (
                      <button
                        key={days}
                        onClick={() => setSprintDays(days)}
                        aria-pressed={sprintDays === days}
                        className={cn(
                          'min-w-[3.5rem] border px-2 py-2 font-mono text-xs uppercase transition-colors',
                          sprintDays === days
                            ? 'border-ink bg-ink/[0.06] text-ink'
                            : 'border-ink/20 text-graphite hover:border-ink/50',
                        )}
                      >
                        {days} {pluralizeDays(days)}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="field-label mb-2">Сколько спринтов</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {SPRINT_COUNTS.map((count) => (
                      <button
                        key={count}
                        onClick={() => setSprintCount(count)}
                        aria-pressed={sprintCount === count}
                        className={cn(
                          'min-w-[3.5rem] border px-2 py-2 font-mono text-xs uppercase transition-colors',
                          sprintCount === count
                            ? 'border-ink bg-ink/[0.06] text-ink'
                            : 'border-ink/20 text-graphite hover:border-ink/50',
                        )}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 font-mono text-micro uppercase text-graphite">
                    всего <span className="figure">{sprintDays * sprintCount}</span>{' '}
                    {pluralizeDays(sprintDays * sprintCount)}
                  </p>
                </fieldset>
              </>
            ) : (
              <fieldset>
                <legend className="field-label mb-2">Держим</legend>
                <div className="flex flex-wrap gap-1.5">
                  {TARGETS.map((days) => (
                    <button
                      key={days}
                      onClick={() => setTargetDays(days)}
                      aria-pressed={targetDays === days}
                      className={cn(
                        'min-w-[3.5rem] border px-2 py-2 font-mono text-xs uppercase transition-colors',
                        targetDays === days
                          ? 'border-ink bg-ink/[0.06] text-ink'
                          : 'border-ink/20 text-graphite hover:border-ink/50',
                      )}
                    >
                      {days} {pluralizeDays(days)}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            <fieldset>
              <legend className="field-label mb-2">
                Кого зовём {members.length > 0 && `· ${members.length}`}
              </legend>
              <div className="border border-ink/25">
                {friends?.map((friend, index) => {
                  const picked = members.includes(friend.id);
                  return (
                    <button
                      key={friend.id}
                      onClick={() => toggleMember(friend.id)}
                      aria-pressed={picked}
                      className={cn(
                        'flex w-full items-center gap-2.5 p-2.5 text-left transition-colors',
                        index < (friends?.length ?? 0) - 1 && 'border-b border-ink/15',
                        picked && 'bg-ink/[0.05]',
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center border text-xs leading-none',
                          picked ? 'border-ink bg-ink text-paper' : 'border-ink/35',
                        )}
                      >
                        {picked ? '✓' : ''}
                      </span>
                      <Avatar className="h-8 w-8 shadow-none">
                        {friend.avatarUrl && <AvatarImage src={friend.avatarUrl} />}
                        <AvatarFallback className="bg-indigo text-xs text-paper">
                          {initials(friend)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate font-display text-base uppercase leading-tight tracking-[0.04em]">
                        {displayName(friend)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[0.8125rem] leading-snug text-graphite">
                {versus
                  ? 'К любому дню можно приложить пруф — фото, ссылку, строку. Его никто не подтверждает, и видят его только те, кто в этом споре.'
                  : 'День засчитывается группе, только когда отметились все. Пропущенный день можно выкупить сердцем — но лишь один.'}
              </p>
            </fieldset>

            <fieldset>
              <legend className="field-label mb-2">Значок</legend>
              <div className="grid grid-cols-6 gap-1.5">
                {ICONS.map((i) => (
                  <button
                    key={i}
                    onClick={() => setIcon(i)}
                    aria-pressed={icon === i}
                    className={cn(
                      'flex h-9 items-center justify-center border text-base transition-colors',
                      icon === i ? 'border-ink bg-ink/[0.06]' : 'border-ink/20 hover:border-ink/50',
                    )}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="field-label mb-2">{versus ? 'Метка спора' : 'Метка цели'}</legend>
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    aria-label={`Цвет ${c}`}
                    aria-pressed={color === c}
                    style={{ backgroundColor: c }}
                    className={cn(
                      'h-7 w-7 border transition-shadow',
                      color === c
                        ? 'border-ink shadow-[0_0_0_2px_hsl(var(--paper-edge))_inset]'
                        : 'border-ink/20',
                    )}
                  />
                ))}
              </div>
            </fieldset>

            {createGoal.isError && (
              <p className="font-mono text-micro uppercase text-vermilion">
                {createGoal.error.message}
              </p>
            )}

            <Button
              className="w-full"
              disabled={!title.trim() || members.length === 0 || createGoal.isPending}
              onClick={handleCreate}
            >
              {members.length === 0 ? 'Выбери, кого позвать' : versus ? 'Спорим' : 'Завести цель'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

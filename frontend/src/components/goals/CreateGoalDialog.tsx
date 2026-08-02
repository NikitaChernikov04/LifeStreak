import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCreateGoal, useFriends } from '@/hooks/useSocial';
import { displayName, initials } from '@/lib/social';
import { pluralizeDays } from '@/lib/streak';
import { COLORS, ICONS } from '@/lib/palette';
import { cn } from '@/lib/utils';

const TARGETS = [7, 14, 30, 60, 100];

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
  const [targetDays, setTargetDays] = useState(30);
  const [members, setMembers] = useState<string[]>([]);

  const hasFriends = (friends?.length ?? 0) > 0;

  function reset() {
    setTitle('');
    setIcon(ICONS[1]);
    setColor(COLORS[4]);
    setTargetDays(30);
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
      { title: title.trim(), icon, color, targetDays, memberIds: members },
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
          Общая цель
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto no-scrollbar">
        <DialogTitle>Общая цель</DialogTitle>

        {!hasFriends ? (
          <p className="mt-5 text-sm leading-relaxed text-graphite">
            Держать цель вместе не с кем: сначала добавь друзей на вкладке «Друзья». Позвать можно
            только тех, кто принял заявку.
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
                День засчитывается группе, только когда отметились все. Пропущенный день можно
                выкупить сердцем — но лишь один.
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
              <legend className="field-label mb-2">Метка цели</legend>
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
              {members.length === 0 ? 'Выбери, кого позвать' : 'Завести цель'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import { Sheet } from '@/components/layout/Sheet';
import { CreateStreakDialog } from '@/components/streaks/CreateStreakDialog';
import { useCreateStreak, useStreakTemplates } from '@/hooks/useStreaks';
import { cn } from '@/lib/utils';
import type { StreakTemplate, User } from '@/types/api';

/**
 * What somebody sees the first time, before they have a single streak.
 *
 * It exists because the numbers said so: of the five people who joined most
 * recently, four never created a streak at all. Nothing was wrong with
 * retention — everyone who reached a first streak stayed. They were lost on
 * the first screen.
 *
 * That screen used to open on the daily challenge: the largest element, the
 * only coloured one, and a button that pays out XP for reading twenty pages.
 * To a person with nothing it was the obvious thing to press, and pressing it
 * taught the wrong mechanic and rewarded them for it. Beneath that sat the
 * words "Лист пока пустой" — a description of emptiness where a beginning
 * should be — and then two identical outline buttons, so nothing said which
 * of the two things mattered.
 *
 * So here there is one thing to do, and it takes one tap. Picking a template
 * creates the streak outright rather than opening a form: a person deciding
 * whether this app is worth their time should not have to fill in a title, an
 * icon and a colour to find out.
 */
export function FirstRun({ user }: { user: User }) {
  const { data: templates } = useStreakTemplates();
  const createStreak = useCreateStreak();
  const [picked, setPicked] = useState<string | null>(null);

  function start(template: StreakTemplate) {
    if (createStreak.isPending) return;
    setPicked(template.key);
    createStreak.mutate({
      title: template.title,
      icon: template.icon,
      color: template.color,
      templateKey: template.key,
    });
  }

  return (
    <Sheet>
      <header>
        <p className="font-mono text-micro uppercase text-graphite">Лист 1</p>
        <h1 className="mt-1.5 border-b border-ink pb-2 font-display text-[clamp(1.25rem,6.5vw,1.625rem)] uppercase leading-tight tracking-[0.04em]">
          С чего начнём, {user.firstName}
        </h1>
      </header>

      {/* The mechanic, stated once and plainly. It is the only explanation on
          the screen, and it is here because the app never actually said what a
          streak was — it only ever showed one. */}
      <p className="mt-5 text-[0.9375rem] leading-relaxed text-ink-soft">
        Серия — это дни подряд, которые не хочется прерывать. Отметь один
        сегодня, и завтра появится, что терять.
      </p>

      <div className="mt-8 flex items-center gap-3">
        <h2 className="field-label shrink-0 text-ink-soft">Выбери первую</h2>
        <span aria-hidden className="h-px flex-1 bg-ink/20" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {(templates ?? []).map((template) => {
          const busy = picked === template.key && createStreak.isPending;
          return (
            <button
              key={template.key}
              onClick={() => start(template)}
              disabled={createStreak.isPending}
              className={cn(
                'flex items-center gap-3 border px-3 py-3.5 text-left transition-colors',
                busy
                  ? 'border-ink bg-ink/[0.06]'
                  : 'border-ink/25 hover:border-ink disabled:opacity-50',
              )}
            >
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center border text-base"
                style={{ borderColor: template.color, backgroundColor: `${template.color}1F` }}
              >
                {template.icon}
              </span>
              <span className="min-w-0 flex-1 truncate font-display text-[0.9375rem] uppercase tracking-[0.05em]">
                {busy ? 'Завожу…' : template.title}
              </span>
            </button>
          );
        })}
      </div>

      {createStreak.isError && (
        <p className="mt-3 font-mono text-micro uppercase text-vermilion">
          Не получилось завести серию. Нажми ещё раз.
        </p>
      )}

      {/* The way out for somebody whose habit is not on the list — kept quiet,
          because a list of eight covers most people and a form is the slower
          road. */}
      <div className="mt-6">
        <CreateStreakDialog triggerLabel="Своё занятие" />
      </div>

      <p className="mt-4 text-center font-mono text-micro uppercase leading-relaxed text-graphite">
        Цели с друзьями, споры и награды откроются
        <br />
        сразу после первой серии
      </p>
    </Sheet>
  );
}

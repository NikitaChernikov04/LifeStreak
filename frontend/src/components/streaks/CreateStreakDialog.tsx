import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useCreateStreak, useStreakTemplates } from '@/hooks/useStreaks';
import { cn } from '@/lib/utils';
import type { StreakTemplate } from '@/types/api';

// Pigments rather than screen neon: saturated web colours fight the paper and
// would out-shout the ink everywhere a margin tab appears.
const COLORS = ['#B8862F', '#96543F', '#2F4858', '#4A6FA5', '#3E6B5A', '#6B4C7A', '#3F7A78', '#7A7D3C', '#8C5B7B'];
const ICONS = ['📚', '🏃', '💻', '🇬🇧', '🚭', '🍔', '🧘', '🚶', '🎸', '🎨', '💰', '☕'];

/** Creating a streak is filling in a blank form: labelled fields, ruled input, no chrome. */
export function CreateStreakDialog() {
  const [open, setOpen] = useState(false);
  const { data: templates } = useStreakTemplates();
  const createStreak = useCreateStreak();

  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [templateKey, setTemplateKey] = useState<string | undefined>(undefined);

  function applyTemplate(t: StreakTemplate) {
    setTemplateKey(t.key);
    setTitle(t.title);
    setIcon(t.icon);
    setColor(t.color);
  }

  function reset() {
    setTitle('');
    setIcon(ICONS[0]);
    setColor(COLORS[0]);
    setTemplateKey(undefined);
  }

  function handleCreate() {
    if (!title.trim()) return;
    createStreak.mutate(
      { title: title.trim(), icon, color, templateKey },
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
          Новая серия
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto no-scrollbar">
        <DialogTitle>Новая серия</DialogTitle>

        <div className="mt-5 space-y-5">
          <fieldset>
            <legend className="field-label mb-2">Готовый шаблон</legend>
            <div className="grid grid-cols-4 gap-1.5">
              {(templates ?? []).map((t) => (
                <button
                  key={t.key}
                  onClick={() => applyTemplate(t)}
                  className={cn(
                    'flex flex-col items-center gap-1 border px-1 py-2 transition-colors',
                    templateKey === t.key
                      ? 'border-ink bg-ink/[0.06]'
                      : 'border-ink/20 hover:border-ink/50',
                  )}
                >
                  <span className="text-lg leading-none">{t.icon}</span>
                  <span className="w-full truncate text-center font-mono text-[0.625rem] uppercase text-graphite">
                    {t.title}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="field-label">Название</legend>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setTemplateKey(undefined);
              }}
              placeholder="Например, бег по утрам"
              maxLength={40}
              className="field-input mt-1"
            />
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
            <legend className="field-label mb-2">Метка на полях</legend>
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
                    color === c ? 'border-ink shadow-[0_0_0_2px_hsl(var(--paper-edge))_inset]' : 'border-ink/20',
                  )}
                />
              ))}
            </div>
          </fieldset>

          <Button
            className="w-full"
            disabled={!title.trim() || createStreak.isPending}
            onClick={handleCreate}
          >
            Завести серию
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

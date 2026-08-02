import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { useCelebrationStore } from '@/store/useCelebrationStore';
import { hapticNotification } from '@/lib/telegram';
import { pluralizeDays } from '@/lib/streak';
import { InkHeart } from '@/components/hearts/HeartsDisplay';

type CelebrationEvent = NonNullable<ReturnType<typeof useCelebrationStore.getState>['queue'][0]>;

/**
 * Rewards arrive as a rubber stamp struck on the page: double rule, ochre ink,
 * slightly off-square. This is the one moment of theatre in the app, so it is
 * the only place a rotation or an overshoot is allowed.
 */
export function CelebrationOverlay() {
  const event = useCelebrationStore((s) => s.queue[0]);
  const shift = useCelebrationStore((s) => s.shift);

  useEffect(() => {
    if (!event) return;
    hapticNotification('success');
    const timeout = setTimeout(shift, 2200);
    return () => clearTimeout(timeout);
  }, [event, shift]);

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/30 px-8"
          onClick={shift}
        >
          <motion.div
            initial={{ scale: 1.5, rotate: -9, opacity: 0 }}
            animate={{ scale: 1, rotate: -4, opacity: 1 }}
            exit={{ scale: 1.08, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
            className="w-full max-w-[19rem] border-[3px] border-double border-ochre bg-paper px-6 py-7 text-center text-ochre"
          >
            <StampBody event={event} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StampBody({ event }: { event: CelebrationEvent }) {
  if (event.type === 'levelup') {
    return (
      <Stamp caption="Новый уровень" headline={`Уровень ${event.level}`} />
    );
  }
  if (event.type === 'heart') {
    return (
      <Stamp
        caption="Начислено"
        headline="Сердце"
        note="Им можно вернуть один пропущенный день"
        glyph={<InkHeart filled className="mx-auto h-7 w-7" />}
      />
    );
  }
  if (event.type === 'milestone') {
    return (
      <Stamp
        caption={event.title}
        headline={`${event.days} ${pluralizeDays(event.days)} подряд`}
        note={event.note ?? 'Ты уже такой человек'}
      />
    );
  }
  return (
    <Stamp caption="Достижение" headline={event.achievement.title} note={event.achievement.description} />
  );
}

function Stamp({
  caption,
  headline,
  note,
  glyph,
}: {
  caption: string;
  headline: string;
  note?: string;
  glyph?: React.ReactNode;
}) {
  return (
    <>
      {glyph}
      <p className="font-mono text-micro uppercase">{caption}</p>
      <p className="mt-1.5 font-display text-3xl uppercase leading-none tracking-[0.05em]">{headline}</p>
      <span aria-hidden className="mx-auto mt-3 block h-px w-12 bg-ochre/50" />
      {note && <p className="mt-2 text-xs leading-snug text-ink/70">{note}</p>}
    </>
  );
}

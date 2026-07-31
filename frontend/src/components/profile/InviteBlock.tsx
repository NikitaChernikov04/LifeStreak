import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FieldHeading } from '@/components/layout/Sheet';
import { useAcceptInvite, useMyInvite } from '@/hooks/useInvites';
import { shareToTelegram } from '@/lib/telegram';
import { copyText } from '@/lib/utils';

/**
 * Inviting a friend is a link, not a code. The code alone was unusable: it was
 * pasted into a message with nothing to open, and the friend who received it
 * had nowhere to type it in. Now the shareable artefact is a t.me link that
 * opens the Mini App with the code attached, and the code stays visible only
 * as the fallback for someone who was told it out loud.
 */
export function InviteBlock({ className }: { className?: string }) {
  const { data: invite } = useMyInvite();
  const accept = useAcceptInvite();

  const [copied, setCopied] = useState(false);
  const [entered, setEntered] = useState('');

  if (!invite) return null;

  const { code, link } = invite;
  const shareable = link ?? code;

  async function handleCopy() {
    const ok = await copyText(shareable);
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleShare() {
    const text = link
      ? 'Веду серии в LifeStreak — не срываюсь уже который день. Заходи по ссылке, нам обоим дадут по сердцу.'
      : `Присоединяйся ко мне в LifeStreak! Мой код — ${code}, введи его в профиле, и мы оба получим по сердцу.`;
    shareToTelegram(text, link ?? undefined);
  }

  return (
    <section className={className}>
      <FieldHeading count={invite.acceptedCount > 0 ? `${invite.acceptedCount}` : undefined}>
        Пригласи друга
      </FieldHeading>

      <div className="mt-3 border border-dashed border-ink/45 bg-paper-edge/60 p-4">
        <p className="text-center text-[0.8125rem] leading-snug text-graphite">
          Друг войдёт по твоей ссылке — по сердцу получите оба.
        </p>

        <p className="mt-3 text-center font-mono text-2xl tracking-[0.24em] text-ink">{code}</p>

        {link ? (
          <p className="mt-1.5 truncate text-center font-mono text-micro lowercase text-graphite">
            {link.replace(/^https:\/\//, '')}
          </p>
        ) : (
          <p className="mt-1.5 text-center font-mono text-micro uppercase text-graphite">
            Ссылка недоступна — продиктуй код
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="outline" className="min-w-0 flex-1" onClick={handleCopy}>
            {copied ? 'Готово' : 'Скопировать'}
          </Button>
          <Button size="sm" className="min-w-0 flex-1" onClick={handleShare}>
            Отправить
          </Button>
        </div>
      </div>

      {/* Only for someone who was given a code by hand — anyone arriving through
          the link has already had it redeemed for them. */}
      {!invite.hasAcceptedInvite && (
        <div className="mt-4">
          <p className="field-label">Пришли по чужому коду?</p>
          <div className="mt-2 flex gap-2">
            <input
              value={entered}
              onChange={(e) => {
                setEntered(e.target.value.trim());
                accept.reset();
              }}
              placeholder="Код друга"
              maxLength={32}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="field-input min-w-0 flex-1 font-mono text-base tracking-[0.14em]"
            />
            <Button
              variant="outline"
              className="shrink-0 px-4"
              disabled={entered.length < 4 || accept.isPending}
              onClick={() => accept.mutate(entered)}
            >
              Принять
            </Button>
          </div>
          {accept.isError && (
            <p className="mt-1.5 font-mono text-micro uppercase text-vermilion">
              {accept.error.message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

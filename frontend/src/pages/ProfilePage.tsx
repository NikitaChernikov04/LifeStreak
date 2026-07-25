import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetTitle, FieldHeading } from '@/components/layout/Sheet';
import { StatsGrid } from '@/components/profile/StatsGrid';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/useAuthStore';
import { useStatistics } from '@/hooks/useProfile';
import { useMyInvite } from '@/hooks/useInvites';
import { xpIntoCurrentLevel } from '@/lib/leveling';
import { shareToTelegram } from '@/lib/telegram';

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const { data: stats } = useStatistics();
  const { data: invite } = useMyInvite();
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const { current, needed } = xpIntoCurrentLevel(user.xp);
  const levelProgress = Math.min(100, (current / needed) * 100);

  async function copyInviteCode() {
    if (!invite) return;
    await navigator.clipboard.writeText(invite.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareInvite() {
    if (!invite) return;
    shareToTelegram(
      `Присоединяйся ко мне в LifeStreak! Используй код ${invite.code}, и мы оба получим по сердцу.`,
    );
  }

  return (
    <Sheet>
      <SheetTitle meta={`ур. ${user.level}`}>Профиль</SheetTitle>

      <div className="mt-5 flex items-center gap-4">
        <Avatar className="h-16 w-16 shrink-0">
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} />}
          <AvatarFallback className="text-2xl">{user.firstName[0]}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-2xl uppercase leading-none tracking-[0.04em]">
            {user.firstName} {user.lastName}
          </p>
          {user.username && (
            <p className="mt-1 truncate font-mono text-micro uppercase text-graphite">
              @{user.username}
            </p>
          )}
        </div>
      </div>

      {/* Level is a measured quantity, so it gets a scale rather than a pill. */}
      <div className="mt-5">
        <div className="flex items-baseline justify-between font-mono text-micro uppercase text-graphite">
          <span>Опыт до {user.level + 1} уровня</span>
          <span className="figure">
            {current}/{needed}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full border border-ink/25">
          <div className="h-full bg-ink" style={{ width: `${levelProgress}%` }} />
        </div>
      </div>

      <FieldHeading className="mt-8">Сводка</FieldHeading>
      <div className="mt-2">{stats && <StatsGrid stats={stats} />}</div>

      <FieldHeading className="mt-8">Пригласить друга</FieldHeading>
      <p className="mt-2 text-[0.9375rem] leading-snug text-graphite">
        Когда друг войдёт по твоему коду, вы оба получите по сердцу.
      </p>

      {invite && (
        <>
          <div className="mt-3 border border-dashed border-ink/40 bg-paper-edge py-3 text-center">
            <p className="figure text-2xl tracking-[0.2em]">{invite.code}</p>
          </div>
          {/* Compact type so both labels fit side by side at 320px, with the
              touch target kept at 40px. */}
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" className="h-10 flex-1" onClick={copyInviteCode}>
              {copied ? 'Скопировано' : 'Скопировать'}
            </Button>
            <Button size="sm" className="h-10 flex-1" onClick={shareInvite}>
              Отправить
            </Button>
          </div>
        </>
      )}
    </Sheet>
  );
}

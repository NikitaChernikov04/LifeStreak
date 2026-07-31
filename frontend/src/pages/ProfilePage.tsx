import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetTitle, FieldHeading } from '@/components/layout/Sheet';
import { StatsGrid } from '@/components/profile/StatsGrid';
import { InviteBlock } from '@/components/profile/InviteBlock';
import { useAuthStore } from '@/store/useAuthStore';
import { useStatistics } from '@/hooks/useProfile';
import { xpIntoCurrentLevel } from '@/lib/leveling';

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const { data: stats } = useStatistics();

  if (!user) return null;

  const { current, needed } = xpIntoCurrentLevel(user.xp);
  const levelProgress = Math.min(100, (current / needed) * 100);

  return (
    <Sheet>
      <SheetTitle>Профиль</SheetTitle>

      <div className="mt-5 flex items-center gap-4">
        <Avatar className="h-16 w-16 shrink-0">
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} />}
          <AvatarFallback className="bg-ochre text-2xl text-paper">
            {initials(user.firstName, user.lastName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-2xl uppercase leading-none tracking-[0.04em]">
            {user.firstName} {user.lastName}
          </p>
          {/* Handle and level share one line: on a 320px screen two stacked
              rows of micro type read as debris under the name. */}
          <p className="mt-1.5 truncate font-mono text-micro uppercase text-graphite">
            {user.username && <>@{user.username} · </>}уровень {user.level}
          </p>
        </div>
      </div>

      {/* Level is a measured quantity, so it gets a scale rather than a pill. */}
      <div className="mt-6">
        <div className="flex items-baseline justify-between gap-3 font-mono text-micro uppercase text-graphite">
          <span>Опыт</span>
          <span className="figure">
            {current} / {needed}
          </span>
        </div>
        <div className="mt-1.5 h-2 w-full border border-ink/25">
          <div className="h-full bg-ochre" style={{ width: `${levelProgress}%` }} />
        </div>
      </div>

      <FieldHeading className="mt-8">Сводка</FieldHeading>
      <div className="mt-2">{stats && <StatsGrid stats={stats} />}</div>

      <InviteBlock className="mt-8" />
    </Sheet>
  );
}

function initials(firstName: string, lastName: string | null): string {
  return [firstName?.[0], lastName?.[0]].filter(Boolean).join('');
}

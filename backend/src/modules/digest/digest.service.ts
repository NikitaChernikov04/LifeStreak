import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { todayUtc } from '../../common/utils/date.util';

interface Pending {
  streaks: { icon: string; title: string }[];
  /** Goals where this member has not marked today, most urgent first. */
  goals: { title: string; count: number; target: number; aloneHolding: boolean; atRisk: boolean }[];
}

/**
 * The one message a day the bot is allowed to start on its own.
 *
 * Everything else it sends is a consequence of somebody else acting. This is
 * the exception, and it is why it is a single digest rather than one message
 * per streak: a phone that buzzes four times at eight in the evening gets the
 * bot muted, and a muted bot cannot say the one thing that matters — that
 * three people are waiting on you.
 */
@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async run(): Promise<{ candidates: number; sent: number }> {
    const today = todayUtc();
    const pending = await this.collect(today);

    let sent = 0;
    for (const [userId, work] of pending) {
      if (await this.alreadyNudged(userId, today)) continue;
      await this.notifications.create(userId, 'STREAK_REMINDER', 'Вечерняя сверка', this.compose(work), {
        digest: true,
      });
      sent += 1;
    }

    this.logger.log(`Вечерняя сводка: ${sent} из ${pending.size}`);
    return { candidates: pending.size, sent };
  }

  /**
   * Everything unfinished today, for everyone who can still be reached, in two
   * queries. Per-user queries would be simpler to read and would turn one
   * nightly job into thousands of round trips.
   */
  private async collect(today: Date): Promise<Map<string, Pending>> {
    const reachable = { dmEnabled: true, botBlocked: false };

    const [streaks, memberships] = await Promise.all([
      this.prisma.streak.findMany({
        where: {
          status: 'ACTIVE',
          user: reachable,
          OR: [{ lastCheckinAt: null }, { lastCheckinAt: { lt: today } }],
        },
        select: { userId: true, icon: true, title: true },
        orderBy: { currentCount: 'desc' },
      }),
      this.prisma.groupGoalMember.findMany({
        where: { status: 'JOINED', user: reachable, goal: { status: 'ACTIVE' } },
        select: {
          userId: true,
          goalId: true,
          goal: { select: { id: true, title: true, currentCount: true, targetDays: true, lastCountedDate: true } },
        },
      }),
    ]);

    const goalIds = [...new Set(memberships.map((m) => m.goalId))];
    const marks = goalIds.length
      ? await this.prisma.groupGoalCheckin.findMany({
          where: { goalId: { in: goalIds }, date: today },
          select: { goalId: true, userId: true },
        })
      : [];

    const markedIn = new Map<string, Set<string>>();
    for (const mark of marks) {
      if (!markedIn.has(mark.goalId)) markedIn.set(mark.goalId, new Set());
      markedIn.get(mark.goalId)!.add(mark.userId);
    }

    const joinedIn = new Map<string, string[]>();
    for (const membership of memberships) {
      joinedIn.set(membership.goalId, [...(joinedIn.get(membership.goalId) ?? []), membership.userId]);
    }

    const pending = new Map<string, Pending>();
    const of = (userId: string): Pending => {
      if (!pending.has(userId)) pending.set(userId, { streaks: [], goals: [] });
      return pending.get(userId)!;
    };

    for (const streak of streaks) {
      of(streak.userId).streaks.push({ icon: streak.icon, title: streak.title });
    }

    for (const membership of memberships) {
      const marked = markedIn.get(membership.goalId) ?? new Set<string>();
      if (marked.has(membership.userId)) continue;

      const joined = joinedIn.get(membership.goalId) ?? [];
      const goal = membership.goal;
      of(membership.userId).goals.push({
        title: goal.title,
        count: goal.currentCount,
        target: goal.targetDays,
        // Everyone else is done and the day hangs on this one person. This is
        // the sentence the whole feature was built to be able to send.
        aloneHolding: joined.length > 1 && joined.every((id) => id === membership.userId || marked.has(id)),
        atRisk: this.atRisk(goal, today),
      });
    }

    // A member list is not the only thing that sorts: the goal waiting on you
    // alone outranks the one nobody has touched.
    for (const work of pending.values()) {
      work.goals.sort((a, b) => Number(b.aloneHolding) - Number(a.aloneHolding));
    }

    return pending;
  }

  /** Yesterday is missing but still buyable — the last evening it can be saved. */
  private atRisk(goal: { currentCount: number; lastCountedDate: Date | null }, today: Date): boolean {
    if (goal.currentCount === 0 || !goal.lastCountedDate) return false;
    const gap = Math.round((today.getTime() - goal.lastCountedDate.getTime()) / 86_400_000);
    return gap === 2;
  }

  private compose(work: Pending): string {
    const lines: string[] = [];

    for (const goal of work.goals) {
      if (goal.aloneHolding) {
        lines.push(`«${goal.title}» — ждут только тебя. День ${goal.count + 1} из ${goal.target}`);
      } else if (goal.atRisk) {
        lines.push(`«${goal.title}» — вчера закрыли не все. Сегодня последний день спасти счёт`);
      } else {
        lines.push(`«${goal.title}» — общая цель ещё не отмечена`);
      }
    }

    if (work.streaks.length > 0) {
      const named = work.streaks.slice(0, 4).map((s) => `${s.icon} ${s.title}`).join(', ');
      const rest = work.streaks.length - 4;
      lines.push(`Не отмечено сегодня: ${named}${rest > 0 ? ` и ещё ${rest}` : ''}`);
    }

    return lines.join('\n');
  }

  /** One digest per calendar day, however many times the scheduler fires. */
  private async alreadyNudged(userId: string, today: Date): Promise<boolean> {
    const existing = await this.prisma.notification.findFirst({
      where: { userId, type: 'STREAK_REMINDER', createdAt: { gte: today } },
      select: { id: true },
    });
    return Boolean(existing);
  }
}

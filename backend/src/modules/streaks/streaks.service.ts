import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { HeartsService } from '../hearts/hearts.service';
import { AchievementsService } from '../achievements/achievements.service';
import { CreateStreakDto } from './dto/create-streak.dto';
import { STREAK_TEMPLATES, nextGoalFor } from './templates/streak-templates';
import { ONE_DAY_MS, daysBetween, todayUtc } from '../../common/utils/date.util';

const DAY_MS = ONE_DAY_MS;

export interface CheckinResult {
  streak: Awaited<ReturnType<StreaksService['getStreakOrThrow']>>;
  xpEarned: number;
  leveledUp: boolean;
  newLevel: number;
  heartGranted: boolean;
  unlockedMilestone: boolean;
}

@Injectable()
export class StreaksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly heartsService: HeartsService,
    private readonly achievementsService: AchievementsService,
  ) {}

  getTemplates() {
    return STREAK_TEMPLATES;
  }

  async findAllForUser(userId: string) {
    return this.prisma.streak.findMany({
      where: { userId, status: { not: 'ARCHIVED' } },
      orderBy: [{ status: 'asc' }, { currentCount: 'desc' }],
    });
  }

  private async getStreakOrThrow(userId: string, streakId: string) {
    const streak = await this.prisma.streak.findUnique({ where: { id: streakId } });
    if (!streak) throw new NotFoundException('Серия не найдена');
    if (streak.userId !== userId) throw new ForbiddenException();
    return streak;
  }

  /**
   * People arrive with history: 100 days without a cigarette, tracked
   * somewhere else. `startingCount` carries that history in, dated as finished
   * through yesterday — so today is still an open day the user records here,
   * which is the only habit the app is actually trying to build.
   *
   * Carried-over days do not pay XP, hearts or achievements: those are earned
   * in the journal, not declared on the way in.
   */
  async create(userId: string, dto: CreateStreakDto) {
    const imported = dto.startingCount ?? 0;

    const streak = await this.prisma.streak.create({
      data: {
        userId,
        title: dto.title,
        icon: dto.icon,
        color: dto.color,
        templateKey: dto.templateKey,
        currentCount: imported,
        longestCount: imported,
        importedCount: imported,
        lastCheckinAt: imported > 0 ? new Date(todayUtc().getTime() - DAY_MS) : null,
        nextGoal: nextGoalFor(imported),
      },
    });

    await this.prisma.statistics.update({
      where: { userId },
      data: { activeStreaksCount: { increment: 1 } },
    });

    if (imported > 0) {
      const stats = await this.prisma.statistics.findUniqueOrThrow({ where: { userId } });
      if (imported > stats.longestStreakEver) {
        await this.prisma.statistics.update({
          where: { userId },
          data: { longestStreakEver: imported },
        });
      }
    }

    await this.achievementsService.checkCollector(userId);

    return streak;
  }

  async archive(userId: string, streakId: string) {
    const streak = await this.getStreakOrThrow(userId, streakId);
    const archived = await this.prisma.streak.update({
      where: { id: streak.id },
      data: { status: 'ARCHIVED' },
    });
    if (streak.status === 'ACTIVE') {
      await this.prisma.statistics.update({
        where: { userId },
        data: { activeStreaksCount: { decrement: 1 } },
      });
    }
    return archived;
  }

  /**
   * "Сегодня выполнено" — the single most important interaction in the app,
   * and therefore the one whose latency is worth counting in round trips.
   *
   * It used to be nineteen sequential queries. That was invisible while the
   * function and the database shared a continent and fatal once they did not:
   * a query costs one network round trip whatever it selects, so the wait a
   * user feels is round-trip time multiplied by how many times the code asks
   * a question it could have asked alongside another. Reads that do not
   * depend on each other now travel together, and so do writes — which also
   * closes a real hole, since a failure between "day marked" and "count
   * raised" used to leave a streak that had recorded the day without counting
   * it.
   */
  async checkin(userId: string, streakId: string): Promise<CheckinResult> {
    const today = todayUtc();

    // Everything the decision needs, in one trip. Statistics is fetched before
    // the request is known to be valid: it costs nothing on the happy path,
    // which is the path that runs thousands of times a day.
    const [streak, alreadyToday, stats] = await this.prisma.$transaction([
      this.prisma.streak.findUnique({ where: { id: streakId } }),
      this.prisma.dailyCheckin.findUnique({
        where: { streakId_date: { streakId, date: today } },
      }),
      this.prisma.statistics.findUnique({ where: { userId } }),
    ]);

    if (!streak) throw new NotFoundException('Серия не найдена');
    if (streak.userId !== userId) throw new ForbiddenException();
    if (streak.status !== 'ACTIVE') {
      throw new BadRequestException('Эта серия больше не активна');
    }
    if (alreadyToday) {
      throw new BadRequestException('Сегодня уже отмечено — заходи завтра');
    }

    const daysSinceLast = streak.lastCheckinAt ? daysBetween(streak.lastCheckinAt, today) : null;
    const isContinuation = daysSinceLast === 1;
    const nextCount = daysSinceLast === null || isContinuation ? streak.currentCount + 1 : 1;
    const wasBroken = daysSinceLast !== null && daysSinceLast > 1;

    const xpEarned = 20;
    const longestCount = Math.max(streak.longestCount, nextCount);

    // One trip, one transaction. `longestStreakEver` is resolved from the
    // statistics already in hand rather than by reading it back between two
    // writes, which was also a race: two streaks checked in at once could each
    // read the old maximum and the smaller one could win.
    const [, updated] = await this.prisma.$transaction([
      this.prisma.dailyCheckin.create({ data: { streakId, userId, date: today, xpEarned } }),
      this.prisma.streak.update({
        where: { id: streakId },
        data: {
          currentCount: nextCount,
          longestCount,
          lastCheckinAt: today,
          nextGoal: nextGoalFor(nextCount),
          status: 'ACTIVE',
        },
      }),
      this.prisma.statistics.update({
        where: { userId },
        data: {
          totalCheckins: { increment: 1 },
          longestStreakEver: Math.max(stats?.longestStreakEver ?? 0, longestCount),
        },
      }),
    ]);

    const { leveledUp, level: newLevel, xp } = await this.usersService.grantXp(userId, xpEarned);

    let heartGranted = false;
    if (nextCount > 0 && nextCount % 7 === 0) {
      const before = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      await this.heartsService.grant(userId, 'WEEK_STREAK_BONUS');
      const after = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      heartGranted = after.hearts > before.hearts;
    }

    // Milestones and LEGEND asked together, from the XP this check-in just
    // produced. LEGEND used to be judged after milestone rewards landed, so a
    // milestone that crossed level 20 unlocked it in the same breath; now it
    // waits for the next check-in. That is one day late on an achievement
    // nobody is watching for, bought with eight fewer round trips on every
    // single check-in.
    await this.achievementsService.checkCheckinRewards(userId, updated, xp);

    return {
      streak: updated,
      xpEarned,
      leveledUp,
      newLevel,
      heartGranted,
      unlockedMilestone: !wasBroken && [7, 14, 30, 50, 100, 180, 365].includes(nextCount),
    };
  }

  /** Recovers the single most recent missed day of a streak, spending one heart. */
  async recover(userId: string, streakId: string) {
    const streak = await this.getStreakOrThrow(userId, streakId);
    if (streak.status !== 'ACTIVE' || !streak.lastCheckinAt) {
      throw new BadRequestException('Эту серию нельзя восстановить');
    }

    const today = todayUtc();
    const gap = daysBetween(streak.lastCheckinAt, today);

    if (gap !== 2) {
      throw new BadRequestException(
        'Восстановить можно только последний пропущенный день',
      );
    }

    const missedDate = new Date(streak.lastCheckinAt.getTime() + DAY_MS);

    await this.heartsService.spend(userId, 'STREAK_RECOVERY_SPENT');

    await this.prisma.dailyCheckin.create({
      data: { streakId, userId, date: missedDate, usedHeart: true, xpEarned: 0 },
    });

    const nextCount = streak.currentCount + 1;
    const updated = await this.prisma.streak.update({
      where: { id: streakId },
      data: {
        currentCount: nextCount,
        longestCount: Math.max(streak.longestCount, nextCount),
        lastCheckinAt: missedDate,
        nextGoal: nextGoalFor(nextCount),
        freezesUsedTotal: { increment: 1 },
      },
    });

    await this.achievementsService.checkFirstRecovery(userId);

    return updated;
  }
}

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

  async create(userId: string, dto: CreateStreakDto) {
    const streak = await this.prisma.streak.create({
      data: {
        userId,
        title: dto.title,
        icon: dto.icon,
        color: dto.color,
        templateKey: dto.templateKey,
        nextGoal: 7,
      },
    });

    await this.prisma.statistics.update({
      where: { userId },
      data: { activeStreaksCount: { increment: 1 } },
    });
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

  /** "Сегодня выполнено" — the single most important interaction in the app. */
  async checkin(userId: string, streakId: string): Promise<CheckinResult> {
    const streak = await this.getStreakOrThrow(userId, streakId);
    if (streak.status !== 'ACTIVE') {
      throw new BadRequestException('Эта серия больше не активна');
    }

    const today = todayUtc();

    const alreadyToday = await this.prisma.dailyCheckin.findUnique({
      where: { streakId_date: { streakId, date: today } },
    });
    if (alreadyToday) {
      throw new BadRequestException('Сегодня уже отмечено — заходи завтра');
    }

    const daysSinceLast = streak.lastCheckinAt ? daysBetween(streak.lastCheckinAt, today) : null;
    const isContinuation = daysSinceLast === 1;
    const nextCount = daysSinceLast === null || isContinuation ? streak.currentCount + 1 : 1;
    const wasBroken = daysSinceLast !== null && daysSinceLast > 1;

    const xpEarned = 20;

    await this.prisma.dailyCheckin.create({
      data: { streakId, userId, date: today, xpEarned },
    });

    const updated = await this.prisma.streak.update({
      where: { id: streakId },
      data: {
        currentCount: nextCount,
        longestCount: Math.max(streak.longestCount, nextCount),
        lastCheckinAt: today,
        nextGoal: nextGoalFor(nextCount),
        status: 'ACTIVE',
      },
    });

    const { leveledUp, level: newLevel } = await this.usersService.grantXp(userId, xpEarned);

    await this.prisma.statistics.update({
      where: { userId },
      data: { totalCheckins: { increment: 1 } },
    });
    // longestStreakEver needs an explicit comparison read, not a blind increment.
    const stats = await this.prisma.statistics.findUniqueOrThrow({ where: { userId } });
    if (updated.longestCount > stats.longestStreakEver) {
      await this.prisma.statistics.update({
        where: { userId },
        data: { longestStreakEver: updated.longestCount },
      });
    }

    let heartGranted = false;
    if (nextCount > 0 && nextCount % 7 === 0) {
      const before = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      await this.heartsService.grant(userId, 'WEEK_STREAK_BONUS');
      const after = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      heartGranted = after.hearts > before.hearts;
    }

    await this.achievementsService.checkStreakMilestones(userId, updated);
    await this.achievementsService.checkLegend(userId, (await this.usersService.getProfile(userId)).xp);

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

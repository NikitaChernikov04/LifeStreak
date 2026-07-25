import { Injectable, Logger } from '@nestjs/common';
import { Streak } from '@prisma/client';
import { AchievementKey } from '../../common/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { levelForXp } from '../../common/utils/leveling.util';

@Injectable()
export class AchievementsService {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly notifications: NotificationsService,
  ) {}

  findAll() {
    return this.prisma.achievementDefinition.findMany();
  }

  findForUser(userId: string) {
    return this.prisma.userAchievement.findMany({
      where: { userId },
      include: { definition: true },
      orderBy: { unlockedAt: 'desc' },
    });
  }

  /** Idempotently unlocks an achievement for a user and grants its XP reward. */
  private async unlock(userId: string, key: AchievementKey) {
    const definition = await this.prisma.achievementDefinition.findUnique({ where: { key } });
    if (!definition) {
      this.logger.warn(`Achievement definition missing for key ${key} — did you run the seed?`);
      return null;
    }

    const already = await this.prisma.userAchievement.findUnique({
      where: { userId_definitionId: { userId, definitionId: definition.id } },
    });
    if (already) return null;

    const unlocked = await this.prisma.userAchievement.create({
      data: { userId, definitionId: definition.id },
    });

    await this.usersService.grantXp(userId, definition.xpReward);
    await this.notifications.create(
      userId,
      'ACHIEVEMENT_UNLOCKED',
      `Достижение разблокировано: ${definition.title}`,
      definition.description,
      { key },
    );

    return unlocked;
  }

  async checkStreakMilestones(userId: string, streak: Streak) {
    const count = streak.currentCount;
    if (count >= 7) await this.unlock(userId, 'FIRST_WEEK');
    if (count >= 30) {
      await this.unlock(userId, 'DAYS_30');
      if (streak.freezesUsedTotal === 0) await this.unlock(userId, 'NO_MISSED_DAYS');
    }
    if (count >= 100) await this.unlock(userId, 'DAYS_100');
    if (count >= 365) await this.unlock(userId, 'DAYS_365');
  }

  async checkFirstHeart(userId: string) {
    await this.unlock(userId, 'FIRST_HEART');
  }

  async checkFirstRecovery(userId: string) {
    await this.unlock(userId, 'FIRST_RECOVERY');
  }

  async checkCollector(userId: string) {
    const streakCount = await this.prisma.streak.count({ where: { userId } });
    if (streakCount >= 5) await this.unlock(userId, 'COLLECTOR');
  }

  async checkLegend(userId: string, xp: number) {
    if (levelForXp(xp) >= 20) await this.unlock(userId, 'LEGEND');
  }
}

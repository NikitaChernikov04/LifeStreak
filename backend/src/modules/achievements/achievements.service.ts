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

  /**
   * Unlocks whichever of `keys` the user does not have yet.
   *
   * `unlock` costs two queries per key before it can even discover there is
   * nothing to do, and by day 46 a check-in asks about four keys it has held
   * for weeks — eight round trips to learn nothing. Asking once, for all of
   * them, turns the common case into a single trip; the writes that follow
   * only happen on the rare day something is actually earned.
   */
  private async unlockMissing(userId: string, keys: AchievementKey[]) {
    if (keys.length === 0) return;

    const [definitions, owned] = await this.prisma.$transaction([
      this.prisma.achievementDefinition.findMany({ where: { key: { in: keys } } }),
      this.prisma.userAchievement.findMany({ where: { userId }, select: { definitionId: true } }),
    ]);

    const missingDefinition = keys.filter((key) => !definitions.some((d) => d.key === key));
    if (missingDefinition.length > 0) {
      this.logger.warn(
        `Achievement definitions missing for ${missingDefinition.join(', ')} — did you run the seed?`,
      );
    }

    // Walked in the order the caller asked, not the order Postgres happened to
    // return rows in: when a single check-in earns two achievements at once,
    // the two notifications should arrive in the order the milestones were
    // reached rather than an order that can change between deploys.
    const ownedIds = new Set(owned.map((o) => o.definitionId));
    for (const key of keys) {
      const definition = definitions.find((d) => d.key === key);
      if (definition && !ownedIds.has(definition.id)) await this.unlock(userId, key);
    }
  }

  async checkStreakMilestones(userId: string, streak: Streak) {
    await this.unlockMissing(userId, this.streakMilestoneKeys(streak));
  }

  /**
   * The milestones a streak in this state qualifies for. Separate from the
   * unlocking so a caller that already asks about other keys can fold them
   * into the same question.
   */
  streakMilestoneKeys(streak: Streak): AchievementKey[] {
    const count = streak.currentCount;
    const keys: AchievementKey[] = [];
    if (count >= 7) keys.push('FIRST_WEEK');
    if (count >= 30) {
      keys.push('DAYS_30');
      if (streak.freezesUsedTotal === 0) keys.push('NO_MISSED_DAYS');
    }
    if (count >= 100) keys.push('DAYS_100');
    if (count >= 365) keys.push('DAYS_365');
    return keys;
  }

  /**
   * What a check-in earns, asked in one go. The milestones and LEGEND used to
   * be two separate walks over the achievement tables, on the app's most
   * frequent write.
   */
  async checkCheckinRewards(userId: string, streak: Streak, xp: number) {
    const keys = this.streakMilestoneKeys(streak);
    if (levelForXp(xp) >= 20) keys.push('LEGEND');
    await this.unlockMissing(userId, keys);
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

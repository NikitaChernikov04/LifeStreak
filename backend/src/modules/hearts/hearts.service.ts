import { BadRequestException, Injectable } from '@nestjs/common';
import { HeartReason } from '../../common/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class HeartsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Grants hearts, capped at the user's maxHearts. Returns the new heart count. */
  async grant(userId: string, reason: HeartReason, amount = 1): Promise<number> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.hearts >= user.maxHearts) {
      return user.hearts; // already full, no-op (no negative feedback for the user)
    }

    const granted = Math.min(amount, user.maxHearts - user.hearts);
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: { hearts: { increment: granted } },
      });
      await tx.heartTransaction.create({
        data: { userId, amount: granted, reason },
      });
      return u;
    });

    await this.notifications.create(userId, 'HEART_EARNED', 'Сердце получено! ❤️', this.reasonLabel(reason));
    return updated.hearts;
  }

  /** Spends one heart to recover a missed streak day. Throws if none available. */
  async spend(userId: string, reason: HeartReason, amount = 1): Promise<number> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.hearts < amount) {
      throw new BadRequestException('Недостаточно сердец для восстановления серии');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: { hearts: { decrement: amount } },
      });
      await tx.heartTransaction.create({
        data: { userId, amount: -amount, reason },
      });
      return u;
    });

    return updated.hearts;
  }

  private reasonLabel(reason: HeartReason): string {
    const labels: Record<HeartReason, string> = {
      DAILY_CHALLENGE: 'За выполнение ежедневного испытания',
      WEEK_STREAK_BONUS: 'За серию в 7 дней',
      STEPS_GOAL: 'За 15 000 шагов',
      INVITE_FRIEND: 'За приглашение друга',
      JOINED_BY_INVITE: 'За вход по приглашению друга',
      HELPED_FRIEND_RECOVER: 'За помощь другу',
      STREAK_RECOVERY_SPENT: 'Потрачено на восстановление серии',
      GROUP_GOAL_RESCUE_SPENT: 'Потрачено, чтобы спасти общую цель',
      GROUP_GOAL_COMPLETED: 'За доведённую до конца общую цель',
      GROUP_GOAL_HELD: 'За день, который ты закрыл, когда цель сорвалась',
      ACHIEVEMENT_BONUS: 'За достижение',
    };
    return labels[reason];
  }
}

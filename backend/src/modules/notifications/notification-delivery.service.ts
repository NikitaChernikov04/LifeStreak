import { Injectable } from '@nestjs/common';
import { NotificationType } from '../../common/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';

/**
 * Which notifications are worth a message in Telegram.
 *
 * The rule is one line long: a notification earns a DM when the user could not
 * have seen it happen. Everything caused by their own tap — a heart, a level,
 * an achievement, a group day they just closed — is already on screen when it
 * fires, and buzzing a phone about it is how an app teaches people to mute it.
 * What is left is other people: requests, reactions, invitations, and the two
 * facts nobody wants to learn late — the goal broke, or the goal was taken.
 */
const DELIVERED: ReadonlySet<NotificationType> = new Set<NotificationType>([
  'STREAK_REMINDER',
  'STREAK_AT_RISK',
  'FRIEND_INVITED',
  'FRIEND_REQUEST',
  'FRIEND_ACCEPTED',
  'REACTION_RECEIVED',
  'GROUP_GOAL_INVITE',
  'GROUP_GOAL_JOINED',
  'GROUP_GOAL_BROKEN',
  'GROUP_GOAL_COMPLETED',
]);

/**
 * Types where a burst is likely and only the first one carries information.
 * Three friends reacting to the same day is three buzzes for one fact.
 */
const THROTTLE_MS: Partial<Record<NotificationType, number>> = {
  REACTION_RECEIVED: 3 * 60 * 60 * 1000,
  GROUP_GOAL_JOINED: 60 * 60 * 1000,
};

/**
 * How recently the user has to have opened the app for us to assume they are
 * still looking at it. `lastSeenAt` is written on authentication, so this is a
 * coarse signal — it errs towards sending, which is the right way to be wrong.
 */
const PRESENT_WINDOW_MS = 3 * 60 * 1000;

@Injectable()
export class NotificationDeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
  ) {}

  /**
   * Delivers one already-stored notification, or decides not to. Returns what
   * happened for the benefit of the digest, which counts its own sends; the
   * request path ignores it.
   */
  async deliver(notificationId: string): Promise<'SENT' | 'SKIPPED'> {
    if (!this.telegram.enabled) return 'SKIPPED';

    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: { user: { select: { telegramId: true, dmEnabled: true, botBlocked: true, lastSeenAt: true } } },
    });
    if (!notification) return 'SKIPPED';

    const type = notification.type as NotificationType;
    const { user } = notification;
    if (!DELIVERED.has(type) || !user.dmEnabled || user.botBlocked) return 'SKIPPED';
    if (Date.now() - user.lastSeenAt.getTime() < PRESENT_WINDOW_MS) return 'SKIPPED';
    if (await this.throttled(notification.userId, type, notification.id, notification.createdAt)) {
      return 'SKIPPED';
    }

    const text = [
      `<b>${TelegramService.escape(notification.title)}</b>`,
      TelegramService.escape(notification.body),
    ].join('\n');

    const result = await this.telegram.sendMessage(user.telegramId, text, {
      button: { text: 'Открыть LifeStreak' },
    });
    if (result !== 'SENT') return 'SKIPPED';

    await this.prisma.notification.update({
      where: { id: notification.id },
      data: { deliveredAt: new Date() },
    });
    return 'SENT';
  }

  /** True when a message of this type went out recently enough to stand in for this one. */
  private async throttled(
    userId: string,
    type: NotificationType,
    exceptId: string,
    createdAt: Date,
  ): Promise<boolean> {
    const window = THROTTLE_MS[type];
    if (!window) return false;

    const previous = await this.prisma.notification.findFirst({
      where: {
        userId,
        type,
        id: { not: exceptId },
        deliveredAt: { gte: new Date(createdAt.getTime() - window) },
      },
      select: { id: true },
    });
    return Boolean(previous);
  }
}

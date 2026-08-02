import { Injectable } from '@nestjs/common';
import { NotificationType } from '../../common/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination-query.dto';
import { NotificationDeliveryService } from './notification-delivery.service';
import { TelegramService } from '../telegram/telegram.service';

export interface CreateOptions {
  /** Set false to keep a notification in the app only — see the group day. */
  dm?: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: NotificationDeliveryService,
    private readonly telegram: TelegramService,
  ) {}

  /**
   * Records a notification and, when the type warrants it, sends it on to
   * Telegram. Delivery is awaited rather than left running: a serverless
   * invocation may be frozen the moment it answers, and a message posted into
   * that gap is simply lost. It cannot fail loudly — the work it reports on
   * has already been committed by the time we get here.
   */
  async create(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    payload?: object,
    options: CreateOptions = {},
  ) {
    const notification = await this.prisma.notification.create({
      data: { userId, type, title, body, payload: payload ? JSON.stringify(payload) : undefined },
    });
    if (options.dm !== false) await this.delivery.deliver(notification.id);
    return this.deserialize(notification);
  }

  async findForUser(userId: string, query: PaginationQueryDto) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);
    return paginate(items.map((n) => this.deserialize(n)), total, query);
  }

  async markRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  /**
   * `botBlocked` is reported alongside the switch because the two look the
   * same from inside the app — silence — and have opposite cures. One is
   * turned back on here; the other can only be undone in the chat with the
   * bot, which is why the link comes with it.
   */
  async settings(userId: string) {
    const [user, botLink] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { dmEnabled: true, botBlocked: true },
      }),
      this.telegram.botLink(),
    ]);
    return { ...user, botLink };
  }

  async updateSettings(userId: string, dmEnabled: boolean) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { dmEnabled },
      select: { dmEnabled: true, botBlocked: true },
    });
    return { ...user, botLink: await this.telegram.botLink() };
  }

  /** SQLite has no native Json type — payload is stored as a JSON string. */
  private deserialize<T extends { payload: string | null }>(notification: T) {
    return { ...notification, payload: notification.payload ? JSON.parse(notification.payload) : null };
  }
}

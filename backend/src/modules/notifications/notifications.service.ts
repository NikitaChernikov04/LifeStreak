import { Injectable } from '@nestjs/common';
import { NotificationType } from '../../common/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination-query.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, type: NotificationType, title: string, body: string, payload?: object) {
    const notification = await this.prisma.notification.create({
      data: { userId, type, title, body, payload: payload ? JSON.stringify(payload) : undefined },
    });
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

  /** SQLite has no native Json type — payload is stored as a JSON string. */
  private deserialize<T extends { payload: string | null }>(notification: T) {
    return { ...notification, payload: notification.payload ? JSON.parse(notification.payload) : null };
  }
}

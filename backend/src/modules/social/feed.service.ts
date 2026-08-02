import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination-query.dto';
import { ReactionKey } from '../../common/enums';
import { SocialService } from './social.service';

interface ReactionRow {
  key: string;
  userId: string;
  user: { id: string; firstName: string; username: string | null };
}

@Injectable()
export class FeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly social: SocialService,
  ) {}

  /**
   * Checkins made by this user's friends, on streaks those friends chose to
   * share. Both conditions are re-read on every request rather than cached on
   * the checkin: ending a friendship or un-sharing a streak has to take the
   * entry out of the feed immediately, including entries already written.
   */
  async feed(userId: string, query: PaginationQueryDto) {
    const authorIds = await this.social.friendIds(userId);
    if (authorIds.length === 0) return paginate([], 0, query);

    const where = { userId: { in: authorIds }, streak: { is: { isShared: true } } };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.dailyCheckin.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
        select: {
          id: true,
          date: true,
          createdAt: true,
          usedHeart: true,
          user: {
            select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true, level: true },
          },
          streak: {
            select: { id: true, title: true, icon: true, color: true, currentCount: true, importedCount: true },
          },
          reactions: {
            select: { key: true, userId: true, user: { select: { id: true, firstName: true, username: true } } },
          },
        },
      }),
      this.prisma.dailyCheckin.count({ where }),
    ]);

    return paginate(
      rows.map((row) => ({ ...row, ...this.summarizeReactions(row.reactions, userId) })),
      total,
      query,
    );
  }

  /**
   * One reaction per person per checkin — reacting again replaces the previous
   * one. The notification fires only when a reaction first appears: switching
   * 🔥 for 👏 is not news worth a second buzz.
   */
  async react(userId: string, checkinId: string, key: ReactionKey) {
    const checkin = await this.prisma.dailyCheckin.findUnique({
      where: { id: checkinId },
      select: {
        id: true,
        userId: true,
        streak: { select: { id: true, title: true, icon: true, isShared: true } },
      },
    });
    if (!checkin) throw new NotFoundException('Отметка не найдена');
    if (checkin.userId === userId) throw new BadRequestException('Нельзя реагировать на свою отметку');
    if (!checkin.streak.isShared || !(await this.social.canView(userId, checkin.userId))) {
      throw new ForbiddenException('Эта отметка тебе не видна');
    }

    const existing = await this.prisma.reaction.findUnique({
      where: { checkinId_userId: { checkinId, userId } },
      select: { id: true, key: true },
    });

    if (existing) {
      if (existing.key !== key) {
        await this.prisma.reaction.update({ where: { id: existing.id }, data: { key } });
      }
    } else {
      await this.prisma.reaction.create({ data: { checkinId, userId, key } });

      const me = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { firstName: true, username: true },
      });
      const who = me.username ? `@${me.username}` : me.firstName;
      await this.notifications.create(
        checkin.userId,
        'REACTION_RECEIVED',
        'Тебя поддержали',
        `${who} отреагировал на «${checkin.streak.title}»`,
        { checkinId, streakId: checkin.streak.id, userId },
      );
    }

    return this.reactionsFor(checkinId, userId);
  }

  async unreact(userId: string, checkinId: string) {
    await this.prisma.reaction.deleteMany({ where: { checkinId, userId } });
    return this.reactionsFor(checkinId, userId);
  }

  private async reactionsFor(checkinId: string, viewerId: string) {
    const reactions = await this.prisma.reaction.findMany({
      where: { checkinId },
      select: { key: true, userId: true, user: { select: { id: true, firstName: true, username: true } } },
    });
    return { checkinId, ...this.summarizeReactions(reactions, viewerId) };
  }

  /** Collapses raw rows into per-key counts plus the viewer's own choice. */
  private summarizeReactions(reactions: ReactionRow[], viewerId: string) {
    const counts = new Map<string, number>();
    for (const r of reactions) counts.set(r.key, (counts.get(r.key) ?? 0) + 1);

    return {
      reactions: [...counts.entries()]
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
      reactionCount: reactions.length,
      myReaction: reactions.find((r) => r.userId === viewerId)?.key ?? null,
      reactedBy: reactions.slice(0, 8).map((r) => r.user),
    };
  }
}

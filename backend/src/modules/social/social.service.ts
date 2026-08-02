import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdatePrivacyDto } from './dto/social.dto';

/** How the viewer stands in relation to another account. */
export type FollowState = 'SELF' | 'NONE' | 'PENDING' | 'ACCEPTED';

const USER_CARD = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  avatarUrl: true,
  level: true,
} as const;

/** Fields of a streak that a follower is allowed to see. */
const SHARED_STREAK = {
  id: true,
  title: true,
  icon: true,
  color: true,
  currentCount: true,
  longestCount: true,
  importedCount: true,
  status: true,
  lastCheckinAt: true,
} as const;

@Injectable()
export class SocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── settings ────────────────────────────────────────────────

  async getSettings(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { profileVisibility: true, isDiscoverable: true },
    });

    const [followers, following, pendingRequests] = await Promise.all([
      this.prisma.follow.count({ where: { followingId: userId, status: 'ACCEPTED' } }),
      this.prisma.follow.count({ where: { followerId: userId, status: 'ACCEPTED' } }),
      this.prisma.follow.count({ where: { followingId: userId, status: 'PENDING' } }),
    ]);

    const streaks = await this.prisma.streak.findMany({
      where: { userId, status: { not: 'ARCHIVED' } },
      select: { id: true, title: true, icon: true, isShared: true, currentCount: true },
      orderBy: { createdAt: 'asc' },
    });

    return { ...user, followers, following, pendingRequests, streaks };
  }

  /**
   * Loosening visibility to OPEN admits everyone already waiting: a pending
   * request is a question this setting has just answered. Tightening it back
   * to PRIVATE leaves existing followers alone — revoking access is a separate,
   * deliberate act (removeFollower), not a side effect of a settings toggle.
   */
  async updateSettings(userId: string, dto: UpdatePrivacyDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: { profileVisibility: true, isDiscoverable: true },
    });

    if (dto.profileVisibility === 'OPEN') {
      const pending = await this.prisma.follow.findMany({
        where: { followingId: userId, status: 'PENDING' },
        select: { id: true, followerId: true },
      });
      if (pending.length > 0) {
        await this.prisma.follow.updateMany({
          where: { id: { in: pending.map((f) => f.id) } },
          data: { status: 'ACCEPTED', respondedAt: new Date() },
        });
        await Promise.all(pending.map((f) => this.notifyAccepted(f.followerId, userId)));
      }
    }

    return this.getSettings(userId);
  }

  async setStreakSharing(userId: string, streakId: string, isShared: boolean) {
    const streak = await this.prisma.streak.findUnique({ where: { id: streakId } });
    if (!streak) throw new NotFoundException('Серия не найдена');
    if (streak.userId !== userId) throw new ForbiddenException();

    return this.prisma.streak.update({
      where: { id: streakId },
      data: { isShared },
      select: { id: true, isShared: true },
    });
  }

  // ── graph ───────────────────────────────────────────────────

  /**
   * A request to an OPEN profile is accepted on the spot; a PRIVATE one waits
   * for its owner. Re-requesting an existing follow is a no-op rather than an
   * error — the button that triggers it may simply have been tapped twice.
   */
  async follow(userId: string, targetId: string) {
    if (userId === targetId) throw new BadRequestException('Нельзя подписаться на себя');

    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, profileVisibility: true, firstName: true, username: true },
    });
    if (!target) throw new NotFoundException('Пользователь не найден');

    const existing = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: userId, followingId: targetId } },
    });
    if (existing) return { status: existing.status as FollowState };

    const autoAccept = target.profileVisibility === 'OPEN';
    const follow = await this.prisma.follow.create({
      data: {
        followerId: userId,
        followingId: targetId,
        status: autoAccept ? 'ACCEPTED' : 'PENDING',
        respondedAt: autoAccept ? new Date() : null,
      },
    });

    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { firstName: true, username: true },
    });
    const who = me.username ? `@${me.username}` : me.firstName;

    await this.notifications.create(
      targetId,
      autoAccept ? 'NEW_FOLLOWER' : 'FOLLOW_REQUEST',
      autoAccept ? 'Новый подписчик' : 'Заявка на подписку',
      autoAccept
        ? `${who} теперь следит за твоим прогрессом`
        : `${who} хочет видеть твой прогресс — подтверди или отклони`,
      { followId: follow.id, userId },
    );

    return { status: follow.status as FollowState };
  }

  async unfollow(userId: string, targetId: string) {
    await this.prisma.follow.deleteMany({ where: { followerId: userId, followingId: targetId } });
    return { status: 'NONE' as FollowState };
  }

  /** Cuts off someone who already follows you. */
  async removeFollower(userId: string, followerId: string) {
    await this.prisma.follow.deleteMany({ where: { followerId, followingId: userId } });
    return { ok: true };
  }

  async incomingRequests(userId: string) {
    const rows = await this.prisma.follow.findMany({
      where: { followingId: userId, status: 'PENDING' },
      select: { id: true, createdAt: true, follower: { select: USER_CARD } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({ id: r.id, createdAt: r.createdAt, user: r.follower }));
  }

  /**
   * Declining deletes the row instead of parking it in a DECLINED state: the
   * asker is never told "no" explicitly, and can ask again later if things
   * change. A permanent refusal is what blocking would be, and that is a
   * different feature.
   */
  async respondToRequest(userId: string, followId: string, accept: boolean) {
    const request = await this.prisma.follow.findUnique({ where: { id: followId } });
    if (!request || request.followingId !== userId) throw new NotFoundException('Заявка не найдена');
    if (request.status !== 'PENDING') throw new BadRequestException('Заявка уже обработана');

    if (!accept) {
      await this.prisma.follow.delete({ where: { id: followId } });
      return { status: 'NONE' as FollowState };
    }

    await this.prisma.follow.update({
      where: { id: followId },
      data: { status: 'ACCEPTED', respondedAt: new Date() },
    });
    await this.notifyAccepted(request.followerId, userId);
    return { status: 'ACCEPTED' as FollowState };
  }

  async listFollowing(userId: string) {
    const rows = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { status: true, following: { select: USER_CARD } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({ ...r.following, followState: r.status as FollowState }));
  }

  async listFollowers(userId: string) {
    const rows = await this.prisma.follow.findMany({
      where: { followingId: userId, status: 'ACCEPTED' },
      select: { follower: { select: USER_CARD } },
      orderBy: { createdAt: 'desc' },
    });
    const followers = rows.map((r) => r.follower);
    const back = await this.prisma.follow.findMany({
      where: { followerId: userId, followingId: { in: followers.map((f) => f.id) } },
      select: { followingId: true, status: true },
    });
    const backMap = new Map(back.map((b) => [b.followingId, b.status as FollowState]));
    return followers.map((f) => ({ ...f, followState: backMap.get(f.id) ?? ('NONE' as FollowState) }));
  }

  /**
   * Search runs in memory over discoverable accounts. SQLite's LIKE only folds
   * case for ASCII, so a Cyrillic query would otherwise miss "Никита" typed as
   * "никита". At a few thousand users this needs a normalized, indexed column
   * instead — the cap keeps the shortcut from silently becoming a table scan.
   */
  async searchUsers(userId: string, query: string) {
    const needle = query.trim().toLowerCase().replace(/^@/, '');
    if (needle.length < 2) return [];

    const candidates = await this.prisma.user.findMany({
      where: { isDiscoverable: true, id: { not: userId } },
      select: { ...USER_CARD, profileVisibility: true },
      orderBy: { lastSeenAt: 'desc' },
      take: 500,
    });

    const matches = candidates
      .filter(
        (u) =>
          u.username?.toLowerCase().includes(needle) ||
          u.firstName.toLowerCase().includes(needle) ||
          u.lastName?.toLowerCase().includes(needle),
      )
      .slice(0, 20);

    return this.withFollowState(userId, matches);
  }

  // ── profile ─────────────────────────────────────────────────

  /**
   * Returns the profile as this viewer is allowed to see it. A profile the
   * viewer may not read still returns its owner's name and level: that is what
   * they saw in search, and hiding it would leave them unable to tell whom
   * they just asked to follow.
   */
  async getProfile(viewerId: string, targetId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { ...USER_CARD, xp: true, profileVisibility: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('Пользователь не найден');

    const [state] = await this.withFollowState(viewerId, [user]);
    const canView = state.followState === 'SELF' || state.followState === 'ACCEPTED';

    const [followers, following] = await Promise.all([
      this.prisma.follow.count({ where: { followingId: targetId, status: 'ACCEPTED' } }),
      this.prisma.follow.count({ where: { followerId: targetId, status: 'ACCEPTED' } }),
    ]);

    if (!canView) {
      return { ...state, canView, streaks: [], statistics: null, followers, following };
    }

    const isSelf = state.followState === 'SELF';
    const [streaks, statistics] = await Promise.all([
      this.prisma.streak.findMany({
        where: {
          userId: targetId,
          status: { not: 'ARCHIVED' },
          ...(isSelf ? {} : { isShared: true }),
        },
        select: SHARED_STREAK,
        orderBy: [{ currentCount: 'desc' }],
      }),
      this.prisma.statistics.findUnique({
        where: { userId: targetId },
        select: {
          totalXp: true,
          totalCheckins: true,
          activeStreaksCount: true,
          longestStreakEver: true,
        },
      }),
    ]);

    return { ...state, canView, streaks, statistics, followers, following };
  }

  /** True when `viewerId` is allowed to read `targetId`'s shared content. */
  async canView(viewerId: string, targetId: string): Promise<boolean> {
    if (viewerId === targetId) return true;
    const follow = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: targetId } },
      select: { status: true },
    });
    return follow?.status === 'ACCEPTED';
  }

  private async withFollowState<T extends { id: string }>(viewerId: string, users: T[]) {
    const others = users.filter((u) => u.id !== viewerId).map((u) => u.id);
    const [outgoing, incoming] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followerId: viewerId, followingId: { in: others } },
        select: { followingId: true, status: true },
      }),
      this.prisma.follow.findMany({
        where: { followerId: { in: others }, followingId: viewerId, status: 'ACCEPTED' },
        select: { followerId: true },
      }),
    ]);

    const outMap = new Map(outgoing.map((f) => [f.followingId, f.status as FollowState]));
    const followsMe = new Set(incoming.map((f) => f.followerId));

    return users.map((u) => ({
      ...u,
      followState: (u.id === viewerId ? 'SELF' : (outMap.get(u.id) ?? 'NONE')) as FollowState,
      followsMe: followsMe.has(u.id),
    }));
  }

  private async notifyAccepted(followerId: string, targetId: string) {
    const target = await this.prisma.user.findUniqueOrThrow({
      where: { id: targetId },
      select: { firstName: true, username: true },
    });
    const who = target.username ? `@${target.username}` : target.firstName;
    await this.notifications.create(
      followerId,
      'FOLLOW_ACCEPTED',
      'Заявка принята',
      `${who} открыл тебе свой прогресс`,
      { userId: targetId },
    );
  }
}

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdatePrivacyDto } from './dto/social.dto';

/**
 * How the viewer stands towards another account.
 * INCOMING/OUTGOING distinguish who is waiting on whom — the two states need
 * different buttons, and collapsing them into "PENDING" would ask the person
 * who was invited to invite back.
 */
export type FriendState = 'SELF' | 'NONE' | 'OUTGOING' | 'INCOMING' | 'FRIENDS';

const USER_CARD = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  avatarUrl: true,
  level: true,
} as const;

/** Fields of a streak a friend is allowed to see. */
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
      select: { isDiscoverable: true },
    });

    const [friends, pendingRequests, streaks] = await Promise.all([
      this.countFriends(userId),
      this.prisma.friendship.count({ where: { addresseeId: userId, status: 'PENDING' } }),
      this.prisma.streak.findMany({
        where: { userId, status: { not: 'ARCHIVED' } },
        select: { id: true, title: true, icon: true, isShared: true, currentCount: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return { ...user, friends, pendingRequests, streaks };
  }

  async updateSettings(userId: string, dto: UpdatePrivacyDto) {
    await this.prisma.user.update({ where: { id: userId }, data: dto });
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
   * Sending a request when the other side already sent one is not a second
   * row — two people asking for the same thing have agreed, so the pending
   * request is accepted instead.
   */
  async request(userId: string, targetId: string) {
    if (userId === targetId) throw new BadRequestException('Нельзя добавить в друзья себя');

    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('Пользователь не найден');

    const existing = await this.findEdge(userId, targetId);
    if (existing) {
      if (existing.status === 'ACCEPTED') return { status: 'FRIENDS' as FriendState };
      if (existing.requesterId === userId) return { status: 'OUTGOING' as FriendState };
      return this.respond(userId, existing.id, true);
    }

    await this.prisma.friendship.create({
      data: { requesterId: userId, addresseeId: targetId },
    });

    await this.notifications.create(
      targetId,
      'FRIEND_REQUEST',
      'Заявка в друзья',
      `${await this.nameOf(userId)} хочет дружить — подтверди или отклони`,
      { userId },
    );

    return { status: 'OUTGOING' as FriendState };
  }

  /**
   * Accepting is symmetric: from here both sides read each other on the same
   * terms, so only one notification is needed — the one who asked.
   */
  async respond(userId: string, friendshipId: string, accept: boolean) {
    const friendship = await this.prisma.friendship.findUnique({ where: { id: friendshipId } });
    if (!friendship || friendship.addresseeId !== userId) {
      throw new NotFoundException('Заявка не найдена');
    }
    if (friendship.status !== 'PENDING') throw new BadRequestException('Заявка уже обработана');

    if (!accept) {
      await this.prisma.friendship.delete({ where: { id: friendshipId } });
      return { status: 'NONE' as FriendState };
    }

    await this.prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: 'ACCEPTED', respondedAt: new Date() },
    });

    await this.notifications.create(
      friendship.requesterId,
      'FRIEND_ACCEPTED',
      'Теперь вы друзья',
      `${await this.nameOf(userId)} принял заявку — вам видны записи друг друга`,
      { userId },
    );

    return { status: 'FRIENDS' as FriendState };
  }

  /** Cancels an outgoing request, declines an incoming one, or ends a friendship. */
  async remove(userId: string, targetId: string) {
    const edge = await this.findEdge(userId, targetId);
    if (edge) await this.prisma.friendship.delete({ where: { id: edge.id } });
    return { status: 'NONE' as FriendState };
  }

  async listFriends(userId: string) {
    const rows = await this.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: {
        requester: { select: USER_CARD },
        addressee: { select: USER_CARD },
        requesterId: true,
      },
      orderBy: { respondedAt: 'desc' },
    });

    return rows.map((row) => ({
      ...(row.requesterId === userId ? row.addressee : row.requester),
      friendState: 'FRIENDS' as FriendState,
    }));
  }

  async incomingRequests(userId: string) {
    const rows = await this.prisma.friendship.findMany({
      where: { addresseeId: userId, status: 'PENDING' },
      select: { id: true, createdAt: true, requester: { select: USER_CARD } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({ id: r.id, createdAt: r.createdAt, user: r.requester }));
  }

  async outgoingRequests(userId: string) {
    const rows = await this.prisma.friendship.findMany({
      where: { requesterId: userId, status: 'PENDING' },
      select: { id: true, createdAt: true, addressee: { select: USER_CARD } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      ...r.addressee,
      friendState: 'OUTGOING' as FriendState,
      requestedAt: r.createdAt,
    }));
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
      select: USER_CARD,
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

    return this.withFriendState(userId, matches);
  }

  // ── profile ─────────────────────────────────────────────────

  /**
   * The profile as this viewer may see it. A stranger still gets the name and
   * level they already saw in search — hiding those would leave them unable to
   * tell whom they just asked to befriend — but nothing else.
   */
  async getProfile(viewerId: string, targetId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { ...USER_CARD, xp: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('Пользователь не найден');

    const [state] = await this.withFriendState(viewerId, [user]);
    const canView = state.friendState === 'SELF' || state.friendState === 'FRIENDS';
    const friends = await this.countFriends(targetId);

    if (!canView) {
      return { ...state, canView, streaks: [], statistics: null, friends };
    }

    const isSelf = state.friendState === 'SELF';
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

    return {
      ...state,
      canView,
      streaks,
      friends,
      statistics: statistics && {
        ...statistics,
        // The stored count includes hidden streaks, and printing it would let
        // a friend subtract and learn how many are being kept from them —
        // the same inference the profile deliberately does not offer.
        activeStreaksCount: isSelf ? statistics.activeStreaksCount : streaks.length,
      },
    };
  }

  /**
   * Ranks the user against their friends by the longest streak each of them
   * is currently holding. The number counts every active streak, shared or
   * not — competing on it is what the user asked for, and a bare figure says
   * how long, never what. Titles stay behind the per-streak flag.
   *
   * Ties share a rank and the next one skips, the way a scoreboard reads:
   * two firsts are followed by a third, not a second.
   */
  async leaderboard(userId: string) {
    const ids = [userId, ...(await this.friendIds(userId))];

    const [people, best, stats] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: ids } }, select: USER_CARD }),
      this.prisma.streak.groupBy({
        by: ['userId'],
        where: { userId: { in: ids }, status: 'ACTIVE' },
        _max: { currentCount: true },
      }),
      this.prisma.statistics.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, totalCheckins: true },
      }),
    ]);

    const bestBy = new Map(best.map((row) => [row.userId, row._max.currentCount ?? 0]));
    const checkinsBy = new Map(stats.map((row) => [row.userId, row.totalCheckins]));

    const rows = people
      .map((person) => ({
        ...person,
        isMe: person.id === userId,
        bestStreak: bestBy.get(person.id) ?? 0,
        totalCheckins: checkinsBy.get(person.id) ?? 0,
      }))
      .sort(
        (a, b) =>
          b.bestStreak - a.bestStreak ||
          b.totalCheckins - a.totalCheckins ||
          a.firstName.localeCompare(b.firstName, 'ru'),
      );

    let rank = 0;
    let previous: number | null = null;
    return rows.map((row, index) => {
      if (row.bestStreak !== previous) {
        rank = index + 1;
        previous = row.bestStreak;
      }
      return { ...row, rank };
    });
  }

  /** True when the two are friends — the only relation that grants reading. */
  async canView(viewerId: string, targetId: string): Promise<boolean> {
    if (viewerId === targetId) return true;
    const edge = await this.findEdge(viewerId, targetId);
    return edge?.status === 'ACCEPTED';
  }

  /** Ids of everyone this user is actually friends with, both directions. */
  async friendIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.friendship.findMany({
      where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] },
      select: { requesterId: true, addresseeId: true },
    });
    return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
  }

  /** The single row between two people, whichever way round it was written. */
  private async findEdge(a: string, b: string) {
    return this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: a, addresseeId: b },
          { requesterId: b, addresseeId: a },
        ],
      },
    });
  }

  private countFriends(userId: string) {
    return this.prisma.friendship.count({
      where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] },
    });
  }

  private async withFriendState<T extends { id: string }>(viewerId: string, users: T[]) {
    const others = users.filter((u) => u.id !== viewerId).map((u) => u.id);
    const edges = await this.prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: viewerId, addresseeId: { in: others } },
          { addresseeId: viewerId, requesterId: { in: others } },
        ],
      },
      select: { requesterId: true, addresseeId: true, status: true },
    });

    const states = new Map<string, FriendState>();
    for (const edge of edges) {
      const other = edge.requesterId === viewerId ? edge.addresseeId : edge.requesterId;
      states.set(
        other,
        edge.status === 'ACCEPTED'
          ? 'FRIENDS'
          : edge.requesterId === viewerId
            ? 'OUTGOING'
            : 'INCOMING',
      );
    }

    return users.map((u) => ({
      ...u,
      friendState: (u.id === viewerId ? 'SELF' : (states.get(u.id) ?? 'NONE')) as FriendState,
    }));
  }

  private async nameOf(userId: string): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { firstName: true, username: true },
    });
    return user.username ? `@${user.username}` : user.firstName;
  }
}

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { HeartsService } from '../hearts/hearts.service';
import { UsersService } from '../users/users.service';
import { SocialService } from './social.service';
import { CreateGoalDto } from './dto/social.dto';
import { ONE_DAY_MS, daysBetween, todayUtc } from '../../common/utils/date.util';

/** XP each member earns on a day the whole group closed. */
const GROUP_DAY_XP = 25;

const MEMBER_CARD = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  avatarUrl: true,
  level: true,
} as const;

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly hearts: HeartsService,
    private readonly users: UsersService,
    private readonly social: SocialService,
  ) {}

  /**
   * Goals this user holds or has been invited to. Every read refreshes state
   * first: with no scheduler in production, a goal that broke overnight is
   * only noticed when somebody opens the app, and it has to be noticed then
   * rather than silently keep counting.
   */
  async listMine(userId: string) {
    const memberships = await this.prisma.groupGoalMember.findMany({
      where: { userId, status: { in: ['INVITED', 'JOINED'] } },
      select: { goalId: true },
    });
    const ids = memberships.map((m) => m.goalId);
    if (ids.length === 0) return [];

    const goals = await this.prisma.groupGoal.findMany({
      where: { id: { in: ids }, status: { not: 'ABANDONED' } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

    return Promise.all(goals.map((goal) => this.present(goal.id, userId)));
  }

  /**
   * The creator joins their own goal immediately — proposing it is agreeing
   * to it. Everyone else is invited, and the goal does not wait on them until
   * they accept.
   */
  async create(userId: string, dto: CreateGoalDto) {
    const invitees = [...new Set(dto.memberIds)].filter((id) => id !== userId);
    if (invitees.length === 0) {
      throw new BadRequestException('Позови хотя бы одного друга — цель общая');
    }

    for (const id of invitees) {
      if (!(await this.social.canView(userId, id))) {
        throw new ForbiddenException('Звать можно только друзей');
      }
    }

    const goal = await this.prisma.groupGoal.create({
      data: {
        title: dto.title,
        icon: dto.icon,
        color: dto.color,
        targetDays: dto.targetDays,
        ownerId: userId,
        members: {
          create: [
            { userId, status: 'JOINED', joinedAt: new Date() },
            ...invitees.map((id) => ({ userId: id })),
          ],
        },
      },
    });

    const who = await this.nameOf(userId);
    await Promise.all(
      invitees.map((id) =>
        this.notifications.create(
          id,
          'GROUP_GOAL_INVITE',
          'Общая цель',
          `${who} зовёт держать «${dto.title}» вместе — ${dto.targetDays} дней`,
          { goalId: goal.id },
        ),
      ),
    );

    return this.present(goal.id, userId);
  }

  async join(userId: string, goalId: string) {
    const member = await this.memberOrThrow(goalId, userId);
    if (member.status === 'JOINED') return this.present(goalId, userId);

    await this.prisma.groupGoalMember.update({
      where: { id: member.id },
      data: { status: 'JOINED', joinedAt: new Date() },
    });

    const goal = await this.prisma.groupGoal.findUniqueOrThrow({ where: { id: goalId } });
    const others = await this.joinedMemberIds(goalId);
    const who = await this.nameOf(userId);
    await Promise.all(
      others
        .filter((id) => id !== userId)
        .map((id) =>
          this.notifications.create(
            id,
            'GROUP_GOAL_JOINED',
            'В цели прибавилось',
            `${who} присоединился к «${goal.title}»`,
            { goalId },
          ),
        ),
    );

    return this.present(goalId, userId);
  }

  /**
   * Leaving is also how an invitation is declined. The owner leaving ends the
   * goal for everyone: it was their proposal, and a goal nobody proposed has
   * no one to answer for it.
   */
  async leave(userId: string, goalId: string) {
    const goal = await this.prisma.groupGoal.findUnique({ where: { id: goalId } });
    if (!goal) throw new NotFoundException('Цель не найдена');
    const member = await this.memberOrThrow(goalId, userId);

    if (goal.ownerId === userId) {
      await this.prisma.groupGoal.update({
        where: { id: goalId },
        data: { status: 'ABANDONED' },
      });
      return { ok: true, abandoned: true };
    }

    await this.prisma.groupGoalMember.delete({ where: { id: member.id } });
    return { ok: true, abandoned: false };
  }

  /** Marks today for this member, and credits the group day if that was the last one. */
  async checkin(userId: string, goalId: string) {
    const goal = await this.refresh(goalId);
    if (goal.status !== 'ACTIVE') throw new BadRequestException('Эта цель уже закрыта');

    const member = await this.memberOrThrow(goalId, userId);
    if (member.status !== 'JOINED') throw new BadRequestException('Сначала прими приглашение');

    const today = todayUtc();
    const existing = await this.prisma.groupGoalCheckin.findUnique({
      where: { goalId_userId_date: { goalId, userId, date: today } },
    });
    if (existing) throw new BadRequestException('Сегодня уже отмечено — заходи завтра');

    await this.prisma.groupGoalCheckin.create({ data: { goalId, userId, date: today } });
    await this.settle(goalId, today);

    return this.present(goalId, userId);
  }

  /**
   * Spends a heart to close yesterday for this member. Only the day that broke
   * the chain can be bought back, and only by the person who missed it — the
   * point is that one member can save the group, not that the group can be
   * carried indefinitely.
   */
  async rescue(userId: string, goalId: string) {
    const goal = await this.refresh(goalId);
    if (goal.status !== 'ACTIVE') throw new BadRequestException('Эта цель уже закрыта');

    const member = await this.memberOrThrow(goalId, userId);
    if (member.status !== 'JOINED') throw new BadRequestException('Ты не участник этой цели');

    const yesterday = new Date(todayUtc().getTime() - ONE_DAY_MS);
    if (!this.isAtRisk(goal)) {
      throw new BadRequestException('Спасать нечего — вчерашний день не рвёт цепочку');
    }
    if (member.joinedAt && daysBetween(member.joinedAt, yesterday) < 0) {
      throw new BadRequestException('Вчера ты ещё не был в цели');
    }

    const already = await this.prisma.groupGoalCheckin.findUnique({
      where: { goalId_userId_date: { goalId, userId, date: yesterday } },
    });
    if (already) throw new BadRequestException('Вчерашний день уже закрыт');

    await this.hearts.spend(userId, 'GROUP_GOAL_RESCUE_SPENT');
    await this.prisma.groupGoalCheckin.create({
      data: { goalId, userId, date: yesterday, usedHeart: true },
    });

    await this.settle(goalId, yesterday);
    return this.present(goalId, userId);
  }

  // ── mechanics ───────────────────────────────────────────────

  /**
   * Credits `date` to the group if every joined member has marked it, then
   * checks whether that finished the goal. Called after any mark, including a
   * heart rescue closing yesterday — which is exactly how a day already lost
   * comes back.
   */
  private async settle(goalId: string, date: Date) {
    const goal = await this.prisma.groupGoal.findUniqueOrThrow({ where: { id: goalId } });
    if (goal.status !== 'ACTIVE') return;
    if (goal.lastCountedDate && daysBetween(goal.lastCountedDate, date) <= 0) return;

    const members = await this.joinedMemberIds(goalId);
    const marks = await this.prisma.groupGoalCheckin.count({
      where: { goalId, date, userId: { in: members } },
    });
    if (marks < members.length) return;

    // A closed day only extends the chain when it sits right after the last
    // one. Closing today while yesterday is still open would quietly paper
    // over the gap, so that day starts the count again at one instead.
    const continues = !goal.lastCountedDate || daysBetween(goal.lastCountedDate, date) === 1;
    const nextCount = continues ? goal.currentCount + 1 : 1;
    const reachedTarget = nextCount >= goal.targetDays;

    await this.prisma.groupGoal.update({
      where: { id: goalId },
      data: {
        currentCount: nextCount,
        lastCountedDate: date,
        ...(reachedTarget ? { status: 'COMPLETED', completedAt: new Date() } : {}),
      },
    });

    for (const memberId of members) {
      await this.users.grantXp(memberId, GROUP_DAY_XP);
      await this.notifications.create(
        memberId,
        reachedTarget ? 'GROUP_GOAL_COMPLETED' : 'GROUP_GOAL_DAY',
        reachedTarget ? 'Цель взята! 🎯' : 'День засчитан группе',
        reachedTarget
          ? `«${goal.title}» — ${goal.targetDays} дней вместе. Держались все.`
          : `Все отметились: «${goal.title}» — день ${nextCount} из ${goal.targetDays}`,
        { goalId },
      );
      if (reachedTarget) await this.hearts.grant(memberId, 'GROUP_GOAL_COMPLETED');
    }
  }

  /**
   * Brings a goal's state up to date with the calendar.
   *
   * The chain survives a gap of two days, not one: if the last credited day
   * was the day before yesterday, then yesterday is missing but can still be
   * bought back with a heart, and zeroing the count on sight would make that
   * rescue impossible to reach. One more day without a full house and the
   * count goes to zero — the same window a personal streak gets.
   */
  private async refresh(goalId: string) {
    const goal = await this.prisma.groupGoal.findUnique({ where: { id: goalId } });
    if (!goal) throw new NotFoundException('Цель не найдена');
    if (goal.status !== 'ACTIVE') return goal;
    if (goal.currentCount === 0 || !goal.lastCountedDate) return goal;

    const gap = daysBetween(goal.lastCountedDate, todayUtc());
    if (gap <= 2) return goal;

    const broken = await this.prisma.groupGoal.update({
      where: { id: goalId },
      data: { currentCount: 0 },
    });

    const members = await this.joinedMemberIds(goalId);
    await Promise.all(
      members.map((id) =>
        this.notifications.create(
          id,
          'GROUP_GOAL_BROKEN',
          'Общая цель сорвалась',
          `«${goal.title}» обнулилась: день закрыли не все. Счёт начинается заново.`,
          { goalId },
        ),
      ),
    );

    return broken;
  }

  /** The goal as this member sees it: progress, who marked today, what they can do. */
  private async present(goalId: string, viewerId: string) {
    const goal = await this.refresh(goalId);
    const today = todayUtc();
    const yesterday = new Date(today.getTime() - ONE_DAY_MS);

    const [members, todayMarks, yesterdayMarks, viewer] = await Promise.all([
      this.prisma.groupGoalMember.findMany({
        where: { goalId },
        select: { userId: true, status: true, user: { select: MEMBER_CARD } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.groupGoalCheckin.findMany({ where: { goalId, date: today }, select: { userId: true } }),
      this.prisma.groupGoalCheckin.findMany({
        where: { goalId, date: yesterday },
        select: { userId: true },
      }),
      this.prisma.groupGoalMember.findUnique({
        where: { goalId_userId: { goalId, userId: viewerId } },
        select: { status: true, joinedAt: true },
      }),
    ]);

    const markedToday = new Set(todayMarks.map((m) => m.userId));
    const markedYesterday = new Set(yesterdayMarks.map((m) => m.userId));
    const joined = members.filter((m) => m.status === 'JOINED');

    // Yesterday is worth a heart only while it is the day standing between
    // the group and its streak. Offering the button at any other time would
    // sell a rescue that rescues nothing.
    const atRisk = this.isAtRisk(goal);
    const canRescue =
      atRisk &&
      viewer?.status === 'JOINED' &&
      !markedYesterday.has(viewerId) &&
      Boolean(viewer.joinedAt && daysBetween(viewer.joinedAt, yesterday) >= 0);

    return {
      id: goal.id,
      title: goal.title,
      icon: goal.icon,
      color: goal.color,
      targetDays: goal.targetDays,
      currentCount: goal.currentCount,
      status: goal.status,
      ownerId: goal.ownerId,
      isOwner: goal.ownerId === viewerId,
      completedAt: goal.completedAt,
      myStatus: viewer?.status ?? null,
      markedToday: markedToday.has(viewerId),
      atRisk,
      canRescue,
      waitingOn: joined
        .filter((m) => !markedToday.has(m.userId))
        .map((m) => ({ ...m.user, isMe: m.userId === viewerId })),
      members: joined.map((m) => ({
        ...m.user,
        isMe: m.userId === viewerId,
        markedToday: markedToday.has(m.userId),
      })),
      invited: members.filter((m) => m.status === 'INVITED').map((m) => m.user),
    };
  }

  /**
   * True when yesterday is the one day missing from an otherwise unbroken
   * chain — the only moment a heart changes anything.
   */
  private isAtRisk(goal: { status: string; currentCount: number; lastCountedDate: Date | null }) {
    if (goal.status !== 'ACTIVE' || goal.currentCount === 0 || !goal.lastCountedDate) return false;
    return daysBetween(goal.lastCountedDate, todayUtc()) === 2;
  }

  private async memberOrThrow(goalId: string, userId: string) {
    const member = await this.prisma.groupGoalMember.findUnique({
      where: { goalId_userId: { goalId, userId } },
    });
    if (!member) throw new ForbiddenException('Ты не участник этой цели');
    return member;
  }

  private async joinedMemberIds(goalId: string): Promise<string[]> {
    const rows = await this.prisma.groupGoalMember.findMany({
      where: { goalId, status: 'JOINED' },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  private async nameOf(userId: string): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { firstName: true, username: true },
    });
    return user.username ? `@${user.username}` : user.firstName;
  }
}

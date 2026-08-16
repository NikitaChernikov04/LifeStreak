import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { GroupGoal, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { HeartsService } from '../hearts/hearts.service';
import { UsersService } from '../users/users.service';
import { SocialService } from './social.service';
import { ProofStorageService } from './proof-storage.service';
import { CheckinGoalDto, CreateGoalDto, ProofsQueryDto } from './dto/social.dto';
import { paginate } from '../../common/dto/pagination-query.dto';
import { GoalMode } from '../../common/enums';
import { ONE_DAY_MS, daysBetween, toUtcDate, todayUtc } from '../../common/utils/date.util';

/** XP each member earns on a day the whole group closed. */
const GROUP_DAY_XP = 25;

/**
 * XP for a day in a competition. Lower than the joint one on purpose: there
 * the day is only credited once everybody delivered, which is the harder
 * thing and the one worth paying more for.
 */
const VERSUS_DAY_XP = 15;

/** The most recent evidence shown on a competition's card. */
const PROOF_FEED_SIZE = 12;

const MEMBER_CARD = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  avatarUrl: true,
  level: true,
} as const;

type GoalRow = GroupGoal;

/** A member the sprint scoring can consider, with the date they came in on. */
type Entrant = Prisma.GroupGoalMemberGetPayload<{
  select: { userId: true; joinedAt: true; user: { select: typeof MEMBER_CARD } };
}>;

/** Just enough of a checkin to score sprints with. */
type Mark = Prisma.GroupGoalCheckinGetPayload<{ select: { userId: true; date: true } }>;

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly hearts: HeartsService,
    private readonly users: UsersService,
    private readonly social: SocialService,
    private readonly storage: ProofStorageService,
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

    const mode: GoalMode = dto.mode ?? 'TOGETHER';
    const versus = mode === 'VERSUS';

    // A competition is measured in sprints, so its length is a product rather
    // than a number somebody typed — that is what guarantees the last sprint
    // is the same size as the first.
    if (versus && (!dto.sprintDays || !dto.sprintCount)) {
      throw new BadRequestException('У соревнования нужны длина спринта и их количество');
    }
    if (!versus && !dto.targetDays) {
      throw new BadRequestException('Укажи, на сколько дней цель');
    }
    const targetDays = versus ? dto.sprintDays! * dto.sprintCount! : dto.targetDays!;

    const goal = await this.prisma.groupGoal.create({
      data: {
        title: dto.title,
        icon: dto.icon,
        color: dto.color,
        mode,
        targetDays,
        ...(versus ? { sprintDays: dto.sprintDays!, startDate: todayUtc() } : {}),
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
          versus ? 'Спор' : 'Общая цель',
          versus
            ? `${who} зовёт спорить: «${dto.title}» — ${dto.sprintCount} спринтов по ${dto.sprintDays} дней`
            : `${who} зовёт держать «${dto.title}» вместе — ${targetDays} дней`,
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

  /**
   * Marks today for this member. In a joint goal that also credits the group
   * day if it was the last one missing; in a competition the day is simply
   * this member's, and nothing is owed to anybody else.
   */
  async checkin(userId: string, goalId: string, proof: CheckinGoalDto = {}) {
    const goal = await this.refresh(goalId);
    if (goal.status !== 'ACTIVE') throw new BadRequestException('Эта цель уже закрыта');

    const member = await this.memberOrThrow(goalId, userId);
    if (member.status !== 'JOINED') throw new BadRequestException('Сначала прими приглашение');

    const today = todayUtc();
    const existing = await this.prisma.groupGoalCheckin.findUnique({
      where: { goalId_userId_date: { goalId, userId, date: today } },
    });
    if (existing) throw new BadRequestException('Сегодня уже отмечено — заходи завтра');

    await this.prisma.groupGoalCheckin.create({
      data: {
        goalId,
        userId,
        date: today,
        proofNote: proof.proofNote ?? null,
        proofUrl: proof.proofUrl ?? null,
      },
    });

    if (goal.mode === 'VERSUS') {
      await this.users.grantXp(userId, VERSUS_DAY_XP);
      // Only evidence is worth telling the others about. "X marked their day"
      // every single day is the kind of message people mute the app over —
      // and the standings on the card already say it.
      if (proof.proofNote || proof.proofUrl) {
        const who = await this.nameOf(userId);
        const others = (await this.joinedMemberIds(goalId)).filter((id) => id !== userId);
        for (const id of others) {
          await this.notifications.create(
            id,
            'GROUP_GOAL_PROOF',
            'Пруф в споре',
            `${who} приложил доказательство к своему дню в «${goal.title}»`,
            { goalId },
          );
        }
      }
    } else {
      await this.settle(goalId, today);
    }

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
    // Buying back a day in a competition would be buying a point off the other
    // person. The rescue exists so one member can save the group, and in a
    // competition there is no group to save.
    if (goal.mode === 'VERSUS') {
      throw new BadRequestException('В споре прошлый день не выкупишь');
    }

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

  /**
   * Declares the goal done ahead of its day count.
   *
   * Any joined member can, not just the owner: a goal is a claim two people
   * made to each other, and whoever sees it come true is in a position to say
   * so. Requiring the owner's word would leave the person who actually
   * finished it waiting for permission — and there is nothing here worth
   * building an approval flow around.
   *
   * This is deliberately different from leaving. Leaving abandons the goal;
   * this closes it as kept, and everyone gets the heart for it.
   */
  async complete(userId: string, goalId: string) {
    const goal = await this.prisma.groupGoal.findUnique({ where: { id: goalId } });
    if (!goal) throw new NotFoundException('Цель не найдена');
    if (goal.status !== 'ACTIVE') throw new BadRequestException('Эта цель уже закрыта');

    const member = await this.memberOrThrow(goalId, userId);
    if (member.status !== 'JOINED') throw new BadRequestException('Сначала прими приглашение');

    await this.prisma.groupGoal.update({
      where: { id: goalId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    const who = await this.nameOf(userId);
    const members = await this.joinedMemberIds(goalId);
    for (const memberId of members) {
      await this.hearts.grant(memberId, 'GROUP_GOAL_COMPLETED');
      await this.notifications.create(
        memberId,
        'GROUP_GOAL_COMPLETED',
        'Цель выполнена 🎯',
        memberId === userId
          ? `«${goal.title}» закрыта. Держали вместе.`
          : `${who} отметил «${goal.title}» выполненной. Держали вместе.`,
        { goalId },
      );
    }

    return this.present(goalId, userId);
  }

  /**
   * Attaches a photo to today's mark.
   *
   * Separate from the checkin on purpose. Marking the day has to stay one
   * instant tap, and a photo takes a file picker, a resize and an upload —
   * bolting that onto the mark would make the fast path wait for the slow
   * one. It also means a proof can be added after the fact, which is what
   * people actually do.
   */
  /**
   * Adds or edits the proof on a day already marked — note, link and photo.
   *
   * All three, not just the photo, because the note and the link used to be
   * writable only in the same breath as the check-in. Marking the day is the
   * primary action and people press it first, and after that there was no way
   * left to say what they had actually done: the form quietly dropped to a
   * photo picker. What somebody writes about their day should not depend on
   * whether they thought about writing it before or after pressing the button.
   *
   * `undefined` leaves a field alone; an empty string clears it. That
   * distinction is what lets a person take back a note without also being
   * unable to leave one untouched while replacing the photo.
   */
  async attachProof(
    userId: string,
    goalId: string,
    proof: { note?: string; url?: string; file?: { buffer: Buffer; mimeType: string } },
  ) {
    const goal = await this.prisma.groupGoal.findUnique({ where: { id: goalId } });
    if (!goal) throw new NotFoundException('Цель не найдена');
    if (goal.status !== 'ACTIVE') throw new BadRequestException('Эта цель уже закрыта');

    const member = await this.memberOrThrow(goalId, userId);
    if (member.status !== 'JOINED') throw new BadRequestException('Сначала прими приглашение');

    const today = todayUtc();
    const mark = await this.prisma.groupGoalCheckin.findUnique({
      where: { goalId_userId_date: { goalId, userId, date: today } },
    });
    if (!mark) throw new BadRequestException('Сначала отметь день — пруф прикладывается к нему');

    const data: { proofImage?: string; proofNote?: string | null; proofUrl?: string | null } = {};
    if (proof.file) {
      data.proofImage = await this.storage.save(
        goalId,
        userId,
        proof.file.buffer,
        proof.file.mimeType,
      );
    }
    if (proof.note !== undefined) data.proofNote = proof.note.trim() || null;
    if (proof.url !== undefined) data.proofUrl = proof.url.trim() || null;

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Нечего прикладывать');
    }

    await this.prisma.groupGoalCheckin.update({ where: { id: mark.id }, data });
    // Replacing a photo should not leave the old one on the bill forever.
    if (data.proofImage && mark.proofImage) await this.storage.forget(mark.proofImage);

    // Say what actually arrived. "Приложил фото" on a note nobody photographed
    // sends the other person looking for a picture that is not there.
    const added: string[] = [];
    if (data.proofImage) added.push('фото');
    if (data.proofNote) added.push('запись');
    if (data.proofUrl) added.push('ссылку');
    if (added.length > 0) {
      const who = await this.nameOf(userId);
      const others = (await this.joinedMemberIds(goalId)).filter((id) => id !== userId);
      for (const id of others) {
        await this.notifications.create(
          id,
          'GROUP_GOAL_PROOF',
          'Пруф в споре',
          `${who} приложил ${added.join(' и ')} к своему дню в «${goal.title}»`,
          { goalId },
        );
      }
    }

    return this.present(goalId, userId);
  }

  /**
   * The bytes of one proof photo, for somebody who is in the goal.
   *
   * This check is the only thing standing between a private photo and the
   * internet, which is why the store is private and the pathname never leaves
   * the database: there is no second way in to get wrong.
   */
  async readProof(userId: string, goalId: string, checkinId: string) {
    const member = await this.prisma.groupGoalMember.findUnique({
      where: { goalId_userId: { goalId, userId } },
      select: { status: true },
    });
    if (member?.status !== 'JOINED') throw new ForbiddenException('Пруфы видят только участники');

    const mark = await this.prisma.groupGoalCheckin.findFirst({
      where: { id: checkinId, goalId },
      select: { proofImage: true },
    });
    if (!mark?.proofImage) throw new NotFoundException('Пруфа нет');

    const blob = await this.storage.read(mark.proofImage);
    if (!blob) throw new NotFoundException('Пруф не читается');
    return blob;
  }

  /**
   * Every proof ever attached to this goal, newest first.
   *
   * The card carries only the last handful, which is the right amount for
   * "what happened lately" and useless for looking something up. A hundred-day
   * bet between two people who post daily leaves two hundred entries behind,
   * and they are the record of the whole thing.
   *
   * Each one is stamped with the sprint it fell in, because that is the unit
   * the bet is actually scored in — a date alone does not tell you which part
   * of the story you are reading.
   */
  async listProofs(userId: string, goalId: string, query: ProofsQueryDto) {
    const goal = await this.proofsAccessOrThrow(userId, goalId);

    const where = {
      ...this.proofFilter(goalId),
      ...(query.date ? { date: toUtcDate(new Date(query.date)) } : {}),
    };

    const [rows, total, members] = await Promise.all([
      this.prisma.groupGoalCheckin.findMany({
        where,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: query.skip,
        take: query.limit,
        select: {
          id: true,
          userId: true,
          date: true,
          proofNote: true,
          proofUrl: true,
          proofImage: true,
        },
      }),
      this.prisma.groupGoalCheckin.count({ where }),
      this.entrants(goalId),
    ]);

    const byId = new Map(members.map((m) => [m.userId, m.user]));

    return paginate(
      rows.map((r) => ({
        id: r.id,
        date: r.date,
        note: r.proofNote,
        url: r.proofUrl,
        hasImage: Boolean(r.proofImage),
        author: byId.get(r.userId) ?? null,
        sprint: this.sprintOf(goal, r.date),
      })),
      total,
      query,
    );
  }

  /**
   * The days this goal has anything on file for, newest first.
   *
   * Separate from the entries because the history is browsed a day at a time:
   * this is the list somebody picks from, and pulling every proof just to
   * work out which dates exist would be paying for the whole record to draw
   * a menu.
   */
  async listProofDays(userId: string, goalId: string) {
    const goal = await this.proofsAccessOrThrow(userId, goalId);

    const rows = await this.prisma.groupGoalCheckin.groupBy({
      by: ['date'],
      where: this.proofFilter(goalId),
      _count: { _all: true },
      orderBy: { date: 'desc' },
    });

    return rows.map((row) => ({
      date: row.date,
      count: row._count._all,
      sprint: this.sprintOf(goal, row.date),
    }));
  }

  /** Which sprint a date fell in, 1-based. Null on a goal that has no sprints. */
  private sprintOf(goal: GoalRow, date: Date): number | null {
    if (goal.mode !== 'VERSUS' || !goal.startDate) return null;
    return Math.floor(daysBetween(goal.startDate, date) / goal.sprintDays) + 1;
  }

  /** A checkin counts as a proof if it carries any of the three. */
  private proofFilter(goalId: string) {
    return {
      goalId,
      OR: [
        { proofNote: { not: null } },
        { proofUrl: { not: null } },
        { proofImage: { not: null } },
      ],
    };
  }

  private async proofsAccessOrThrow(userId: string, goalId: string): Promise<GoalRow> {
    const goal = await this.prisma.groupGoal.findUnique({ where: { id: goalId } });
    if (!goal) throw new NotFoundException('Цель не найдена');

    const member = await this.prisma.groupGoalMember.findUnique({
      where: { goalId_userId: { goalId, userId } },
      select: { status: true },
    });
    if (member?.status !== 'JOINED') throw new ForbiddenException('Пруфы видят только участники');

    return goal;
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
        reachedTarget ? 'Цель выполнена 🎯' : 'День засчитан группе',
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
    if (goal.mode === 'VERSUS') return this.settleSprints(goal);
    if (goal.currentCount === 0 || !goal.lastCountedDate) return goal;

    const gap = daysBetween(goal.lastCountedDate, todayUtc());
    if (gap <= 2) return goal;

    const broken = await this.prisma.groupGoal.update({
      where: { id: goalId },
      data: { currentCount: 0 },
    });

    // The day the chain died is the one right after the last credited day.
    // Whoever marked it did their part and lost the count to somebody else's
    // silence — that part comes back as a heart. No penalty for the one who
    // missed: the zeroed count is already the consequence, and a second one
    // payable in hearts would just give them a way to settle up and stop
    // feeling it.
    const brokenDay = new Date(goal.lastCountedDate.getTime() + ONE_DAY_MS);
    const stood = new Set(
      (
        await this.prisma.groupGoalCheckin.findMany({
          where: { goalId, date: brokenDay },
          select: { userId: true },
        })
      ).map((c) => c.userId),
    );

    const members = await this.joinedMemberIds(goalId);
    for (const id of members) {
      if (stood.has(id)) await this.hearts.grant(id, 'GROUP_GOAL_HELD');
      await this.notifications.create(
        id,
        'GROUP_GOAL_BROKEN',
        'Общая цель сорвалась',
        stood.has(id)
          ? `«${goal.title}» обнулилась: день закрыли не все. Свой ты отметил — держи сердце.`
          : `«${goal.title}» обнулилась: день закрыли не все. Счёт начинается заново.`,
        { goalId },
      );
    }

    return broken;
  }

  // ── competitions ────────────────────────────────────────────

  /** How many sprints the competition is made of. */
  private sprintTotal(goal: GoalRow): number {
    return Math.max(1, Math.floor(goal.targetDays / goal.sprintDays));
  }

  /** The UTC midnight a sprint opens on. */
  private sprintStart(goal: GoalRow, index: number): Date {
    return new Date(goal.startDate!.getTime() + index * goal.sprintDays * ONE_DAY_MS);
  }

  /**
   * Which sprint today falls in, counted from zero — and equal to the total
   * once the competition has run out of calendar, which is how "over" is known
   * without storing it.
   */
  private sprintNow(goal: GoalRow): number {
    return Math.floor(daysBetween(goal.startDate!, todayUtc()) / goal.sprintDays);
  }

  /**
   * One sprint's result.
   *
   * Won by whoever marked the most days in it, and by nobody at all when that
   * is a tie: beating someone by default is not a win. Sprints already running
   * when a member joined are not theirs to lose — a stretch they were not in
   * yet cannot count against them.
   */
  private scoreSprint(goal: GoalRow, index: number, members: Entrant[], marks: Mark[]) {
    const from = this.sprintStart(goal, index).getTime();
    const to = from + goal.sprintDays * ONE_DAY_MS;

    const rows = members
      .filter((m) => m.joinedAt && toUtcDate(m.joinedAt).getTime() <= from)
      .map((m) => ({
        userId: m.userId,
        name: m.user.firstName,
        days: marks.filter(
          (c) => c.userId === m.userId && c.date.getTime() >= from && c.date.getTime() < to,
        ).length,
      }))
      .sort((a, b) => b.days - a.days);

    const best = rows.length > 0 ? Math.max(...rows.map((r) => r.days)) : 0;
    const leaders = rows.filter((r) => r.days === best);

    return {
      index,
      rows,
      winnerId: best > 0 && leaders.length === 1 ? leaders[0].userId : null,
      drawn: best > 0 && leaders.length > 1,
      // Everyone at full marks is the best a sprint can end, and it is a draw.
      // Scoring it as "nobody won" would leave the app quietly hoping your
      // friend slips, which is the opposite of what any of this is for.
      allPerfect: rows.length > 1 && rows.every((r) => r.days === goal.sprintDays),
      empty: best === 0,
    };
  }

  /**
   * Closes every sprint that ended since the last read, announces its score,
   * and finishes the competition once the final one is in.
   *
   * Lazy, like the joint goal's break: there is no scheduler in production, so
   * a sprint that ended overnight settles the next time anybody looks.
   * `settledSprint` is what keeps a second look from announcing it twice.
   */
  private async settleSprints(goal: GoalRow) {
    if (!goal.startDate) return goal;

    const total = this.sprintTotal(goal);
    const finished = Math.max(0, Math.min(this.sprintNow(goal), total));
    if (finished - 1 <= goal.settledSprint) return goal;

    const [members, marks] = await Promise.all([this.entrants(goal.id), this.marks(goal.id)]);

    for (let index = goal.settledSprint + 1; index < finished; index++) {
      const sprint = this.scoreSprint(goal, index, members, marks);
      for (const member of members) {
        await this.notifications.create(
          member.userId,
          'GROUP_GOAL_SPRINT',
          `Спринт ${index + 1} из ${total}`,
          this.sprintVerdict(goal, sprint, member.userId),
          { goalId: goal.id },
        );
      }
    }

    return this.prisma.groupGoal.update({
      where: { id: goal.id },
      data: {
        settledSprint: finished - 1,
        ...(finished >= total ? { status: 'COMPLETED', completedAt: new Date() } : {}),
      },
    });
  }

  /** The sprint's score written from one member's side of it. */
  private sprintVerdict(
    goal: GoalRow,
    sprint: ReturnType<GoalsService['scoreSprint']>,
    viewerId: string,
  ): string {
    const line = sprint.rows
      .map((r) => `${r.userId === viewerId ? 'ты' : r.name} ${r.days}`)
      .join(' · ');

    if (sprint.empty) return `«${goal.title}»: спринт прошёл, не отметился никто.`;
    if (sprint.allPerfect) return `«${goal.title}»: ${line} — взяли все, спринт чистый.`;
    if (sprint.drawn) return `«${goal.title}»: ${line} — ничья.`;
    if (sprint.winnerId === viewerId) return `«${goal.title}»: ${line} — спринт твой.`;

    // No name in the clause on purpose: Russian would need it declined, and
    // the line above already names whoever is standing first.
    return `«${goal.title}»: ${line} — спринт не твой.`;
  }

  /**
   * The competition as this member sees it: who is ahead by sprints, how the
   * one in progress is going, and the evidence people have attached.
   *
   * The standing is a count of sprints, never a running total of days. A total
   * is unwinnable the moment a real gap opens, which turns the person behind
   * into a spectator for the rest of the distance.
   */
  private async versusView(goal: GoalRow, viewerId: string, viewerJoined: boolean) {
    const total = this.sprintTotal(goal);
    const now = this.sprintNow(goal);
    const over = now >= total;
    const current = Math.min(now, total - 1);

    const [members, marks] = await Promise.all([this.entrants(goal.id), this.marks(goal.id)]);

    const won = new Map<string, number>();
    const perfect = new Map<string, number>();
    const drawn = new Map<string, number>();
    const bump = (map: Map<string, number>, id: string) => map.set(id, (map.get(id) ?? 0) + 1);

    for (let index = 0; index < Math.min(now, total); index++) {
      const sprint = this.scoreSprint(goal, index, members, marks);
      if (sprint.winnerId) bump(won, sprint.winnerId);
      for (const row of sprint.rows) {
        if (row.days === goal.sprintDays) bump(perfect, row.userId);
        if (sprint.drawn && row.days === Math.max(...sprint.rows.map((r) => r.days))) {
          bump(drawn, row.userId);
        }
      }
    }

    const running = this.scoreSprint(goal, current, members, marks);
    const today = todayUtc().getTime();
    const daysNow = new Map(running.rows.map((r) => [r.userId, r.days]));

    const standings = members
      .map((m) => ({
        ...m.user,
        isMe: m.userId === viewerId,
        sprintsWon: won.get(m.userId) ?? 0,
        sprintsDrawn: drawn.get(m.userId) ?? 0,
        sprintsPerfect: perfect.get(m.userId) ?? 0,
        daysThisSprint: daysNow.get(m.userId) ?? 0,
        markedToday: marks.some((c) => c.userId === m.userId && c.date.getTime() === today),
      }))
      .sort((a, b) => b.sprintsWon - a.sprintsWon || b.sprintsPerfect - a.sprintsPerfect);

    return {
      sprintDays: goal.sprintDays,
      sprintCount: total,
      // 1-based for reading. Once it is over this is the last sprint, not one
      // past it — there is no sprint 21 of 20 to show.
      sprintNumber: over ? total : current + 1,
      dayInSprint: over
        ? goal.sprintDays
        : (daysBetween(goal.startDate!, todayUtc()) % goal.sprintDays) + 1,
      over,
      standings,
      proofs: viewerJoined ? await this.proofs(goal.id, members) : [],
    };
  }

  /**
   * Evidence, newest first, and only for people inside this goal.
   *
   * Nothing else in the app returns it. A photo says far more about a person
   * than a count does, and the only audience it needs is the one that can
   * tell whether it is honest.
   */
  private async proofs(goalId: string, members: Entrant[]) {
    const rows = await this.prisma.groupGoalCheckin.findMany({
      where: {
        goalId,
        OR: [
          { proofNote: { not: null } },
          { proofUrl: { not: null } },
          { proofImage: { not: null } },
        ],
      },
      orderBy: { date: 'desc' },
      take: PROOF_FEED_SIZE,
      select: {
        id: true,
        userId: true,
        date: true,
        proofNote: true,
        proofUrl: true,
        proofImage: true,
      },
    });

    const byId = new Map(members.map((m) => [m.userId, m.user]));
    return rows.map((r) => ({
      id: r.id,
      date: r.date,
      note: r.proofNote,
      url: r.proofUrl,
      // The pathname itself stays here. The client is told a photo exists and
      // has to come back through the membership check to see it.
      hasImage: Boolean(r.proofImage),
      author: byId.get(r.userId) ?? null,
    }));
  }

  private entrants(goalId: string): Promise<Entrant[]> {
    return this.prisma.groupGoalMember.findMany({
      where: { goalId, status: 'JOINED' },
      select: { userId: true, joinedAt: true, user: { select: MEMBER_CARD } },
      orderBy: { createdAt: 'asc' },
    });
  }

  private marks(goalId: string): Promise<Mark[]> {
    return this.prisma.groupGoalCheckin.findMany({
      where: { goalId },
      select: { userId: true, date: true },
    });
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

    const versus = goal.mode === 'VERSUS';

    return {
      id: goal.id,
      title: goal.title,
      icon: goal.icon,
      color: goal.color,
      mode: goal.mode,
      targetDays: goal.targetDays,
      currentCount: goal.currentCount,
      status: goal.status,
      ownerId: goal.ownerId,
      isOwner: goal.ownerId === viewerId,
      // Both ends of the thing, because a goal that is over is read as a
      // record: "held from the fifth to the twenty-fourth" is most of what is
      // left to say about it.
      createdAt: goal.createdAt,
      completedAt: goal.completedAt,
      myStatus: viewer?.status ?? null,
      markedToday: markedToday.has(viewerId),
      atRisk,
      canRescue,
      // Everything below the line is the competition's own view. The fields
      // above stay filled in both modes so one card list can hold both kinds.
      versus: versus ? await this.versusView(goal, viewerId, viewer?.status === 'JOINED') : null,
      // Nobody is waiting on anybody in a competition — an unmarked day there
      // costs its owner and no one else.
      waitingOn: versus
        ? []
        : joined
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

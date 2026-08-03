import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from './telegram.service';
import { todayUtc } from '../../common/utils/date.util';

/** One person's day, as far as a group chat is allowed to know it. */
interface Standing {
  name: string;
  done: number;
  total: number;
}

/** Below this a line in the chat is just noise addressed to one person. */
const MIN_MEMBERS_FOR_DIGEST = 2;

const WELCOME = [
  '<b>LifeStreak</b>',
  '',
  'Каждый вечер я буду присылать сюда одну строку: кто из вас отметился сегодня, а кто нет. Что именно вы отмечаете, я не показываю — только счёт.',
  '',
  '/join — попасть в список',
  '/leave — выйти из него',
  '/status — посмотреть, как дела прямо сейчас',
].join('\n');

/**
 * The bot living in a group chat.
 *
 * Every habit tracker that wants social pressure has to build the circle of
 * friends first, and almost nobody finishes building it. A group chat is a
 * circle that already exists — the people, the names, and the habit of reading
 * it every day are all in place before we arrive. This is the one thing the
 * product can do that an app store tracker structurally cannot.
 */
@Injectable()
export class ChatCircleService {
  private readonly logger = new Logger(ChatCircleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
  ) {}

  /**
   * The circles this person is counted in, for the app to show. Leaving is
   * possible from here as well as from the chat, because the reason to leave
   * is often exactly that you would rather not say it in front of everyone.
   */
  async listFor(userId: string) {
    const [memberships, addToGroupLink] = await Promise.all([
      this.prisma.chatCircleMember.findMany({
        where: { userId, circle: { isActive: true } },
        select: {
          circle: {
            select: { id: true, title: true, _count: { select: { members: true } } },
          },
        },
        orderBy: { joinedAt: 'asc' },
      }),
      this.telegram.addToGroupLink(),
    ]);

    return {
      addToGroupLink,
      circles: memberships.map(({ circle }) => ({
        id: circle.id,
        title: circle.title ?? 'Групповой чат',
        memberCount: circle._count.members,
      })),
    };
  }

  /** Leaving from the app. Silent — the chat is not told, and need not be. */
  async leave(userId: string, circleId: string): Promise<{ left: boolean }> {
    const removed = await this.prisma.chatCircleMember.deleteMany({ where: { circleId, userId } });
    return { left: removed.count > 0 };
  }

  /** The bot was added to a group. Re-adding revives the circle as it was. */
  async register(telegramChatId: string, title?: string): Promise<void> {
    await this.prisma.chatCircle.upsert({
      where: { telegramChatId },
      update: { isActive: true, ...(title ? { title } : {}) },
      create: { telegramChatId, title: title ?? null },
    });
    await this.telegram.sendToChat(telegramChatId, WELCOME);
  }

  /** Removed from the chat. Memberships stay — see the note on the model. */
  async deactivate(telegramChatId: string): Promise<void> {
    await this.prisma.chatCircle.updateMany({
      where: { telegramChatId },
      data: { isActive: false },
    });
  }

  /**
   * Handles one command addressed to the bot in a group. Being able to post in
   * the chat is the proof of belonging to it, and typing the command is the
   * consent — so no other check is needed or possible.
   */
  async command(
    telegramChatId: string,
    telegramUserId: string,
    command: 'join' | 'leave' | 'status' | 'help',
    chatTitle?: string,
  ): Promise<void> {
    const circle = await this.prisma.chatCircle.upsert({
      where: { telegramChatId },
      update: { isActive: true, ...(chatTitle ? { title: chatTitle } : {}) },
      create: { telegramChatId, title: chatTitle ?? null },
    });

    if (command === 'help') {
      await this.telegram.sendToChat(telegramChatId, WELCOME);
      return;
    }

    if (command === 'status') {
      await this.telegram.sendToChat(telegramChatId, await this.compose(circle.id, 'Сейчас'));
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { telegramId: telegramUserId },
      select: { id: true, firstName: true },
    });

    if (!user) {
      const link = await this.telegram.miniAppLink();
      await this.telegram.sendToChat(
        telegramChatId,
        'Не нахожу тебя в LifeStreak. Заведи привычку в приложении и напиши /join ещё раз.',
        link ? { button: { text: 'Открыть LifeStreak' } } : {},
      );
      return;
    }

    const name = TelegramService.escape(user.firstName);

    if (command === 'leave') {
      const removed = await this.prisma.chatCircleMember.deleteMany({
        where: { circleId: circle.id, userId: user.id },
      });
      await this.telegram.sendToChat(
        telegramChatId,
        removed.count > 0 ? `${name} вышел из круга.` : `${name} и не был в круге.`,
      );
      return;
    }

    const existing = await this.prisma.chatCircleMember.findUnique({
      where: { circleId_userId: { circleId: circle.id, userId: user.id } },
      select: { id: true },
    });
    if (existing) {
      await this.telegram.sendToChat(telegramChatId, `${name} уже в круге.`);
      return;
    }

    await this.prisma.chatCircleMember.create({ data: { circleId: circle.id, userId: user.id } });
    const total = await this.prisma.chatCircleMember.count({ where: { circleId: circle.id } });
    await this.telegram.sendToChat(
      telegramChatId,
      total < MIN_MEMBERS_FOR_DIGEST
        ? `${name} в круге. Вечерняя сверка начнётся, когда наберётся хотя бы двое.`
        : `${name} в круге. Всего ${total}.`,
    );
  }

  /**
   * The evening line, one per chat per day. Runs alongside the private digest
   * and is deliberately separate from it: a chat is not a person, has no
   * dmEnabled switch of its own, and is silenced by removing the bot.
   */
  async runDigest(): Promise<{ circles: number; sent: number }> {
    const today = todayUtc();
    const circles = await this.prisma.chatCircle.findMany({
      where: {
        isActive: true,
        OR: [{ lastDigestDate: null }, { lastDigestDate: { lt: today } }],
      },
      select: { id: true, telegramChatId: true, _count: { select: { members: true } } },
    });

    let sent = 0;
    for (const circle of circles) {
      if (circle._count.members < MIN_MEMBERS_FOR_DIGEST) continue;

      const text = await this.compose(circle.id, 'Вечерняя сверка');
      const result = await this.telegram.sendToChat(circle.telegramChatId, text);

      if (result === 'BLOCKED') {
        // The bot is no longer in that chat and Telegram never told us — which
        // happens when the group was deleted or upgraded to a supergroup.
        await this.deactivate(circle.telegramChatId);
        continue;
      }

      // Written even on FAILED: a network blip is not worth a second attempt
      // an hour later, when the evening it belonged to has passed.
      await this.prisma.chatCircle.update({
        where: { id: circle.id },
        data: { lastDigestDate: today },
      });
      if (result === 'SENT') sent += 1;
    }

    this.logger.log(`Сверка по чатам: ${sent} из ${circles.length}`);
    return { circles: circles.length, sent };
  }

  /**
   * How each member stands today, in two queries rather than two per person.
   * A streak counts as done when its lastCheckinAt has reached today — the
   * same test the private digest uses, so the two messages can never disagree.
   */
  private async compose(circleId: string, heading: string): Promise<string> {
    const today = todayUtc();

    const members = await this.prisma.chatCircleMember.findMany({
      where: { circleId },
      select: { userId: true, user: { select: { firstName: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    if (members.length === 0) return `<b>${heading}</b>\n\nВ круге пока никого. /join`;

    const streaks = await this.prisma.streak.findMany({
      where: { userId: { in: members.map((m) => m.userId) }, status: 'ACTIVE' },
      select: { userId: true, lastCheckinAt: true },
    });

    const tally = new Map<string, { done: number; total: number }>();
    for (const streak of streaks) {
      const row = tally.get(streak.userId) ?? { done: 0, total: 0 };
      row.total += 1;
      if (streak.lastCheckinAt && streak.lastCheckinAt.getTime() >= today.getTime()) row.done += 1;
      tally.set(streak.userId, row);
    }

    const standings: Standing[] = members.map((member) => ({
      name: TelegramService.escape(member.user.firstName),
      done: tally.get(member.userId)?.done ?? 0,
      total: tally.get(member.userId)?.total ?? 0,
    }));

    // Finished first, empty-handed last. The list is read top to bottom, so
    // the person it is really addressed to is the one it ends on.
    standings.sort((a, b) => this.share(b) - this.share(a));

    const counted = standings.filter((s) => s.total > 0);
    if (counted.length > 0 && counted.every((s) => s.done === s.total)) {
      const names = counted.map((s) => s.name).join(', ');
      return `<b>${heading}</b>\n\nЗакрыли все: ${names} ✓`;
    }

    const lines = standings.map((standing) => {
      if (standing.total === 0) return `· ${standing.name} — нет активных серий`;
      const mark = standing.done === standing.total ? '✓' : '·';
      return `${mark} ${standing.name} — ${standing.done} из ${standing.total}`;
    });

    return [`<b>${heading}</b>`, '', ...lines].join('\n');
  }

  private share(standing: Standing): number {
    return standing.total === 0 ? -1 : standing.done / standing.total;
  }
}

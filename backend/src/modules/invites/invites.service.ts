import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { HeartsService } from '../hearts/hearts.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);
  /** Resolved once per process — the bot's @username never changes at runtime. */
  private botUsername: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly heartsService: HeartsService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Returns the user's reusable invite code together with the link that
   * actually carries it. A bare code is useless on its own: the friend has
   * nowhere to type it until they are already inside the app, so the shareable
   * artefact has to be a t.me link that opens the Mini App with `startapp`.
   */
  async getOrCreateMyInvite(userId: string) {
    const invite =
      (await this.prisma.invite.findFirst({ where: { inviterId: userId, status: 'PENDING' } })) ??
      (await this.prisma.invite.create({
        data: { inviterId: userId, code: crypto.randomBytes(4).toString('hex') },
      }));

    const [acceptedCount, usedInvite, link] = await Promise.all([
      this.prisma.invite.count({ where: { inviterId: userId, status: 'ACCEPTED' } }),
      this.prisma.invite.findFirst({ where: { inviteeId: userId } }),
      this.buildLink(invite.code),
    ]);

    return { ...invite, link, acceptedCount, hasAcceptedInvite: Boolean(usedInvite) };
  }

  async accept(newUserId: string, code: string) {
    const invite = await this.prisma.invite.findUnique({
      where: { code: code.trim().toLowerCase() },
      include: { inviter: { select: { id: true, firstName: true, username: true } } },
    });
    if (!invite) throw new NotFoundException('Приглашение не найдено');
    if (invite.inviterId === newUserId) {
      throw new BadRequestException('Нельзя использовать собственное приглашение');
    }

    const alreadyUsedByThisUser = await this.prisma.invite.findFirst({
      where: { inviteeId: newUserId },
    });
    if (alreadyUsedByThisUser) {
      throw new BadRequestException('Вы уже приняли приглашение ранее');
    }

    const accepted = await this.prisma.invite.update({
      where: { id: invite.id },
      data: { inviteeId: newUserId, status: 'ACCEPTED', acceptedAt: new Date() },
    });

    // Both sides get a heart — that is what the invite promises on the profile
    // screen, and a reward only the inviter can see is not worth sharing for.
    await this.heartsService.grant(invite.inviterId, 'INVITE_FRIEND');
    await this.heartsService.grant(newUserId, 'JOINED_BY_INVITE');

    await this.notifications.create(
      invite.inviterId,
      'FRIEND_INVITED',
      'Друг присоединился! ❤️',
      'Ты получил сердце за приглашение друга в LifeStreak',
    );

    // Recycle the inviter's link so it can be reused for another friend.
    await this.getOrCreateMyInvite(invite.inviterId);

    return { ...accepted, inviter: invite.inviter };
  }

  async listMine(userId: string) {
    return this.prisma.invite.findMany({
      where: { inviterId: userId },
      include: { invitee: { select: { firstName: true, username: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * `https://t.me/<bot>/<app>?startapp=<code>` opens the Mini App directly with
   * the code in `start_param`. Without a configured short name we fall back to
   * the bot's main Mini App link, which works once one is set in BotFather.
   * Returns null when the username cannot be resolved — the UI then shows the
   * bare code instead of a link that would not open anything.
   */
  private async buildLink(code: string): Promise<string | null> {
    const username = await this.resolveBotUsername();
    if (!username) return null;

    const shortName = this.config.get<string>('telegram.miniAppShortName');
    const base = shortName
      ? `https://t.me/${username}/${shortName}`
      : `https://t.me/${username}`;
    return `${base}?startapp=${code}`;
  }

  private async resolveBotUsername(): Promise<string | null> {
    const configured = this.config.get<string>('telegram.botUsername');
    if (configured) return configured.replace(/^@/, '');
    if (this.botUsername) return this.botUsername;

    const token = this.config.get<string>('telegram.botToken');
    if (!token) return null;

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const body = (await response.json()) as { ok?: boolean; result?: { username?: string } };
      if (!body.ok || !body.result?.username) return null;
      this.botUsername = body.result.username;
      return this.botUsername;
    } catch (error) {
      // A failed lookup is not cached: the next request should try again.
      this.logger.warn(`Не удалось получить username бота: ${String(error)}`);
      return null;
    }
  }
}

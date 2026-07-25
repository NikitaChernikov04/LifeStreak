import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { HeartsService } from '../hearts/hearts.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly heartsService: HeartsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Returns the user's reusable invite code, creating one on first request. */
  async getOrCreateMyInvite(userId: string) {
    const existing = await this.prisma.invite.findFirst({
      where: { inviterId: userId, status: 'PENDING' },
    });
    if (existing) return existing;

    const code = crypto.randomBytes(4).toString('hex');
    return this.prisma.invite.create({ data: { inviterId: userId, code } });
  }

  async accept(newUserId: string, code: string) {
    const invite = await this.prisma.invite.findUnique({ where: { code } });
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

    await this.heartsService.grant(invite.inviterId, 'INVITE_FRIEND');
    await this.notifications.create(
      invite.inviterId,
      'FRIEND_INVITED',
      'Друг присоединился! ❤️',
      'Ты получил сердце за приглашение друга в LifeStreak',
    );

    // Recycle the inviter's link so it can be reused for another friend.
    await this.getOrCreateMyInvite(invite.inviterId);

    return accepted;
  }

  async listMine(userId: string) {
    return this.prisma.invite.findMany({
      where: { inviterId: userId },
      include: { invitee: { select: { firstName: true, username: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}

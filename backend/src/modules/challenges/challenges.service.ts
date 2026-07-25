import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { HeartsService } from '../hearts/hearts.service';
import { todayUtc } from '../../common/utils/date.util';

@Injectable()
export class ChallengesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly heartsService: HeartsService,
  ) {}

  /** Returns today's challenge for the user, assigning a random one on first request. */
  async getTodayChallenge(userId: string) {
    const today = todayUtc();

    const existing = await this.prisma.dailyChallenge.findUnique({
      where: { userId_date: { userId, date: today } },
      include: { template: true },
    });
    if (existing) return existing;

    const activeTemplates = await this.prisma.challengeTemplate.findMany({
      where: { isActive: true },
    });
    if (activeTemplates.length === 0) {
      throw new NotFoundException('Нет доступных испытаний — запустите сид базы данных');
    }
    const template = activeTemplates[Math.floor(Math.random() * activeTemplates.length)];

    return this.prisma.dailyChallenge.create({
      data: { userId, templateId: template.id, date: today },
      include: { template: true },
    });
  }

  async complete(userId: string, challengeId: string) {
    const challenge = await this.prisma.dailyChallenge.findUnique({
      where: { id: challengeId },
      include: { template: true },
    });
    if (!challenge || challenge.userId !== userId) {
      throw new NotFoundException('Испытание не найдено');
    }
    if (challenge.status === 'COMPLETED') {
      throw new BadRequestException('Испытание уже выполнено');
    }

    const updated = await this.prisma.dailyChallenge.update({
      where: { id: challengeId },
      data: { status: 'COMPLETED', completedAt: new Date() },
      include: { template: true },
    });

    if (challenge.template.rewardType === 'HEART') {
      await this.heartsService.grant(userId, 'DAILY_CHALLENGE');
    } else {
      await this.usersService.grantXp(userId, challenge.template.xpReward);
    }

    return updated;
  }
}

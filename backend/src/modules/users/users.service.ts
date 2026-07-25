import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramInitDataUser } from '../auth/telegram-verify.util';
import { applyXpGain, XpApplyResult } from '../../common/utils/leveling.util';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateFromTelegram(tgUser: TelegramInitDataUser) {
    const telegramId = String(tgUser.id);

    const existing = await this.prisma.user.findUnique({ where: { telegramId } });
    if (existing) {
      return this.prisma.user.update({
        where: { id: existing.id },
        data: {
          username: tgUser.username ?? existing.username,
          firstName: tgUser.first_name,
          lastName: tgUser.last_name ?? existing.lastName,
          avatarUrl: tgUser.photo_url ?? existing.avatarUrl,
          languageCode: tgUser.language_code ?? existing.languageCode,
          lastSeenAt: new Date(),
        },
      });
    }

    return this.prisma.user.create({
      data: {
        telegramId,
        username: tgUser.username,
        firstName: tgUser.first_name,
        lastName: tgUser.last_name,
        avatarUrl: tgUser.photo_url,
        languageCode: tgUser.language_code,
        statistics: { create: {} },
      },
    });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        statistics: true,
        achievements: { include: { definition: true }, orderBy: { unlockedAt: 'desc' } },
        streaks: { where: { status: 'ACTIVE' } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateUserDto) {
    return this.prisma.user.update({ where: { id: userId }, data: dto });
  }

  /** Applies an XP gain, persists new xp/level, and reports whether the user leveled up. */
  async grantXp(userId: string, amount: number): Promise<XpApplyResult> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const result = applyXpGain(user.xp, amount);
    await this.prisma.user.update({
      where: { id: userId },
      data: { xp: result.xp, level: result.level },
    });
    await this.prisma.statistics.update({
      where: { userId },
      data: { totalXp: result.xp },
    });
    return result;
  }
}

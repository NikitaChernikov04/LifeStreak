import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getForUser(userId: string) {
    const stats = await this.prisma.statistics.findUnique({ where: { userId } });
    if (!stats) throw new NotFoundException('Статистика не найдена');

    const [longestStreak, achievementsCount] = await Promise.all([
      this.prisma.streak.findFirst({
        where: { userId },
        orderBy: { longestCount: 'desc' },
        select: { title: true, icon: true, longestCount: true },
      }),
      this.prisma.userAchievement.count({ where: { userId } }),
    ]);

    return { ...stats, longestStreak, achievementsCount };
  }
}

import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller({ path: 'hearts', version: '1' })
export class HeartsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getBalance(@CurrentUser('id') userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { hearts: true, maxHearts: true },
    });
    const ledger = await this.prisma.heartTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return { ...user, history: ledger };
  }
}

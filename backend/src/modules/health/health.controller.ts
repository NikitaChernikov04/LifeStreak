import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Liveness/readiness probe for the platform (Fly health checks, uptime pings).
 * Touches the database so a machine with an unreachable volume or a bad
 * DATABASE_URL fails the check instead of serving 500s to real users.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }
}

import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Liveness/readiness probe for the platform (Docker health checks, uptime
 * pings). Touches the database on purpose, and deliberately does not catch:
 * an instance that cannot reach Postgres must fail the check rather than
 * answer "ok" and then serve 500s to real users.
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

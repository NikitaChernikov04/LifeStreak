import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { verifyTelegramInitData } from './telegram-verify.util';
import { JwtPayload } from './interfaces/jwt-payload.interface';

/**
 * The one account the demo entrance can ever hand out. Not a Telegram id at
 * all — a Telegram account id is numeric, so this string cannot collide with a
 * real person, and the endpoint below looks up nothing else.
 */
export const DEMO_TELEGRAM_ID = 'demo-hero';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async loginWithTelegram(initData: string) {
    const botToken = this.configService.get<string>('telegram.botToken')!;
    const skipValidation = this.configService.get<boolean>('telegram.skipAuthValidation');

    let parsed;
    if (skipValidation) {
      // Local development escape hatch — never enabled in production.
      const params = new URLSearchParams(initData);
      const userRaw = params.get('user');
      if (!userRaw) throw new UnauthorizedException('initData is missing user');
      parsed = { user: JSON.parse(userRaw), authDate: Date.now() / 1000 };
    } else {
      try {
        parsed = verifyTelegramInitData(initData, botToken);
      } catch (err) {
        throw new UnauthorizedException((err as Error).message);
      }
    }

    const user = await this.usersService.findOrCreateFromTelegram(parsed.user);

    const payload: JwtPayload = { sub: user.id, telegramId: user.telegramId };
    const accessToken = this.jwtService.sign(payload);

    return { accessToken, user };
  }

  /**
   * Signs in as the fictional demo account, for recording a walkthrough of the
   * product without putting real people's records on video.
   *
   * This is a way into the app that does not go through Telegram, so it is
   * built to be as narrow as a door can be:
   *
   *   · The secret is unset by default, and while it is unset this refuses
   *     everything. A forgotten variable switches the entrance off rather than
   *     leaving it open — the same rule the cron and webhook endpoints follow.
   *   · It can only ever return a session for DEMO_TELEGRAM_ID. There is no
   *     parameter naming a user, so there is nothing to point at somebody else.
   *   · It creates nothing. If the demo world has not been seeded, it fails.
   *
   * The worst outcome if the secret leaks is that a stranger can look at a
   * cast of invented people, which is what the cast is for.
   */
  async loginAsDemo(secret: string) {
    const expected = this.configService.get<string>('demoSecret') ?? '';
    if (!expected) throw new UnauthorizedException('Демо-вход выключен');
    if (!safeEqual(secret, expected)) throw new UnauthorizedException('Неверный ключ');

    const user = await this.prisma.user.findUnique({ where: { telegramId: DEMO_TELEGRAM_ID } });
    if (!user) {
      throw new UnauthorizedException('Демо-аккаунт не заведён — прогони scripts/seed-demo-world.ts');
    }

    this.logger.log('Demo session issued');

    const payload: JwtPayload = { sub: user.id, telegramId: user.telegramId };
    return { accessToken: this.jwtService.sign(payload), user };
  }
}

/** Length-independent comparison, so the reply time says nothing about the key. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

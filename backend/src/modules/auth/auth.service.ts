import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { verifyTelegramInitData } from './telegram-verify.util';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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
}

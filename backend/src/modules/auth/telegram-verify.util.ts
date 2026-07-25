import * as crypto from 'crypto';

export interface TelegramInitDataUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface ParsedTelegramInitData {
  user: TelegramInitDataUser;
  authDate: number;
}

/**
 * Verifies Telegram WebApp `initData` per the official algorithm:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86400,
): ParsedTelegramInitData {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) {
    throw new Error('initData is missing hash');
  }
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computedHash !== hash) {
    throw new Error('initData signature is invalid');
  }

  const authDate = parseInt(params.get('auth_date') ?? '0', 10);
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) {
    throw new Error('initData has expired');
  }

  const userRaw = params.get('user');
  if (!userRaw) {
    throw new Error('initData is missing user');
  }

  return {
    user: JSON.parse(userRaw) as TelegramInitDataUser,
    authDate,
  };
}

/**
 * Refuses to boot a production instance that would accept forged logins.
 *
 * `TELEGRAM_SKIP_AUTH_VALIDATION` bypasses the initData signature check — it
 * is how local development works without a bot, and it is a full
 * authentication bypass if it survives into production. The same is true of a
 * missing bot token (nothing to verify against) and the fallback JWT secret
 * (anyone can mint tokens). Failing loudly at boot beats discovering this from
 * the access logs.
 */
export function assertProductionConfig(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;

  const problems: string[] = [];

  if (env.TELEGRAM_SKIP_AUTH_VALIDATION === 'true') {
    problems.push(
      'TELEGRAM_SKIP_AUTH_VALIDATION=true disables Telegram signature checking — set it to false',
    );
  }
  if (!env.TELEGRAM_BOT_TOKEN) {
    problems.push('TELEGRAM_BOT_TOKEN is empty — initData signatures cannot be verified');
  }
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    problems.push('JWT_SECRET is missing or shorter than 32 characters');
  }
  if (!env.DATABASE_URL) {
    problems.push('DATABASE_URL is not set');
  }

  if (problems.length > 0) {
    throw new Error(
      `Refusing to start in production with an unsafe configuration:\n  - ${problems.join('\n  - ')}`,
    );
  }
}

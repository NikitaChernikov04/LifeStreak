export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  database: {
    url: process.env.DATABASE_URL, // libsql://<db>-<org>.turso.io in prod, file:./prisma/dev.db locally
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '30d',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
    // Allow bypassing initData HMAC verification in local dev without a real bot token.
    skipAuthValidation: process.env.TELEGRAM_SKIP_AUTH_VALIDATION === 'true',
    // Both optional: invite links need the bot's @username, which is looked up
    // via getMe when it is not configured. The short name is the one given to
    // /newapp in BotFather — set it when the bot has no "main" Mini App.
    botUsername: process.env.TELEGRAM_BOT_USERNAME ?? '',
    miniAppShortName: process.env.TELEGRAM_MINIAPP_SHORT_NAME ?? '',
  },
});

export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  database: {
    // Pooled connection (:6543) — what the app serves requests on.
    url: process.env.DATABASE_URL,
    // Session connection (:5432) — migrations and seeding only, never the app.
    directUrl: process.env.DIRECT_URL,
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
    // Overridable so tests can point the bot at a local stub instead of
    // messaging real people.
    // `||`, not `??`: an empty value in a copied .env means "unset", and a
    // blank base URL would send every message nowhere.
    apiBase: process.env.TELEGRAM_API_BASE || 'https://api.telegram.org',
    // Echoed by Telegram in X-Telegram-Bot-Api-Secret-Token. Without it the
    // webhook refuses every update: the endpoint is public by necessity.
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? '',
  },
  // Shared with the scheduler that calls the evening digest.
  cronSecret: process.env.CRON_SECRET ?? '',
});

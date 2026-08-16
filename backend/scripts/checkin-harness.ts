/**
 * Exercises the check-in through the real Nest container against a real
 * database, on throwaway users that are deleted afterwards.
 *
 * It exists because the check-in is the interaction this product is, and it
 * had no test at all. The way it is used is the point: run it on one revision,
 * run it on another, diff the two transcripts. A behaviour change shows up as
 * a diff and nothing else has to be trusted — which is what made it safe to
 * cut nineteen round trips down to six without a test suite to fall back on.
 *
 * **It writes.** It creates two users, four streaks, check-ins, XP,
 * achievements and heart transactions, then deletes the users (everything else
 * cascades). Point DATABASE_URL at a development project unless you have a
 * reason not to; against production it is safe but not free — the rows exist
 * for the length of the run.
 *
 *   DATABASE_URL=<session connection> npx ts-node scripts/checkin-harness.ts
 *
 * Use the session URL (:5432), not the pooled one: the pooled string carries
 * connection_limit=1 for serverless, and this is not that.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { StreaksService } from '../src/modules/streaks/streaks.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ONE_DAY_MS, todayUtc } from '../src/common/utils/date.util';

const TELEGRAM_ID = '999000777'; // throwaway; never a real Telegram account

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const streaks = app.get(StreaksService);
  const prisma = app.get(PrismaService);

  const out: string[] = [];
  const say = (line: string) => {
    out.push(line);
    console.log(line);
  };

  // Any leftovers from an interrupted run.
  await prisma.user.deleteMany({ where: { telegramId: TELEGRAM_ID } });

  const user = await prisma.user.create({
    data: {
      telegramId: TELEGRAM_ID,
      firstName: 'Проверка',
      statistics: { create: {} },
    },
  });

  const today = todayUtc();
  const daysAgo = (n: number) => new Date(today.getTime() - n * ONE_DAY_MS);

  /** Snapshot of everything a check-in is supposed to move. */
  async function state(streakId: string) {
    // Sequential rather than Promise.all: this runs from a laptop against
    // Frankfurt, and opening several connections at once is exactly what that
    // link fails at. Slow is fine here; flaky is not.
    const streak = await prisma.streak.findUniqueOrThrow({ where: { id: streakId } });
    const u = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const stats = await prisma.statistics.findUniqueOrThrow({ where: { userId: user.id } });
    const checkins = await prisma.dailyCheckin.count({ where: { userId: user.id } });
    const achievements = await prisma.userAchievement.findMany({
      where: { userId: user.id },
      include: { definition: { select: { key: true } } },
    });
    const hearts = await prisma.heartTransaction.count({ where: { userId: user.id } });
    return [
      `streak: count=${streak.currentCount} longest=${streak.longestCount} next=${streak.nextGoal} status=${streak.status}`,
      `user: xp=${u.xp} level=${u.level} hearts=${u.hearts}`,
      `stats: checkins=${stats.totalCheckins} xp=${stats.totalXp} longestEver=${stats.longestStreakEver}`,
      `rows: checkins=${checkins} hearts=${hearts}`,
      `achievements: ${achievements.map((a) => a.definition.key).sort().join(',') || '—'}`,
    ].join('\n    ');
  }

  async function scenario(
    name: string,
    seed: { currentCount: number; longestCount: number; lastCheckinDaysAgo: number | null },
  ) {
    const streak = await prisma.streak.create({
      data: {
        userId: user.id,
        title: name,
        icon: '🧪',
        color: '#000000',
        currentCount: seed.currentCount,
        longestCount: seed.longestCount,
        lastCheckinAt: seed.lastCheckinDaysAgo === null ? null : daysAgo(seed.lastCheckinDaysAgo),
      },
    });

    say(`\n## ${name}`);
    try {
      const result = await streaks.checkin(user.id, streak.id);
      say(
        `  result: xp=${result.xpEarned} leveledUp=${result.leveledUp} level=${result.newLevel} ` +
          `heart=${result.heartGranted} milestone=${result.unlockedMilestone}`,
      );
    } catch (error) {
      say(`  threw: ${(error as Error).message}`);
    }
    say(`    ${await state(streak.id)}`);

    // Marking the same day twice must always be refused.
    try {
      await streaks.checkin(user.id, streak.id);
      say('  second check-in: NOT REFUSED — bug');
    } catch (error) {
      say(`  second check-in refused: ${(error as Error).message}`);
    }

    return streak.id;
  }

  await scenario('первый день', { currentCount: 0, longestCount: 0, lastCheckinDaysAgo: null });
  await scenario('продолжение до 7', { currentCount: 6, longestCount: 6, lastCheckinDaysAgo: 1 });
  await scenario('продолжение до 30', { currentCount: 29, longestCount: 29, lastCheckinDaysAgo: 1 });
  await scenario('после пропуска', { currentCount: 20, longestCount: 20, lastCheckinDaysAgo: 5 });

  // Guards.
  const other = await prisma.user.create({
    data: { telegramId: TELEGRAM_ID + '1', firstName: 'Чужой', statistics: { create: {} } },
  });
  const foreign = await prisma.streak.create({
    data: { userId: other.id, title: 'чужая', icon: '🧪', color: '#000000' },
  });
  say('\n## доступ');
  try {
    await streaks.checkin(user.id, foreign.id);
    say('  чужая серия: НЕ ОТКАЗАНО — bug');
  } catch (error) {
    say(`  чужая серия: ${(error as Error).constructor.name}`);
  }
  try {
    await streaks.checkin(user.id, 'нет-такой-серии');
    say('  несуществующая: НЕ ОТКАЗАНО — bug');
  } catch (error) {
    say(`  несуществующая: ${(error as Error).constructor.name}`);
  }

  await prisma.user.deleteMany({ where: { telegramId: { in: [TELEGRAM_ID, TELEGRAM_ID + '1'] } } });
  await app.close();
  console.log('\n— готово, тестовые пользователи удалены —');
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});

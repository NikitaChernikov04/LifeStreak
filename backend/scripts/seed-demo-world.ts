/**
 * Builds a complete, fictional world for recording a screen review, so nobody
 * has to demonstrate the product on their own friends' real records.
 *
 * Everything it creates is designed to be *shown*: the home screen has a
 * streak already marked today, one still waiting to be pressed on camera, one
 * broken yesterday and recoverable, and one carried in from before. A shared
 * goal is waiting on somebody else. One bet is being won and one is being
 * lost, because "you are four sprints down and it is still winnable" is the
 * argument the feature exists to make and it cannot be shown from in front.
 *
 * ## Isolation
 *
 * The cast lives in the production database, which is safe here for reasons
 * worth stating rather than assuming:
 *   · the leaderboard is computed over the viewer's friends, so the cast can
 *     only ever appear to each other and to the demo account;
 *   · user search filters on isDiscoverable, and every fictional person is
 *     created with it false, so they never turn up in a real person's search;
 *   · they are created with dmEnabled false, and both the evening digest and
 *     notification delivery skip that — so no fictional person will ever cause
 *     a Telegram message to be attempted;
 *   · their telegramId is a `demo-…` string rather than a number, which cannot
 *     collide with a real Telegram account and makes them obvious in the data.
 *
 * The hero is not a Telegram account. Its id is the fixed `demo-hero` string,
 * which no real account can hold, and it is reached through the secret demo
 * entrance rather than by signing in — so recording the walkthrough never
 * requires a second Telegram account, and the demo cannot be mistaken for a
 * person by anything in the app.
 *
 * ## Usage
 *
 *   DIRECT_URL=<session connection> npx ts-node scripts/seed-demo-world.ts
 *
 * Re-running rebuilds the world from scratch. That is the point: a recording
 * takes several attempts, and every attempt should start from the same frame.
 */
import { PrismaClient } from '@prisma/client';
import { ACHIEVEMENT_CATALOG } from '../src/modules/achievements/achievement-catalog';
import { DEMO_TELEGRAM_ID } from '../src/modules/auth/auth.service';

const HERO_TELEGRAM_ID = DEMO_TELEGRAM_ID;
const HERO_USERNAME = 'lifestreak_demo';
const CAST_PREFIX = 'demo-';

const DAY = 86_400_000;
const todayUtc = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};
const TODAY = todayUtc();
const day = (back: number) => new Date(TODAY.getTime() - back * DAY);

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
});

/**
 * Nothing this script deletes can belong to a person: every id it touches
 * starts with `demo-`, and a Telegram account id is numeric. The check is kept
 * anyway, because "it cannot happen" is how data gets deleted.
 */
function assertOnlyDemoIds() {
  if (!HERO_TELEGRAM_ID.startsWith(CAST_PREFIX)) {
    console.error(`ОТКАЗ: demo id «${HERO_TELEGRAM_ID}» не начинается с «${CAST_PREFIX}».`);
    process.exit(1);
  }
}

interface CastMember {
  key: string;
  firstName: string;
  username: string;
  /** Their best active streak — this is what orders the leaderboard. */
  bestStreak: number;
  totalCheckins: number;
  xp: number;
  streakTitle: string;
  streakIcon: string;
  streakColor: string;
}

const CAST: CastMember[] = [
  { key: 'marina', firstName: 'Марина', username: 'marina_k', bestStreak: 61, totalCheckins: 142, xp: 3120, streakTitle: 'Бассейн', streakIcon: '🏊', streakColor: '#3B5B7A' },
  { key: 'timur', firstName: 'Тимур', username: 'timur_dev', bestStreak: 38, totalCheckins: 96, xp: 2240, streakTitle: 'Код каждый день', streakIcon: '💻', streakColor: '#4A5B3C' },
  { key: 'sonya', firstName: 'Соня', username: 'sonya', bestStreak: 22, totalCheckins: 71, xp: 1580, streakTitle: 'Дневник', streakIcon: '📓', streakColor: '#6B4A6E' },
  { key: 'gleb', firstName: 'Глеб', username: 'gleb_r', bestStreak: 14, totalCheckins: 44, xp: 980, streakTitle: 'Без лифта', streakIcon: '🪜', streakColor: '#8A5A2B' },
  { key: 'rita', firstName: 'Рита', username: 'rita_m', bestStreak: 9, totalCheckins: 31, xp: 690, streakTitle: 'Гитара', streakIcon: '🎸', streakColor: '#7A3B4A' },
  // Not friends yet — they are the two waiting requests, so accepting one can
  // be shown on camera.
  { key: 'kostya', firstName: 'Костя', username: 'kostya_p', bestStreak: 17, totalCheckins: 53, xp: 1120, streakTitle: 'Бег', streakIcon: '🏃', streakColor: '#3B5B7A' },
  { key: 'vera', firstName: 'Вера', username: 'vera_l', bestStreak: 5, totalCheckins: 18, xp: 420, streakTitle: 'Английский', streakIcon: '📕', streakColor: '#4A5B3C' },
];

async function wipe() {
  // Cascades take streaks, checkins, goals, memberships, friendships,
  // achievements, hearts and notifications with them.
  const cast = await prisma.user.deleteMany({
    where: { telegramId: { startsWith: CAST_PREFIX } },
  });
  console.log(`убрано: ${cast.count} демо-записей`);
}

/** A streak plus the check-ins behind it, so the record tape has a real past. */
async function makeStreak(
  userId: string,
  opts: {
    title: string;
    icon: string;
    color: string;
    count: number;
    /** 0 = marked today, 1 = marked yesterday, 2 = missed yesterday (recoverable). */
    lastMarkedDaysAgo: number;
    imported?: number;
    shared?: boolean;
  },
) {
  const { title, icon, color, count, lastMarkedDaysAgo, imported = 0, shared = false } = opts;
  const nextGoal = [7, 14, 30, 50, 100, 180, 365].find((g) => g > count) ?? 365;

  const streak = await prisma.streak.create({
    data: {
      userId,
      title,
      icon,
      color,
      currentCount: count,
      longestCount: count,
      importedCount: imported,
      nextGoal,
      status: 'ACTIVE',
      lastCheckinAt: day(lastMarkedDaysAgo),
      isShared: shared,
      createdAt: day(count + 2),
    },
  });

  // Only the days actually observed here get rows; carried-over days never
  // happened in this journal, which is exactly what importedCount means.
  const observed = Math.min(count - imported, 60);
  if (observed > 0) {
    await prisma.dailyCheckin.createMany({
      data: Array.from({ length: observed }, (_, i) => ({
        streakId: streak.id,
        userId,
        date: day(lastMarkedDaysAgo + i),
        xpEarned: 20,
        createdAt: day(lastMarkedDaysAgo + i),
      })),
    });
  }

  return streak;
}

async function main() {
  assertOnlyDemoIds();
  await wipe();

  console.log('\n— герой —');
  const hero = await prisma.user.create({
    data: {
      telegramId: HERO_TELEGRAM_ID,
      username: HERO_USERNAME,
      firstName: 'Никита',
      level: 5,
      xp: 2480,
      hearts: 3,
      maxHearts: 5,
      // Invisible in search, and never messaged: `demo-hero` is not a chat id,
      // so every delivery attempt would be a wasted call that fails.
      isDiscoverable: false,
      dmEnabled: false,
      createdAt: day(64),
      statistics: {
        create: { totalXp: 2480, totalCheckins: 168, activeStreaksCount: 4, longestStreakEver: 46, perfectDaysCount: 29 },
      },
    },
  });

  // Four streaks, each in a different state, so one screen shows every state
  // the card can be in.
  await makeStreak(hero.id, { title: 'Английский', icon: '📕', color: '#3B5B7A', count: 46, lastMarkedDaysAgo: 0, shared: true });
  await makeStreak(hero.id, { title: 'Зарядка', icon: '🏃', color: '#8A5A2B', count: 12, lastMarkedDaysAgo: 1, shared: true });
  await makeStreak(hero.id, { title: 'Без сахара', icon: '🍬', color: '#6B4A6E', count: 3, lastMarkedDaysAgo: 2 });
  await makeStreak(hero.id, { title: 'Не курю', icon: '🚭', color: '#4A5B3C', count: 128, lastMarkedDaysAgo: 0, imported: 100 });
  console.log('4 серии: отмечена сегодня / ждёт кнопки / сорвана вчера / с перенесённой историей');

  console.log('\n— окружение —');
  const cast: Record<string, { id: string }> = {};
  for (const person of CAST) {
    const user = await prisma.user.create({
      data: {
        telegramId: `${CAST_PREFIX}${person.key}`,
        username: person.username,
        firstName: person.firstName,
        level: Math.max(1, Math.floor(person.xp / 500) + 1),
        xp: person.xp,
        hearts: 3,
        // Never findable by a real user, and never messaged by the bot.
        isDiscoverable: false,
        dmEnabled: false,
        createdAt: day(person.bestStreak + 10),
        statistics: {
          create: {
            totalXp: person.xp,
            totalCheckins: person.totalCheckins,
            activeStreaksCount: 1,
            longestStreakEver: person.bestStreak,
            perfectDaysCount: Math.floor(person.totalCheckins / 4),
          },
        },
      },
    });
    cast[person.key] = user;

    await makeStreak(user.id, {
      title: person.streakTitle,
      icon: person.streakIcon,
      color: person.streakColor,
      count: person.bestStreak,
      lastMarkedDaysAgo: person.key === 'gleb' ? 1 : 0,
      shared: true,
    });
  }
  console.log(`${CAST.length} человек, у каждого своя серия`);

  // Five accepted friends and two people still waiting for an answer — so
  // accepting a request is something that can be done on camera.
  const friends = ['marina', 'timur', 'sonya', 'gleb', 'rita'];
  for (const key of friends) {
    await prisma.friendship.create({
      data: {
        requesterId: cast[key].id,
        addresseeId: hero.id,
        status: 'ACCEPTED',
        createdAt: day(20),
        respondedAt: day(19),
      },
    });
  }
  for (const key of ['kostya', 'vera']) {
    await prisma.friendship.create({
      data: {
        requesterId: cast[key].id,
        addresseeId: hero.id,
        status: 'PENDING',
        createdAt: day(1),
      },
    });
  }
  // The cast know each other too, so the leaderboard is not a list of one.
  await prisma.friendship.create({
    data: { requesterId: cast.marina.id, addresseeId: cast.timur.id, status: 'ACCEPTED', createdAt: day(30), respondedAt: day(30) },
  });
  console.log('5 друзей, 2 заявки ждут ответа');

  console.log('\n— общие цели —');
  const reading = await prisma.groupGoal.create({
    data: {
      title: 'Читаем каждый день',
      icon: '📖',
      color: '#3B5B7A',
      mode: 'TOGETHER',
      targetDays: 30,
      currentCount: 11,
      status: 'ACTIVE',
      ownerId: hero.id,
      lastCountedDate: day(1),
      createdAt: day(12),
      members: {
        create: [
          { userId: hero.id, status: 'JOINED', joinedAt: day(12) },
          { userId: cast.marina.id, status: 'JOINED', joinedAt: day(12) },
        ],
      },
    },
  });
  // The hero has closed today and Марина has not — which is the whole point of
  // a goal held together, and it is what the card is built to say.
  for (let i = 0; i <= 11; i++) {
    await prisma.groupGoalCheckin.create({
      data: { goalId: reading.id, userId: hero.id, date: day(i), createdAt: day(i) },
    });
    if (i > 0) {
      await prisma.groupGoalCheckin.create({
        data: { goalId: reading.id, userId: cast.marina.id, date: day(i), createdAt: day(i) },
      });
    }
  }

  const walking = await prisma.groupGoal.create({
    data: {
      title: '10 000 шагов',
      icon: '🚶',
      color: '#4A5B3C',
      mode: 'TOGETHER',
      targetDays: 21,
      currentCount: 19,
      status: 'ACTIVE',
      ownerId: cast.timur.id,
      lastCountedDate: day(1),
      createdAt: day(21),
      members: {
        create: [
          { userId: hero.id, status: 'JOINED', joinedAt: day(21) },
          { userId: cast.timur.id, status: 'JOINED', joinedAt: day(21) },
          { userId: cast.sonya.id, status: 'JOINED', joinedAt: day(20) },
        ],
      },
    },
  });
  for (let i = 1; i <= 19; i++) {
    for (const uid of [hero.id, cast.timur.id, cast.sonya.id]) {
      await prisma.groupGoalCheckin.create({
        data: { goalId: walking.id, userId: uid, date: day(i), createdAt: day(i) },
      });
    }
  }
  console.log('2 цели: одна ждёт Марину, вторая почти взята');

  console.log('\n— споры —');
  // settledSprint is set to the last sprint that has actually finished, so
  // opening the app does not announce four old results at once.
  const coffeeStart = day(13);
  const coffeeSprintDays = 3;
  const coffeeNow = Math.floor((TODAY.getTime() - coffeeStart.getTime()) / DAY / coffeeSprintDays);

  const coffee = await prisma.groupGoal.create({
    data: {
      title: 'Кто дольше без кофе',
      icon: '☕',
      color: '#8A5A2B',
      mode: 'VERSUS',
      targetDays: 15,
      sprintDays: coffeeSprintDays,
      startDate: coffeeStart,
      settledSprint: coffeeNow - 1,
      status: 'ACTIVE',
      ownerId: hero.id,
      createdAt: coffeeStart,
      members: {
        create: [
          { userId: hero.id, status: 'JOINED', joinedAt: coffeeStart },
          { userId: cast.timur.id, status: 'JOINED', joinedAt: coffeeStart },
        ],
      },
    },
  });
  // The hero is ahead on sprints here, and has not closed today — so the
  // button is live for the camera.
  const heroCoffeeDays = [1, 2, 3, 4, 5, 6, 7, 9, 10, 12];
  const timurCoffeeDays = [1, 3, 4, 6, 7, 10, 13];
  for (const d of heroCoffeeDays) {
    await prisma.groupGoalCheckin.create({
      data: {
        goalId: coffee.id,
        userId: hero.id,
        date: day(d),
        createdAt: day(d),
        proofNote: d === 1 ? 'Взял чай вместо третьего кофе, держусь' : null,
      },
    });
  }
  for (const d of timurCoffeeDays) {
    await prisma.groupGoalCheckin.create({
      data: {
        goalId: coffee.id,
        userId: cast.timur.id,
        date: day(d),
        createdAt: day(d),
        proofNote: d === 1 ? 'Сегодня только вода. Скрин трекера прикладываю' : null,
        proofUrl: d === 1 ? 'https://example.com/tracker' : null,
      },
    });
  }

  // The second bet is one the hero is losing, because the argument for scoring
  // in sprints only lands from behind.
  const pagesStart = day(19);
  const pagesSprintDays = 5;
  const pagesNow = Math.floor((TODAY.getTime() - pagesStart.getTime()) / DAY / pagesSprintDays);

  const pages = await prisma.groupGoal.create({
    data: {
      title: 'Кто прочитает больше',
      icon: '📚',
      color: '#6B4A6E',
      mode: 'VERSUS',
      targetDays: 40,
      sprintDays: pagesSprintDays,
      startDate: pagesStart,
      settledSprint: pagesNow - 1,
      status: 'ACTIVE',
      ownerId: cast.sonya.id,
      createdAt: pagesStart,
      members: {
        create: [
          { userId: hero.id, status: 'JOINED', joinedAt: pagesStart },
          { userId: cast.sonya.id, status: 'JOINED', joinedAt: pagesStart },
        ],
      },
    },
  });
  for (const d of [2, 3, 7, 8, 12, 16, 17]) {
    await prisma.groupGoalCheckin.create({
      data: { goalId: pages.id, userId: hero.id, date: day(d), createdAt: day(d) },
    });
  }
  for (const d of [1, 2, 3, 4, 6, 7, 8, 11, 12, 13, 16, 17, 18]) {
    await prisma.groupGoalCheckin.create({
      data: {
        goalId: pages.id,
        userId: cast.sonya.id,
        date: day(d),
        createdAt: day(d),
        proofNote: d === 1 ? 'Сорок страниц перед сном' : null,
      },
    });
  }
  console.log('2 спора: один ведём, второй проигрываем — и он всё ещё отыгрываем');

  console.log('\n— награды и сердца —');
  const definitions = await prisma.achievementDefinition.findMany();
  const byKey = new Map(definitions.map((d) => [d.key, d.id]));
  const earned = ['FIRST_WEEK', 'DAYS_30', 'FIRST_HEART', 'FIRST_RECOVERY', 'COLLECTOR'];
  for (const key of earned) {
    const definitionId = byKey.get(key);
    if (!definitionId) continue;
    await prisma.userAchievement.create({
      data: { userId: hero.id, definitionId, unlockedAt: day(earned.indexOf(key) * 6 + 3) },
    });
  }
  console.log(
    `${earned.length} из ${ACHIEVEMENT_CATALOG.length} наград открыто — остальные видно запертыми`,
  );

  await prisma.heartTransaction.createMany({
    data: [
      { userId: hero.id, amount: 1, reason: 'WEEK_STREAK_BONUS', createdAt: day(9) },
      { userId: hero.id, amount: 1, reason: 'DAILY_CHALLENGE', createdAt: day(6) },
      { userId: hero.id, amount: -1, reason: 'STREAK_RECOVERY_SPENT', createdAt: day(4) },
      { userId: hero.id, amount: 1, reason: 'WEEK_STREAK_BONUS', createdAt: day(2) },
    ],
  });

  // A challenge waiting to be completed on camera.
  const template = await prisma.challengeTemplate.findFirst({ where: { isActive: true } });
  if (template) {
    await prisma.dailyChallenge.create({
      data: { userId: hero.id, templateId: template.id, date: TODAY, status: 'PENDING' },
    });
    console.log(`задание дня: «${template.title}»`);
  }

  await prisma.notification.createMany({
    data: [
      { userId: hero.id, type: 'FRIEND_REQUEST', title: 'Костя хочет дружить', body: 'Прими заявку, чтобы видеть серии друг друга', createdAt: day(1) },
      { userId: hero.id, type: 'GROUP_GOAL_DAY', title: 'День засчитан', body: '«10 000 шагов» — отметились все', createdAt: day(1) },
      { userId: hero.id, type: 'ACHIEVEMENT_UNLOCKED', title: 'Достижение: 30 дней', body: 'Продержи серию 30 дней подряд', createdAt: day(3) },
    ],
  });

  await prisma.$disconnect();

  console.log('\nГотово. Вход — по секретной демо-ссылке (см. README, «Демо для записи»).');
  console.log('Повторный запуск пересоберёт мир заново — для второго дубля.');
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});

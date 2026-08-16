import { PrismaClient } from '@prisma/client';
import { ACHIEVEMENT_CATALOG } from '../src/modules/achievements/achievement-catalog';
import { STREAK_TEMPLATES, nextGoalFor } from '../src/modules/streaks/templates/streak-templates';

// Seeding writes DDL-free but long-running upserts, and runs from a shell
// rather than a serverless function — so it goes through DIRECT_URL when one
// is set, the same connection `prisma migrate` uses, instead of taking a slot
// in the pooler meant for live requests.
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
});

const CHALLENGE_TEMPLATES = [
  { title: 'Прочитай 20 страниц', description: 'Открой книгу и прочитай хотя бы 20 страниц', icon: '📖', xpReward: 40, rewardType: 'XP' as const },
  { title: 'Выпей 2 литра воды', description: 'Следи за балансом воды в течение дня', icon: '💧', xpReward: 40, rewardType: 'XP' as const },
  { title: 'Ложись до 23:00', description: 'Ляг спать до 23:00 сегодня', icon: '🌙', xpReward: 40, rewardType: 'XP' as const },
  { title: 'Не ешь сладкое', description: 'Продержись весь день без сахара', icon: '🍬', xpReward: 40, rewardType: 'XP' as const },
  { title: 'Пройди 15 000 шагов', description: 'Активность засчитывается вручную в MVP', icon: '🚶', xpReward: 0, rewardType: 'HEART' as const },
  { title: 'Сделай тренировку', description: 'Любая физическая активность от 20 минут', icon: '🏋️', xpReward: 40, rewardType: 'XP' as const },
];

// The catalogues (achievements, challenge templates) are reference data the
// app cannot work without, so they are seeded on every deploy. The demo user
// and its streaks are development fixtures — opt in with SEED_DEMO=true.
const SEED_DEMO = process.env.SEED_DEMO === 'true';

async function main() {
  console.log('🌱 Seeding achievement definitions...');
  for (const a of ACHIEVEMENT_CATALOG) {
    await prisma.achievementDefinition.upsert({
      where: { key: a.key },
      update: { title: a.title, description: a.description, icon: a.icon, xpReward: a.xpReward },
      create: a,
    });
  }

  console.log('🌱 Seeding challenge templates...');
  for (const c of CHALLENGE_TEMPLATES) {
    const existing = await prisma.challengeTemplate.findFirst({ where: { title: c.title } });
    if (existing) {
      await prisma.challengeTemplate.update({ where: { id: existing.id }, data: c });
    } else {
      await prisma.challengeTemplate.create({ data: c });
    }
  }

  if (!SEED_DEMO) {
    console.log('✅ Catalogues seeded. Skipping demo data (set SEED_DEMO=true to include it).');
    return;
  }

  console.log('🌱 Seeding demo user with sample streaks...');
  const demoTelegramId = '999000001';
  const demoUser = await prisma.user.upsert({
    where: { telegramId: demoTelegramId },
    update: {},
    create: {
      telegramId: demoTelegramId,
      firstName: 'Демо',
      lastName: 'Пользователь',
      username: 'lifestreak_demo',
      xp: 640,
      level: 2,
      hearts: 3,
      statistics: { create: {} },
    },
  });

  // Icon and colour come from the template so the demo always matches the
  // palette shipped in STREAK_TEMPLATES rather than drifting from it.
  const demoStreaksData = [
    { title: 'Читатель', templateKey: 'reading', currentCount: 45 },
    { title: 'Разработчик', templateKey: 'coding', currentCount: 120 },
    { title: 'Атлет', templateKey: 'sport', currentCount: 31 },
    { title: 'Спокойный', templateKey: 'meditation', currentCount: 18 },
    { title: 'Полиглот', templateKey: 'english', currentCount: 67 },
  ];

  for (const s of demoStreaksData) {
    const template = STREAK_TEMPLATES.find((t) => t.key === s.templateKey)!;
    const existing = await prisma.streak.findFirst({ where: { userId: demoUser.id, title: s.title } });

    if (existing) {
      await prisma.streak.update({
        where: { id: existing.id },
        data: { icon: template.icon, color: template.color },
      });
      continue;
    }

    await prisma.streak.create({
      data: {
        userId: demoUser.id,
        title: s.title,
        icon: template.icon,
        color: template.color,
        templateKey: s.templateKey,
        currentCount: s.currentCount,
        longestCount: s.currentCount,
        nextGoal: nextGoalFor(s.currentCount),
        lastCheckinAt: new Date(new Date().toISOString().slice(0, 10)),
      },
    });
  }

  await prisma.statistics.update({
    where: { userId: demoUser.id },
    data: {
      totalXp: 640,
      totalCheckins: demoStreaksData.reduce((sum, s) => sum + s.currentCount, 0),
      activeStreaksCount: demoStreaksData.length,
      longestStreakEver: Math.max(...demoStreaksData.map((s) => s.currentCount)),
    },
  });

  console.log('✅ Seed complete. Available streak templates:', STREAK_TEMPLATES.map((t) => t.title).join(', '));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

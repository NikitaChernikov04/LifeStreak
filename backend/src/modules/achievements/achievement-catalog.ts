import { AchievementKey } from '../../common/enums';

export interface AchievementCatalogEntry {
  key: AchievementKey;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
}

/** Seed source of truth for achievement definitions — also used by the seed script. */
export const ACHIEVEMENT_CATALOG: AchievementCatalogEntry[] = [
  {
    key: 'FIRST_WEEK',
    title: 'Первые 7 дней',
    description: 'Продержи серию 7 дней подряд',
    icon: '🔥',
    xpReward: 100,
  },
  {
    key: 'DAYS_30',
    title: '30 дней',
    description: 'Продержи серию 30 дней подряд',
    icon: '🏆',
    xpReward: 200,
  },
  {
    key: 'DAYS_100',
    title: '100 дней',
    description: 'Продержи серию 100 дней подряд',
    icon: '💎',
    xpReward: 500,
  },
  {
    key: 'DAYS_365',
    title: '365 дней',
    description: 'Продержи серию целый год',
    icon: '👑',
    xpReward: 2000,
  },
  {
    key: 'FIRST_HEART',
    title: 'Первое сердце',
    description: 'Заработай своё первое сердце',
    icon: '❤️',
    xpReward: 50,
  },
  {
    key: 'FIRST_RECOVERY',
    title: 'Первое восстановление',
    description: 'Восстанови пропущенный день с помощью сердца',
    icon: '💗',
    xpReward: 50,
  },
  {
    key: 'NO_MISSED_DAYS',
    title: 'Без единого пропуска',
    description: 'Дойди до 30 дней без единого использования сердца',
    icon: '✨',
    xpReward: 300,
  },
  {
    key: 'COLLECTOR',
    title: 'Коллекционер',
    description: 'Создай 5 разных серий',
    icon: '📚',
    xpReward: 150,
  },
  {
    key: 'LEGEND',
    title: 'Легенда',
    description: 'Достигни 20 уровня',
    icon: '🌟',
    xpReward: 1000,
  },
];

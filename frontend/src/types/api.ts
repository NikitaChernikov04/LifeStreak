export type StreakStatus = 'ACTIVE' | 'BROKEN' | 'ARCHIVED';

export interface Streak {
  id: string;
  userId: string;
  title: string;
  icon: string;
  color: string;
  templateKey: string | null;
  currentCount: number;
  longestCount: number;
  nextGoal: number;
  status: StreakStatus;
  lastCheckinAt: string | null;
  freezesUsedTotal: number;
  createdAt: string;
  updatedAt: string;
}

export interface StreakTemplate {
  key: string;
  title: string;
  icon: string;
  color: string;
}

export interface CheckinResponse {
  streak: Streak;
  xpEarned: number;
  leveledUp: boolean;
  newLevel: number;
  heartGranted: boolean;
  unlockedMilestone: boolean;
}

export interface User {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  avatarUrl: string | null;
  level: number;
  xp: number;
  hearts: number;
  maxHearts: number;
  createdAt: string;
  statistics?: Statistics;
  achievements?: UserAchievement[];
  streaks?: Streak[];
}

export interface Statistics {
  id: string;
  userId: string;
  totalXp: number;
  totalCheckins: number;
  activeStreaksCount: number;
  longestStreakEver: number;
  perfectDaysCount: number;
  longestStreak?: { title: string; icon: string; longestCount: number } | null;
  achievementsCount?: number;
}

export type AchievementKey =
  | 'FIRST_WEEK'
  | 'DAYS_30'
  | 'DAYS_100'
  | 'DAYS_365'
  | 'FIRST_HEART'
  | 'FIRST_RECOVERY'
  | 'NO_MISSED_DAYS'
  | 'COLLECTOR'
  | 'LEGEND';

export interface AchievementDefinition {
  id: string;
  key: AchievementKey;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
}

export interface UserAchievement {
  id: string;
  userId: string;
  definitionId: string;
  unlockedAt: string;
  definition: AchievementDefinition;
}

export interface ChallengeTemplate {
  id: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
  rewardType: 'XP' | 'HEART';
}

export interface DailyChallenge {
  id: string;
  userId: string;
  templateId: string;
  template: ChallengeTemplate;
  date: string;
  status: 'PENDING' | 'COMPLETED' | 'EXPIRED';
  completedAt: string | null;
}

export interface HeartTransaction {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
}

export interface HeartsBalance {
  hearts: number;
  maxHearts: number;
  history: HeartTransaction[];
}

export interface Invite {
  id: string;
  code: string;
  inviterId: string;
  inviteeId: string | null;
  status: 'PENDING' | 'ACCEPTED';
  createdAt: string;
}

export interface ApiEnvelope<T> {
  success: true;
  data: T;
}

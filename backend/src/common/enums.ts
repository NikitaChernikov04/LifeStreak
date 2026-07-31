/**
 * Turso/libSQL (SQLite) has no native enum support in Prisma, so these fields
 * are plain `String` columns in schema.prisma. These union types + arrays are
 * the single source of truth for valid values everywhere in application code.
 */

export const STREAK_STATUSES = ['ACTIVE', 'BROKEN', 'ARCHIVED'] as const;
export type StreakStatus = (typeof STREAK_STATUSES)[number];

export const CHALLENGE_REWARD_TYPES = ['XP', 'HEART'] as const;
export type ChallengeReward = (typeof CHALLENGE_REWARD_TYPES)[number];

export const DAILY_CHALLENGE_STATUSES = ['PENDING', 'COMPLETED', 'EXPIRED'] as const;
export type DailyChallengeStatus = (typeof DAILY_CHALLENGE_STATUSES)[number];

export const ACHIEVEMENT_KEYS = [
  'FIRST_WEEK',
  'DAYS_30',
  'DAYS_100',
  'DAYS_365',
  'FIRST_HEART',
  'FIRST_RECOVERY',
  'NO_MISSED_DAYS',
  'COLLECTOR',
  'LEGEND',
] as const;
export type AchievementKey = (typeof ACHIEVEMENT_KEYS)[number];

export const HEART_REASONS = [
  'DAILY_CHALLENGE',
  'WEEK_STREAK_BONUS',
  'STEPS_GOAL',
  'INVITE_FRIEND',
  'JOINED_BY_INVITE',
  'HELPED_FRIEND_RECOVER',
  'STREAK_RECOVERY_SPENT',
  'ACHIEVEMENT_BONUS',
] as const;
export type HeartReason = (typeof HEART_REASONS)[number];

export const INVITE_STATUSES = ['PENDING', 'ACCEPTED'] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  'STREAK_REMINDER',
  'STREAK_AT_RISK',
  'ACHIEVEMENT_UNLOCKED',
  'LEVEL_UP',
  'HEART_EARNED',
  'FRIEND_INVITED',
  'CHALLENGE_AVAILABLE',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

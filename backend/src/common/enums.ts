/**
 * These fields are plain `String` columns in schema.prisma, not Postgres
 * enums. Under SQLite that was forced; here it is kept on purpose, because an
 * enum column makes every new achievement key or notification type a DDL
 * migration that has to reach production strictly before the code that writes
 * it. The union types + arrays below are the single source of truth for valid
 * values everywhere in application code, and they catch a typo at the only
 * boundary where one can be introduced.
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
  'GROUP_GOAL_RESCUE_SPENT',
  'GROUP_GOAL_COMPLETED',
  // Marked a group day that somebody else left open. The count is lost either
  // way; this is the part of it that was actually earned coming back.
  'GROUP_GOAL_HELD',
  'ACHIEVEMENT_BONUS',
] as const;
export type HeartReason = (typeof HEART_REASONS)[number];

export const INVITE_STATUSES = ['PENDING', 'ACCEPTED'] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

export const FRIENDSHIP_STATUSES = ['PENDING', 'ACCEPTED'] as const;
export type FriendshipStatus = (typeof FRIENDSHIP_STATUSES)[number];

export const GROUP_GOAL_STATUSES = ['ACTIVE', 'COMPLETED', 'ABANDONED'] as const;
export type GroupGoalStatus = (typeof GROUP_GOAL_STATUSES)[number];

/**
 * TOGETHER — one count the whole group earns. VERSUS — everyone keeps their
 * own days and they are scored in sprints, so the person behind is never more
 * than one sprint away from being level again.
 */
export const GOAL_MODES = ['TOGETHER', 'VERSUS'] as const;
export type GoalMode = (typeof GOAL_MODES)[number];

/** An invitation is not participation — a goal never waits on an INVITED member. */
export const GROUP_MEMBER_STATUSES = ['INVITED', 'JOINED'] as const;
export type GroupMemberStatus = (typeof GROUP_MEMBER_STATUSES)[number];

/** Stored as keys, not emoji: the glyph is a rendering decision. */
export const REACTION_KEYS = ['LIKE', 'FIRE', 'CLAP', 'STRONG', 'HEART'] as const;
export type ReactionKey = (typeof REACTION_KEYS)[number];

export const NOTIFICATION_TYPES = [
  'STREAK_REMINDER',
  'STREAK_AT_RISK',
  'ACHIEVEMENT_UNLOCKED',
  'LEVEL_UP',
  'HEART_EARNED',
  'FRIEND_INVITED',
  'CHALLENGE_AVAILABLE',
  'FRIEND_REQUEST',
  'FRIEND_ACCEPTED',
  'REACTION_RECEIVED',
  'GROUP_GOAL_INVITE',
  'GROUP_GOAL_JOINED',
  'GROUP_GOAL_DAY',
  'GROUP_GOAL_BROKEN',
  'GROUP_GOAL_COMPLETED',
  /** A sprint of a competition closed and the score for it is final. */
  'GROUP_GOAL_SPRINT',
  /** Somebody attached evidence to their day. The only reason proof works. */
  'GROUP_GOAL_PROOF',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

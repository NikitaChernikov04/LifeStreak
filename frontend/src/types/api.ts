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
  /** Days carried over from a tracker the user kept before joining. */
  importedCount: number;
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
  /** t.me link that opens the Mini App with the code in start_param. */
  link: string | null;
  acceptedCount: number;
  hasAcceptedInvite: boolean;
}

// ── social ────────────────────────────────────────────────────

/** OUTGOING — you asked; INCOMING — they did. Different buttons, so different states. */
export type FriendState = 'SELF' | 'NONE' | 'OUTGOING' | 'INCOMING' | 'FRIENDS';
export type ReactionKey = 'LIKE' | 'FIRE' | 'CLAP' | 'STRONG' | 'HEART';

/** A person as they appear in search, lists and the feed. */
export interface PersonCard {
  id: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  avatarUrl: string | null;
  level: number;
  friendState: FriendState;
  requestedAt?: string;
}

export interface FriendRequest {
  id: string;
  createdAt: string;
  user: Omit<PersonCard, 'friendState'>;
}

export interface NotificationSettings {
  dmEnabled: boolean;
  /** Observed, not chosen: Telegram refuses to deliver until the chat is open. */
  botBlocked: boolean;
  botLink: string | null;
}

/** A Telegram group the bot reports into, and where this person is counted. */
export interface Circle {
  id: string;
  title: string;
  memberCount: number;
}

export interface CirclesResponse {
  /** Opens Telegram's own chat picker. Null when the bot has no @username yet. */
  addToGroupLink: string | null;
  circles: Circle[];
}

export interface PrivacySettings {
  isDiscoverable: boolean;
  friends: number;
  pendingRequests: number;
  streaks: { id: string; title: string; icon: string; isShared: boolean; currentCount: number }[];
}

/** A streak as a follower sees it — no goals, no freezes, no internals. */
export interface SharedStreak {
  id: string;
  title: string;
  icon: string;
  color: string;
  currentCount: number;
  longestCount: number;
  importedCount: number;
  status: StreakStatus;
  lastCheckinAt: string | null;
}

export interface PublicProfile extends PersonCard {
  xp: number;
  createdAt: string;
  canView: boolean;
  friends: number;
  streaks: SharedStreak[];
  statistics: {
    totalXp: number;
    totalCheckins: number;
    activeStreaksCount: number;
    longestStreakEver: number;
  } | null;
}

export interface ReactionSummary {
  reactions: { key: ReactionKey; count: number }[];
  reactionCount: number;
  myReaction: ReactionKey | null;
  reactedBy: { id: string; firstName: string; username: string | null }[];
}

export interface FeedEntry extends ReactionSummary {
  id: string;
  date: string;
  createdAt: string;
  usedHeart: boolean;
  user: Omit<PersonCard, 'followState'>;
  streak: {
    id: string;
    title: string;
    icon: string;
    color: string;
    currentCount: number;
    importedCount: number;
  };
}

export interface LeaderboardRow {
  id: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  avatarUrl: string | null;
  level: number;
  isMe: boolean;
  /** Longest streak this person is currently holding. */
  bestStreak: number;
  totalCheckins: number;
  rank: number;
}

export type GroupGoalStatus = 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
export type GroupMemberStatus = 'INVITED' | 'JOINED';

export interface GoalMember {
  id: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  avatarUrl: string | null;
  level: number;
  isMe: boolean;
  markedToday: boolean;
}

/** TOGETHER — one count the group earns. VERSUS — a bet, scored in sprints. */
export type GoalMode = 'TOGETHER' | 'VERSUS';

export interface VersusStanding {
  id: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  avatarUrl: string | null;
  level: number;
  isMe: boolean;
  sprintsWon: number;
  sprintsDrawn: number;
  /** Sprints where they marked every single day. */
  sprintsPerfect: number;
  daysThisSprint: number;
  markedToday: boolean;
}

export interface GoalProof {
  id: string;
  date: string;
  note: string | null;
  url: string | null;
  /** The bytes live in a private store; fetch them through the goal's route. */
  hasImage: boolean;
  author: { id: string; firstName: string; avatarUrl: string | null } | null;
}

/** A proof in the full record, which also says which sprint it fell in. */
export interface GoalProofEntry extends GoalProof {
  /** Null on a joint goal — it has no sprints to belong to. */
  sprint: number | null;
}

/** One entry in the history's day picker. */
export interface ProofDay {
  date: string;
  count: number;
  sprint: number | null;
}

export interface VersusView {
  sprintDays: number;
  sprintCount: number;
  /** 1-based, and never past the last one. */
  sprintNumber: number;
  dayInSprint: number;
  over: boolean;
  standings: VersusStanding[];
  /** Only ever populated for people inside the goal. */
  proofs: GoalProof[];
}

export interface GroupGoal {
  id: string;
  title: string;
  icon: string;
  color: string;
  mode: GoalMode;
  targetDays: number;
  currentCount: number;
  status: GroupGoalStatus;
  ownerId: string;
  isOwner: boolean;
  createdAt: string;
  completedAt: string | null;
  myStatus: GroupMemberStatus | null;
  markedToday: boolean;
  /** Yesterday is missing and a heart can still buy it back. TOGETHER only. */
  atRisk: boolean;
  canRescue: boolean;
  /** Empty in VERSUS: an unmarked day there costs its owner and nobody else. */
  waitingOn: { id: string; firstName: string; isMe: boolean }[];
  members: GoalMember[];
  invited: Omit<GoalMember, 'isMe' | 'markedToday'>[];
  versus: VersusView | null;
}

export interface Paginated<T> {
  items: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface ApiEnvelope<T> {
  success: true;
  data: T;
}

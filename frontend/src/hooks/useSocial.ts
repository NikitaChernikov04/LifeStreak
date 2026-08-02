import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { hapticImpact, hapticNotification } from '@/lib/telegram';
import { useCelebrationStore } from '@/store/useCelebrationStore';
import type {
  FeedEntry,
  FriendRequest,
  FriendState,
  GroupGoal,
  LeaderboardRow,
  Paginated,
  PersonCard,
  PrivacySettings,
  PublicProfile,
  ReactionKey,
  ReactionSummary,
} from '@/types/api';

/** Everything social shares one root key so one accepted request refreshes the lot. */
const SOCIAL = ['social'] as const;

export function useFeed() {
  return useQuery({
    queryKey: [...SOCIAL, 'feed'],
    queryFn: () => api.get<unknown, Paginated<FeedEntry>>('/social/feed'),
  });
}

export function usePrivacySettings() {
  return useQuery({
    queryKey: [...SOCIAL, 'settings'],
    queryFn: () => api.get<unknown, PrivacySettings>('/social/settings'),
  });
}

export function useFriendRequests() {
  return useQuery({
    queryKey: [...SOCIAL, 'requests'],
    queryFn: () => api.get<unknown, FriendRequest[]>('/social/requests'),
  });
}

export function useOutgoingRequests() {
  return useQuery({
    queryKey: [...SOCIAL, 'requests', 'outgoing'],
    queryFn: () => api.get<unknown, PersonCard[]>('/social/requests/outgoing'),
  });
}

export function useLeaderboard() {
  return useQuery({
    queryKey: [...SOCIAL, 'leaderboard'],
    queryFn: () => api.get<unknown, LeaderboardRow[]>('/social/leaderboard'),
  });
}

export function useFriends() {
  return useQuery({
    queryKey: [...SOCIAL, 'friends'],
    queryFn: () => api.get<unknown, PersonCard[]>('/social/friends'),
  });
}

/** Runs only once the query is long enough for the server to accept it. */
export function useUserSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: [...SOCIAL, 'search', q],
    queryFn: () => api.get<unknown, PersonCard[]>(`/social/search?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
  });
}

export function usePublicProfile(userId: string | undefined) {
  return useQuery({
    queryKey: [...SOCIAL, 'user', userId],
    queryFn: () => api.get<unknown, PublicProfile>(`/social/users/${userId}`),
    enabled: Boolean(userId),
  });
}

export function useAddFriend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.post<unknown, { status: FriendState }>(`/social/friends/${userId}`),
    onSuccess: () => {
      hapticImpact('light');
      queryClient.invalidateQueries({ queryKey: SOCIAL });
    },
  });
}

/** Cancels a request either way round, or ends a friendship. */
export function useRemoveFriend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete<unknown, { status: FriendState }>(`/social/friends/${userId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SOCIAL }),
  });
}

export function useRespondToRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      api.post<unknown, { status: FriendState }>(`/social/requests/${id}/${accept ? 'accept' : 'decline'}`),
    onSuccess: () => {
      hapticNotification('success');
      queryClient.invalidateQueries({ queryKey: SOCIAL });
    },
  });
}

export function useUpdatePrivacy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { isDiscoverable?: boolean }) =>
      api.patch<unknown, PrivacySettings>('/social/settings', input),
    onSuccess: (settings) => {
      queryClient.setQueryData([...SOCIAL, 'settings'], settings);
      queryClient.invalidateQueries({ queryKey: SOCIAL });
    },
  });
}

/**
 * Sharing is toggled optimistically: the checkbox is the user's own decision
 * about their own streak, and waiting on a round trip to see it move makes a
 * privacy control feel unreliable.
 */
export function useSetStreakSharing() {
  const queryClient = useQueryClient();
  const key = [...SOCIAL, 'settings'];

  return useMutation({
    mutationFn: ({ streakId, isShared }: { streakId: string; isShared: boolean }) =>
      api.patch<unknown, { id: string; isShared: boolean }>(`/social/streaks/${streakId}/sharing`, {
        isShared,
      }),
    onMutate: async ({ streakId, isShared }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<PrivacySettings>(key);
      if (previous) {
        queryClient.setQueryData<PrivacySettings>(key, {
          ...previous,
          streaks: previous.streaks.map((s) => (s.id === streakId ? { ...s, isShared } : s)),
        });
      }
      hapticImpact('light');
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: SOCIAL }),
  });
}

// ── group goals ───────────────────────────────────────────────

export function useGoals() {
  return useQuery({
    queryKey: [...SOCIAL, 'goals'],
    queryFn: () => api.get<unknown, GroupGoal[]>('/social/goals'),
  });
}

export interface CreateGoalInput {
  title: string;
  icon: string;
  color: string;
  targetDays: number;
  memberIds: string[];
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGoalInput) => api.post<unknown, GroupGoal>('/social/goals', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SOCIAL }),
  });
}

export function useJoinGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (goalId: string) => api.post<unknown, GroupGoal>(`/social/goals/${goalId}/join`),
    onSuccess: () => {
      hapticNotification('success');
      queryClient.invalidateQueries({ queryKey: SOCIAL });
    },
  });
}

/** Declines an invitation, leaves a goal, or — for the owner — ends it. */
export function useLeaveGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (goalId: string) => api.delete<unknown, { ok: boolean }>(`/social/goals/${goalId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SOCIAL }),
  });
}

/** Days worth a stamp. Anything else would make the theatre routine. */
const GOAL_MILESTONES = [7, 14, 30, 50, 100, 180, 365];

/**
 * Marking a group goal celebrates only when the day actually closed for the
 * whole group — the count moving is the group's achievement, not the tap's —
 * and then only at a milestone or the finish. A stamp every single day would
 * stop meaning anything by the third one.
 */
export function useCheckinGoal() {
  const queryClient = useQueryClient();
  const pushCelebration = useCelebrationStore((s) => s.push);

  return useMutation({
    mutationFn: (goal: GroupGoal) =>
      api
        .post<unknown, GroupGoal>(`/social/goals/${goal.id}/checkin`)
        .then((updated) => ({ updated, before: goal })),
    onSuccess: ({ updated, before }) => {
      hapticNotification('success');
      queryClient.invalidateQueries({ queryKey: SOCIAL });
      queryClient.invalidateQueries({ queryKey: ['profile'] });

      const dayClosed = updated.currentCount > before.currentCount;
      if (!dayClosed) return;

      if (updated.status === 'COMPLETED') {
        pushCelebration({
          type: 'milestone',
          days: updated.currentCount,
          icon: updated.icon,
          title: updated.title,
          note: 'Цель взята. Держались все',
        });
        pushCelebration({ type: 'heart', amount: 1 });
      } else if (GOAL_MILESTONES.includes(updated.currentCount)) {
        pushCelebration({
          type: 'milestone',
          days: updated.currentCount,
          icon: updated.icon,
          title: updated.title,
          note: 'Вместе, без пропусков',
        });
      }
    },
  });
}

export function useRescueGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (goalId: string) => api.post<unknown, GroupGoal>(`/social/goals/${goalId}/rescue`),
    onSuccess: () => {
      hapticNotification('success');
      queryClient.invalidateQueries({ queryKey: SOCIAL });
      queryClient.invalidateQueries({ queryKey: ['hearts'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

/**
 * Reacting writes straight into the cached feed entry. The endpoint returns
 * the whole summary for that checkin, so the count stays correct even when
 * someone else reacted in between.
 */
export function useReact() {
  const queryClient = useQueryClient();
  const key = [...SOCIAL, 'feed'];

  return useMutation({
    mutationFn: ({ checkinId, key: reaction }: { checkinId: string; key: ReactionKey | null }) =>
      reaction
        ? api.post<unknown, ReactionSummary & { checkinId: string }>(
            `/social/checkins/${checkinId}/reaction`,
            { key: reaction },
          )
        : api.delete<unknown, ReactionSummary & { checkinId: string }>(
            `/social/checkins/${checkinId}/reaction`,
          ),
    onSuccess: (summary) => {
      hapticImpact('light');
      queryClient.setQueryData<Paginated<FeedEntry>>(key, (old) =>
        old
          ? {
              ...old,
              items: old.items.map((item) =>
                item.id === summary.checkinId ? { ...item, ...summary } : item,
              ),
            }
          : old,
      );
    },
  });
}

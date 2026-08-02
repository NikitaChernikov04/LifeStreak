import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { hapticImpact, hapticNotification } from '@/lib/telegram';
import type {
  FeedEntry,
  FollowRequest,
  FollowState,
  Paginated,
  PersonCard,
  PrivacySettings,
  ProfileVisibility,
  PublicProfile,
  ReactionKey,
  ReactionSummary,
} from '@/types/api';

/** Everything social shares one root key so a follow can refresh the lot. */
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

export function useFollowRequests() {
  return useQuery({
    queryKey: [...SOCIAL, 'requests'],
    queryFn: () => api.get<unknown, FollowRequest[]>('/social/requests'),
  });
}

export function useFollowing() {
  return useQuery({
    queryKey: [...SOCIAL, 'following'],
    queryFn: () => api.get<unknown, PersonCard[]>('/social/following'),
  });
}

export function useFollowers() {
  return useQuery({
    queryKey: [...SOCIAL, 'followers'],
    queryFn: () => api.get<unknown, PersonCard[]>('/social/followers'),
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

export function useFollow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.post<unknown, { status: FollowState }>(`/social/follow/${userId}`),
    onSuccess: () => {
      hapticImpact('light');
      queryClient.invalidateQueries({ queryKey: SOCIAL });
    },
  });
}

export function useUnfollow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete<unknown, { status: FollowState }>(`/social/follow/${userId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SOCIAL }),
  });
}

export function useRespondToRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      api.post<unknown, { status: FollowState }>(`/social/requests/${id}/${accept ? 'accept' : 'decline'}`),
    onSuccess: () => {
      hapticNotification('success');
      queryClient.invalidateQueries({ queryKey: SOCIAL });
    },
  });
}

export function useUpdatePrivacy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { profileVisibility?: ProfileVisibility; isDiscoverable?: boolean }) =>
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

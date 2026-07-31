import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { useCelebrationStore } from '@/store/useCelebrationStore';
import { getStartParam } from '@/lib/telegram';
import type { Invite } from '@/types/api';

export function useMyInvite() {
  return useQuery({
    queryKey: ['invite', 'me'],
    queryFn: () => api.get<unknown, Invite>('/invites/me'),
  });
}

interface AcceptedInvite {
  code: string;
  inviter: { id: string; firstName: string; username: string | null };
}

/** Accepting an invite pays a heart to both sides, so the local user is refreshed. */
export function useAcceptInvite() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const pushCelebration = useCelebrationStore((s) => s.push);

  return useMutation({
    mutationFn: (code: string) => api.post<unknown, AcceptedInvite>('/invites/accept', { code }),
    onSuccess: () => {
      if (user) setUser({ ...user, hearts: Math.min(user.maxHearts, user.hearts + 1) });
      pushCelebration({ type: 'heart', amount: 1 });
      queryClient.invalidateQueries({ queryKey: ['invite'] });
      queryClient.invalidateQueries({ queryKey: ['hearts'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

/**
 * A friend who follows an invite link arrives with the code in `start_param`.
 * Redeeming it has to happen on their behalf: they never see a field to type
 * it into, and asking them to copy a code out of a link they just tapped is
 * exactly the friction that made the old flow go unused.
 *
 * Failures are deliberately silent — the common one is "already accepted",
 * which is not something the user did wrong.
 */
export function useRedeemInviteFromLink(enabled: boolean) {
  const accept = useAcceptInvite();
  const attempted = useRef(false);

  useEffect(() => {
    if (!enabled || attempted.current) return;
    const code = getStartParam();
    if (!code) return;
    attempted.current = true;
    accept.mutate(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}

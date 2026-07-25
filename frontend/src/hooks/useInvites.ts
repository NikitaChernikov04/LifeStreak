import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Invite } from '@/types/api';

export function useMyInvite() {
  return useQuery({
    queryKey: ['invite', 'me'],
    queryFn: () => api.get<unknown, Invite>('/invites/me'),
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { hapticImpact } from '@/lib/telegram';
import type { NotificationSettings } from '@/types/api';

const KEY = ['notification-settings'] as const;

export function useNotificationSettings() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get<unknown, NotificationSettings>('/notifications/settings'),
  });
}

/**
 * Toggled optimistically. This is a switch about being left alone, and one
 * that waits on the network to move reads as though it might not have worked.
 */
export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dmEnabled: boolean) =>
      api.patch<unknown, NotificationSettings>('/notifications/settings', { dmEnabled }),
    onMutate: async (dmEnabled) => {
      await queryClient.cancelQueries({ queryKey: KEY });
      const previous = queryClient.getQueryData<NotificationSettings>(KEY);
      if (previous) queryClient.setQueryData<NotificationSettings>(KEY, { ...previous, dmEnabled });
      hapticImpact('light');
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(KEY, context.previous);
    },
    onSuccess: (settings) => queryClient.setQueryData(KEY, settings),
  });
}

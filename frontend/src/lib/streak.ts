import type { Streak } from '@/types/api';

function toUtcDateString(d: Date): string {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
}

export function isCheckedInToday(streak: Streak): boolean {
  if (!streak.lastCheckinAt) return false;
  return toUtcDateString(new Date(streak.lastCheckinAt)) === toUtcDateString(new Date());
}

/** True when exactly one day was missed and a heart can still recover it. */
export function isRecoverable(streak: Streak): boolean {
  if (!streak.lastCheckinAt) return false;
  const last = new Date(streak.lastCheckinAt);
  const today = new Date();
  const diffDays = Math.round(
    (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
      Date.UTC(last.getFullYear(), last.getMonth(), last.getDate())) /
      86_400_000,
  );
  return diffDays === 2;
}

export function progressToGoal(streak: Streak): number {
  if (streak.nextGoal <= 0) return 100;
  return Math.min(100, (streak.currentCount / streak.nextGoal) * 100);
}

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

/**
 * A day the backend counted, written out.
 *
 * These dates are UTC midnight, not moments — the whole app decides what "a
 * day" is in UTC. Rendering one in local time labels it a day early for
 * everybody west of UTC: a proof attached on the 4th reads "3 авг." in New
 * York. Formatting in UTC is what makes the label agree with the count.
 */
export function formatDayMark(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function pluralizeDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'дней';
  if (mod10 === 1) return 'день';
  if (mod10 >= 2 && mod10 <= 4) return 'дня';
  return 'дней';
}

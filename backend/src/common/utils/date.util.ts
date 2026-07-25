const DAY_MS = 24 * 60 * 60 * 1000;

export function toUtcDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function todayUtc(): Date {
  return toUtcDate(new Date());
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((toUtcDate(b).getTime() - toUtcDate(a).getTime()) / DAY_MS);
}

export const ONE_DAY_MS = DAY_MS;

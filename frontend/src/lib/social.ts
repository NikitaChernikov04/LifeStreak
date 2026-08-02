import type { PersonCard, ReactionKey } from '@/types/api';

/** The glyph is a rendering choice — the server stores keys. */
export const REACTIONS: { key: ReactionKey; glyph: string; label: string }[] = [
  { key: 'LIKE', glyph: '👍', label: 'Так держать' },
  { key: 'FIRE', glyph: '🔥', label: 'Огонь' },
  { key: 'CLAP', glyph: '👏', label: 'Браво' },
  { key: 'STRONG', glyph: '💪', label: 'Сила' },
  { key: 'HEART', glyph: '❤️', label: 'Поддержка' },
];

export function displayName(person: Pick<PersonCard, 'firstName' | 'lastName'>): string {
  return [person.firstName, person.lastName].filter(Boolean).join(' ');
}

export function initials(person: Pick<PersonCard, 'firstName' | 'lastName'>): string {
  return [person.firstName?.[0], person.lastName?.[0]].filter(Boolean).join('');
}

/**
 * The feed is read in one sitting, so entries are dated relative to now and
 * only fall back to a calendar date once "days ago" stops meaning anything.
 */
export function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ч`;

  const days = Math.round(hours / 24);
  if (days === 1) return 'вчера';
  if (days < 7) return `${days} дн`;

  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function requestsLine(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} заявок`;
  if (mod10 === 1) return `${n} заявка`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} заявки`;
  return `${n} заявок`;
}

export function friendsLine(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (n === 0) return 'друзей пока нет';
  if (mod100 >= 11 && mod100 <= 14) return `${n} друзей`;
  if (mod10 === 1) return `${n} друг`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} друга`;
  return `${n} друзей`;
}

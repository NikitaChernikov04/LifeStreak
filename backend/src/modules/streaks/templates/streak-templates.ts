export interface StreakTemplate {
  key: string;
  title: string;
  icon: string;
  color: string;
}

/** Popular streak templates shown in the "create streak" screen. */
// Colours are pigments, matching the frontend's margin-tab palette — saturated
// web colours read as neon against the app's paper surface.
export const STREAK_TEMPLATES: StreakTemplate[] = [
  { key: 'reading', title: 'Чтение', icon: '📚', color: '#B8862F' },
  { key: 'sport', title: 'Спорт', icon: '🏃', color: '#96543F' },
  { key: 'coding', title: 'Код', icon: '💻', color: '#2F4858' },
  { key: 'english', title: 'Английский', icon: '🇬🇧', color: '#4A6FA5' },
  { key: 'no_smoking', title: 'Без сигарет', icon: '🚭', color: '#3E6B5A' },
  { key: 'no_sugar', title: 'Без сахара', icon: '🍔', color: '#7A7D3C' },
  { key: 'meditation', title: 'Медитация', icon: '🧘', color: '#6B4C7A' },
  { key: 'steps', title: 'Шаги', icon: '🚶', color: '#3F7A78' },
];

/** Milestones shown as the "next goal" on a streak card. */
const MILESTONES = [7, 14, 30, 50, 100, 180, 365, 500, 730, 1000];

export function nextGoalFor(currentCount: number): number {
  const next = MILESTONES.find((m) => m > currentCount);
  if (next) return next;
  // Beyond 1000 days, keep pushing the goal in yearly increments.
  return currentCount + 365;
}

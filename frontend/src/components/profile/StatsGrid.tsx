import type { Statistics } from '@/types/api';

/**
 * A table of readings with dot leaders, the way a contents page or a lab
 * summary sets figures against their labels. Boxes would only add noise.
 */
export function StatsGrid({ stats }: { stats: Statistics }) {
  const rows = [
    { label: 'Дней записано', value: stats.totalCheckins },
    { label: 'Серий в работе', value: stats.activeStreaksCount },
    { label: 'Лучшая серия', value: stats.longestStreakEver },
    { label: 'Всего XP', value: stats.totalXp },
  ];

  return (
    <dl className="space-y-0">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline gap-2 border-b border-ink/15 py-2.5">
          <dt className="shrink-0 text-[0.9375rem]">{row.label}</dt>
          <span
            aria-hidden
            className="min-w-4 flex-1 translate-y-[-3px] border-b border-dotted border-ink/30"
          />
          <dd className="figure shrink-0 text-lg font-medium">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

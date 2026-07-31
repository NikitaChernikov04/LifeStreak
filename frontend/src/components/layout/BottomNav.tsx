import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { hapticImpact } from '@/lib/telegram';

/** Named for what's on the page, not for the app's structure. */
const items = [
  { to: '/', label: 'Сегодня' },
  { to: '/achievements', label: 'Достижения' },
  { to: '/profile', label: 'Профиль' },
];

/** Index tabs along the bottom edge of the notebook. The active one is inked in. */
export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink bg-paper pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md">
        {items.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => hapticImpact('light')}
            className={({ isActive }) =>
              cn(
                'flex flex-1 items-center justify-center border-b-2 py-3.5 font-display text-sm uppercase tracking-[0.12em] transition-colors',
                isActive ? 'border-ink text-ink' : 'border-transparent text-graphite',
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

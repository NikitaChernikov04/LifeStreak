import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { hapticImpact } from '@/lib/telegram';
import { useFriendRequests } from '@/hooks/useSocial';

/**
 * Named for what's on the page, not for the app's structure. Labels are kept
 * to one short word each: at four tabs a 320px screen gives every index tab
 * eighty pixels, and "Достижения" does not fit in eighty pixels.
 */
const items = [
  { to: '/', label: 'Сегодня' },
  { to: '/friends', label: 'Друзья' },
  { to: '/achievements', label: 'Награды' },
  { to: '/profile', label: 'Профиль' },
];

/** Index tabs along the bottom edge of the notebook. The active one is inked in. */
export function BottomNav() {
  const { data: requests } = useFriendRequests();
  const pending = requests?.length ?? 0;

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
                'relative flex min-w-0 flex-1 items-center justify-center border-b-2 py-3.5 font-display text-[0.8125rem] uppercase tracking-[0.08em] transition-colors',
                isActive ? 'border-ink text-ink' : 'border-transparent text-graphite',
              )
            }
          >
            {label}
            {/* Waiting requests are the one thing worth interrupting a page for. */}
            {to === '/friends' && pending > 0 && (
              <span aria-hidden className="ml-1 h-1.5 w-1.5 shrink-0 bg-vermilion" />
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

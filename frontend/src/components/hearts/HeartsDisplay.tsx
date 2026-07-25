import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Hearts drawn as pen marks rather than icons: an angular V-bottom heart with
 * two arcs, filled in ochre once earned. Ochre is the colour of everything the
 * user has been awarded — vermilion is kept strictly for broken records.
 */
function InkHeart({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn('h-4 w-4', className)} aria-hidden>
      <path
        d="M8 14 L2.6 8.4 A3.1 3.1 0 0 1 8 4.5 A3.1 3.1 0 0 1 13.4 8.4 Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface HeartsDisplayProps {
  hearts: number;
  maxHearts: number;
  className?: string;
}

export function HeartsDisplay({ hearts, maxHearts, className }: HeartsDisplayProps) {
  return (
    <div
      className={cn('flex items-center gap-1', className)}
      role="img"
      aria-label={`Сердец: ${hearts} из ${maxHearts}`}
    >
      {Array.from({ length: maxHearts }).map((_, i) => {
        const filled = i < hearts;
        return (
          <motion.span
            key={i}
            initial={false}
            animate={filled ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.35 }}
            className={filled ? 'text-ochre' : 'text-graphite/45'}
          >
            <InkHeart filled={filled} />
          </motion.span>
        );
      })}
    </div>
  );
}

export { InkHeart };

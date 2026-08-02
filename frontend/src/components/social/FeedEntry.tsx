import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ReactionBar } from './ReactionBar';
import { displayName, initials, timeAgo } from '@/lib/social';
import { pluralizeDays } from '@/lib/streak';
import type { FeedEntry as Entry } from '@/types/api';

/**
 * One line of somebody else's journal. Same ruled entry as the home screen so
 * the two pages read as one notebook — the difference is whose hand wrote it.
 */
export function FeedEntry({ entry }: { entry: Entry }) {
  const { user, streak } = entry;

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="flex gap-3 border-b border-ink/15 py-4"
    >
      <Link to={`/u/${user.id}`} className="shrink-0">
        <Avatar className="h-10 w-10">
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} />}
          <AvatarFallback className="bg-indigo text-sm text-paper">{initials(user)}</AvatarFallback>
        </Avatar>
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <Link
            to={`/u/${user.id}`}
            className="min-w-0 truncate font-display text-base uppercase leading-tight tracking-[0.04em]"
          >
            {displayName(user)}
          </Link>
          <span className="figure shrink-0 text-micro uppercase text-graphite">
            {timeAgo(entry.createdAt)}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center border text-base"
            style={{ borderColor: streak.color, backgroundColor: `${streak.color}1F` }}
          >
            {streak.icon}
          </span>
          <p className="min-w-0 flex-1">
            <span className="block truncate font-display text-base uppercase leading-tight tracking-[0.04em]">
              {streak.title}
            </span>
            <span className="font-mono text-micro uppercase text-graphite">
              <span className="figure">{streak.currentCount}</span> {pluralizeDays(streak.currentCount)} подряд
              {entry.usedHeart && ' · восстановлено сердцем'}
            </span>
          </p>
        </div>

        <ReactionBar className="mt-2.5" checkinId={entry.id} summary={entry} />
      </div>
    </motion.article>
  );
}

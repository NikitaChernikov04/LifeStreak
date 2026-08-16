import type { GroupGoal } from '@/types/api';

/**
 * A goal or bet that is over.
 *
 * A bet can run out of calendar without anybody closing it — `versus.over` is
 * computed from the sprint count rather than stored — so status alone would
 * leave finished competitions sitting on the screen with no action left on
 * them. Kept here rather than in each card so the archive and the cards can
 * never disagree about what "closed" means.
 */
export function isGoalClosed(goal: GroupGoal): boolean {
  if (goal.status === 'COMPLETED') return true;
  return goal.mode === 'VERSUS' && Boolean(goal.versus?.over);
}

/** One line saying how it ended — the only thing a closed goal still owes. */
export function goalOutcome(goal: GroupGoal): string {
  if (goal.mode !== 'VERSUS') {
    return goal.currentCount >= goal.targetDays
      ? `взята · ${goal.targetDays} из ${goal.targetDays}`
      : `закрыта · ${goal.currentCount} из ${goal.targetDays}`;
  }

  const standings = goal.versus?.standings ?? [];
  const me = standings.find((p) => p.isMe);
  const rivals = standings.filter((p) => !p.isMe);
  if (!me || rivals.length === 0) return 'спор закрыт';

  const best = Math.max(...rivals.map((r) => r.sprintsWon));
  const leader = rivals.find((r) => r.sprintsWon === best);
  const score = `${me.sprintsWon} : ${best}`;

  if (me.sprintsWon > best) return `${score} — спор твой`;
  if (me.sprintsWon < best) return `${score} — взял ${leader?.firstName ?? 'соперник'}`;
  return `${score} — ничья`;
}

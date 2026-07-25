/**
 * XP required to reach a given level grows linearly per-level (500 XP/level),
 * which keeps early levels fast (dopamine hit in the first week) while later
 * levels require sustained engagement.
 */
const XP_PER_LEVEL = 500;

export function levelForXp(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

export function xpIntoCurrentLevel(xp: number): { current: number; needed: number } {
  return { current: xp % XP_PER_LEVEL, needed: XP_PER_LEVEL };
}

export interface XpApplyResult {
  xp: number;
  level: number;
  leveledUp: boolean;
}

export function applyXpGain(previousXp: number, gain: number): XpApplyResult {
  const previousLevel = levelForXp(previousXp);
  const xp = previousXp + gain;
  const level = levelForXp(xp);
  return { xp, level, leveledUp: level > previousLevel };
}

// Mirrors backend/src/common/utils/leveling.util.ts — 500 XP per level.
const XP_PER_LEVEL = 500;

export function xpIntoCurrentLevel(xp: number): { current: number; needed: number } {
  return { current: xp % XP_PER_LEVEL, needed: XP_PER_LEVEL };
}

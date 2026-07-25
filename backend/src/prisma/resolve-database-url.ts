import * as path from 'path';

// backend/src/prisma (dev, ts-node) and backend/dist/prisma (compiled) are both
// exactly two levels above backend/prisma — see tsconfig.build.json's rootDir.
const PRISMA_DIR = path.resolve(__dirname, '../../prisma');

/**
 * Turso URLs (`libsql://...`) and absolute `file:` paths pass through unchanged.
 * A bare relative `file:` URL is resolved against `prisma/`, matching how the
 * Prisma CLI resolves it for `db push` / `migrate dev` / `db seed` (relative to
 * schema.prisma's directory) — so the CLI and the running app always agree on
 * the same physical SQLite file during local development.
 */
export function resolveDatabaseUrl(url: string): string {
  if (!url.startsWith('file:')) return url;
  const rawPath = url.slice('file:'.length);
  if (path.isAbsolute(rawPath)) return url;
  return `file:${path.resolve(PRISMA_DIR, rawPath)}`;
}

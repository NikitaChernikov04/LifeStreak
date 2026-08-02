/**
 * Applies prisma/migrations/*\/migration.sql to a libSQL/Turso database.
 *
 * `prisma migrate deploy` cannot talk to libsql:// URLs, so this walks the
 * same migration folder Prisma generates and runs each file once, tracking
 * what has been applied in its own table. Safe to run on every deploy.
 *
 * Usage:
 *   DATABASE_URL=libsql://<db>-<org>.turso.io TURSO_AUTH_TOKEN=... \
 *     node scripts/apply-schema.mjs
 */
import { createClient } from '@libsql/client';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../prisma/migrations');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

// Mirrors src/prisma/resolve-database-url.ts: a relative `file:` URL means
// "relative to prisma/", the way the Prisma CLI reads it. Resolving it against
// the current directory instead would quietly create a second SQLite file and
// migrate that one, leaving the database the app actually opens untouched.
function resolveUrl(raw) {
  if (!raw.startsWith('file:')) return raw;
  const filePath = raw.slice('file:'.length);
  if (path.isAbsolute(filePath)) return raw;
  return `file:${path.resolve(MIGRATIONS_DIR, '..', filePath)}`;
}

const client = createClient({ url: resolveUrl(url), authToken: process.env.TURSO_AUTH_TOKEN });

await client.execute(`
  CREATE TABLE IF NOT EXISTS _schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )
`);

const applied = new Set(
  (await client.execute('SELECT name FROM _schema_migrations')).rows.map((r) => String(r.name)),
);

const entries = (await readdir(MIGRATIONS_DIR, { withFileTypes: true }))
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

let count = 0;
for (const name of entries) {
  if (applied.has(name)) {
    console.log(`· ${name} (already applied)`);
    continue;
  }

  // Strip a UTF-8 BOM: an editor (or PowerShell's `Out-File -Encoding utf8`)
  // can leave one, and the server rejects the statement with a bare HTTP 400.
  const sql = (await readFile(path.join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8')).replace(
    /^﻿/,
    '',
  );
  await client.executeMultiple(sql);
  await client.execute({
    sql: 'INSERT INTO _schema_migrations (name, applied_at) VALUES (?, ?)',
    args: [name, new Date().toISOString()],
  });
  console.log(`✓ ${name}`);
  count += 1;
}

console.log(count === 0 ? 'Schema already up to date.' : `Applied ${count} migration(s).`);
client.close();

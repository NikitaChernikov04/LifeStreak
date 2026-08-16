/**
 * Brings the Postgres database into line with the live Turso/SQLite one.
 *
 * This exists because the schema move is not the migration anybody cares
 * about — eleven people have streaks in the old database, and a streak that
 * restarts at zero is the one bug this product cannot ship.
 *
 * Rows go over verbatim, in foreign-key order, keeping their original cuids so
 * every reference still resolves. The only translation is of types SQLite does
 * not have: it stores booleans as 0/1, and dates as text Postgres will not
 * take as a timestamp. The declared column types come from PRAGMA table_info
 * rather than a hand-written list, so a column added later is converted
 * correctly without editing this.
 *
 * **Re-runnable on purpose.** A first run cannot be the last one: people keep
 * using the app while the copy is being checked, and a straight insert-only
 * import goes stale the moment somebody marks a day. Worse, it goes stale
 * invisibly — comparing row counts catches the new check-in but not the
 * `currentCount`, `xp` and `statistics` that same check-in moved. So every row
 * is written as an upsert on its primary key, which makes this safe to run
 * again immediately before the cutover, and again immediately after it, until
 * the two databases agree. Nothing is ever deleted here, so a run that finds
 * nothing new does nothing at all.
 *
 * Everything is read out of Turso before anything is written, and the write is
 * one transaction: the link to Turso drops often enough to have interrupted a
 * trial run, and a failure must leave the target exactly as it was.
 *
 *   DATABASE_URL=<postgres> DIRECT_URL=<postgres session url> \
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... \
 *     node scripts/import-from-turso.mjs
 */
import { createClient } from '@libsql/client';
import { PrismaClient } from '@prisma/client';

// Parents before children. `_schema_migrations` is the old runner's bookkeeping
// and has no counterpart here — Postgres has `_prisma_migrations` instead.
const TABLES = [
  'users',
  'streaks',
  'daily_checkins',
  'reactions',
  'challenge_templates',
  'daily_challenges',
  'achievement_definitions',
  'user_achievements',
  'heart_transactions',
  'statistics',
  'invites',
  'friendships',
  'group_goals',
  'group_goal_members',
  'group_goal_checkins',
  'chat_circles',
  'chat_circle_members',
  'notifications',
];

const tursoUrl = process.env.TURSO_DATABASE_URL;
if (!tursoUrl) {
  console.error('TURSO_DATABASE_URL is not set');
  process.exit(1);
}
if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
  console.error('DIRECT_URL (or DATABASE_URL) is not set');
  process.exit(1);
}

const sqlite = createClient({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN });
// A bulk copy is a long single session, not a burst of short requests: it
// belongs on the direct connection, not in the pooler.
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
});

/**
 * Turso's edge endpoint times out often enough that a bare read is not safe to
 * build a migration on. Trial runs died on it twice, and once with three
 * retries already in place — hence seven attempts and a backoff that reaches
 * half a minute. This runs once, so patience costs nothing and giving up costs
 * a retry of the whole copy.
 */
async function read(sql, attempt = 1) {
  try {
    return await sqlite.execute(sql);
  } catch (error) {
    if (attempt >= 7) throw error;
    const wait = 500 * 2 ** attempt;
    console.warn(`  … ${sql.slice(0, 40)} failed (${error.message}); retrying in ${wait}ms`);
    await new Promise((r) => setTimeout(r, wait));
    return read(sql, attempt + 1);
  }
}

/** SQLite's declared type for each column, e.g. { usedHeart: 'BOOLEAN' }. */
async function columnTypes(table) {
  const info = await read(`PRAGMA table_info("${table}")`);
  return Object.fromEntries(info.rows.map((r) => [String(r.name), String(r.type).toUpperCase()]));
}

function convert(value, declaredType) {
  if (value === null || value === undefined) return null;
  if (declaredType === 'BOOLEAN') return Boolean(Number(value));
  if (declaredType === 'DATETIME') {
    // The libSQL adapter writes ISO text with an explicit +00:00 offset
    // ("2026-07-25T00:00:00+00:00"); Prisma's plain SQLite connector writes
    // epoch milliseconds instead, so both are accepted rather than trusting
    // one shape. The result is handed on as an ISO string, not a Date — see
    // placeholder() for why.
    const raw = typeof value === 'bigint' ? Number(value) : value;
    return (typeof raw === 'number' ? new Date(raw) : new Date(String(raw))).toISOString();
  }
  if (typeof value === 'bigint') return Number(value);
  return value;
}

/**
 * Postgres columns generated for a Prisma `DateTime` are `timestamp` — without
 * a time zone — and a driver handed a bare timestamp is free to read it in
 * whatever zone the session happens to be in. A trial run proved the point:
 * midnight UTC came back as 17:00 the previous day, which would have moved
 * every check-in to the day before and silently rewritten whose sprint was
 * whose.
 *
 * So the value crosses as an ISO string and the interpretation is pinned in
 * SQL. `::timestamptz` reads the offset that is written in the string, and
 * `AT TIME ZONE 'UTC'` lands the wall clock in UTC — neither step consults the
 * session, the driver, or this laptop.
 */
function placeholder(index, declaredType) {
  return declaredType === 'DATETIME'
    ? `$${index}::timestamptz AT TIME ZONE 'UTC'`
    : `$${index}`;
}

const [{ count: before }] = await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "users"`;
console.log(before === 0 ? 'target is empty — first run' : `target already has ${before} users — syncing`);

console.log('reading Turso…');
const expected = {};
const writes = [];

for (const table of TABLES) {
  const types = await columnTypes(table);
  const { rows } = await read(`SELECT * FROM "${table}"`);
  expected[table] = rows.length;
  if (rows.length === 0) {
    console.log(`· ${table} (empty)`);
    continue;
  }

  const columns = Object.keys(types);
  const placeholders = columns.map((c, i) => placeholder(i + 1, types[c])).join(', ');
  // Upsert, not insert — see the note at the top on why this has to be
  // re-runnable. Every non-key column is overwritten, so a row that changed in
  // Turso after an earlier run is corrected rather than skipped.
  const assignments = columns
    .filter((c) => c !== 'id')
    .map((c) => `"${c}" = EXCLUDED."${c}"`)
    .join(', ');
  const sql =
    `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders}) ` +
    (assignments ? `ON CONFLICT ("id") DO UPDATE SET ${assignments}` : `ON CONFLICT ("id") DO NOTHING`);

  for (const row of rows) {
    writes.push(prisma.$executeRawUnsafe(sql, ...columns.map((c) => convert(row[c], types[c]))));
  }
  console.log(`· ${table} — ${rows.length}`);
}

sqlite.close();

console.log(`\nwriting ${writes.length} row(s) in one transaction…`);
await prisma.$transaction(writes);

// A count that matches is the only proof the copy is complete; a silent
// success on a script like this is worth nothing.
console.log('verifying…');
let mismatch = false;
for (const table of TABLES) {
  const [{ count }] = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS count FROM "${table}"`,
  );
  if (expected[table] !== count) {
    console.error(`✗ ${table}: ${expected[table]} in Turso, ${count} in Postgres`);
    mismatch = true;
  }
}

await prisma.$disconnect();

if (mismatch) {
  console.error('\nRow counts differ — do not point production at this database.');
  process.exit(1);
}
console.log(`\nImported ${writes.length} row(s); every table matches.`);

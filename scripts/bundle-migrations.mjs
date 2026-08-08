/**
 * Concatenates migrations into one file for the Supabase SQL Editor.
 *
 * The editor has no notion of migration ordering, and running the files by
 * hand invites getting the order wrong — which fails confusingly, since later
 * migrations reference tables and functions created by earlier ones.
 *
 * Migrations are NOT idempotent: `create type` and `create table` both error
 * if the object already exists. So once a database is partly migrated, the
 * full bundle is the wrong thing to run.
 *
 *   npm run db:bundle                  every migration (fresh database)
 *   npm run db:bundle -- --since=NAME  only migrations after NAME (existing)
 *   npm run db:bundle -- --only=NAME   exactly one migration
 *
 * NAME may be a full filename or any unique fragment of one.
 *
 * Output is generated, gitignored, and safe to delete.
 */

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "supabase", "migrations");
const outputPath = join(root, "supabase", "bundled-schema.sql");

function readFlag(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

const since = readFlag("since");
const only = readFlag("only");

const all = (await readdir(migrationsDir))
  .filter((name) => name.endsWith(".sql"))
  // Filenames are timestamp-prefixed, so lexical order is execution order.
  .sort();

if (all.length === 0) {
  console.error("No .sql files found in supabase/migrations");
  process.exit(1);
}

function resolveOne(fragment) {
  const matches = all.filter((name) => name.includes(fragment));
  if (matches.length === 0) {
    console.error(`No migration matches "${fragment}". Available:`);
    for (const name of all) console.error(`  - ${name}`);
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error(`"${fragment}" is ambiguous. It matches:`);
    for (const name of matches) console.error(`  - ${name}`);
    process.exit(1);
  }
  return matches[0];
}

let files = all;
let scope = "every migration";

if (only) {
  files = [resolveOne(only)];
  scope = `only ${files[0]}`;
} else if (since) {
  const anchor = resolveOne(since);
  files = all.slice(all.indexOf(anchor) + 1);
  scope = `migrations after ${anchor}`;
  if (files.length === 0) {
    console.log(`Nothing to bundle — ${anchor} is the most recent migration.`);
    process.exit(0);
  }
}

const header = `-- =========================================================================
-- RRBA — bundled schema
--
-- GENERATED FILE. Do not edit; edit the files in supabase/migrations instead
-- and re-run \`npm run db:bundle\`.
--
-- Scope: ${scope} (${files.length} file${files.length === 1 ? "" : "s"}).
--
-- Paste into the Supabase SQL Editor and run once. Migrations are not
-- idempotent, so running one that has already been applied will error on the
-- first object it tries to re-create.
-- =========================================================================

`;

const parts = [header];

for (const file of files) {
  const sql = await readFile(join(migrationsDir, file), "utf8");
  parts.push(
    `\n-- ─────────────────────────────────────────────────────────────────────\n` +
      `-- ${file}\n` +
      `-- ─────────────────────────────────────────────────────────────────────\n\n` +
      sql.trimEnd() +
      "\n",
  );
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, parts.join(""), "utf8");

const lines = parts.join("").split("\n").length;
console.log(`Bundled ${files.length} migration(s) -> supabase/bundled-schema.sql`);
console.log(`${lines} lines. Scope: ${scope}.`);
for (const file of files) console.log(`  - ${file}`);

if (!since && !only && all.length > 1) {
  console.log("");
  console.log("This is the FULL schema, for a fresh database.");
  console.log("If your database is already migrated, bundle only what is new:");
  console.log(`  npm run db:bundle -- --since=${all[all.length - 2]}`);
}

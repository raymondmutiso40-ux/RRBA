/**
 * Concatenates every migration into one file for the Supabase SQL Editor.
 *
 * The editor has no notion of migration ordering, and running six files by
 * hand invites getting the order wrong — which fails confusingly, since later
 * migrations reference tables and functions created by earlier ones.
 *
 * Output is generated, gitignored, and safe to delete. Re-run after adding a
 * migration:  npm run db:bundle
 */

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "supabase", "migrations");
const outputPath = join(root, "supabase", "bundled-schema.sql");

const files = (await readdir(migrationsDir))
  .filter((name) => name.endsWith(".sql"))
  // Filenames are timestamp-prefixed, so lexical order is execution order.
  .sort();

if (files.length === 0) {
  console.error("No .sql files found in supabase/migrations");
  process.exit(1);
}

const header = `-- =========================================================================
-- RRBA — bundled schema
--
-- GENERATED FILE. Do not edit; edit the files in supabase/migrations instead
-- and re-run \`npm run db:bundle\`.
--
-- Paste the whole thing into the Supabase SQL Editor and run once. The
-- migrations are concatenated in filename order, which is execution order.
--
-- Running this twice will error on the second pass, because the tables and
-- types already exist. That is expected, and harmless.
--
-- Bundled ${files.length} migrations.
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
console.log(`Bundled ${files.length} migrations -> supabase/bundled-schema.sql`);
console.log(`${lines} lines. Paste into the Supabase SQL Editor and run once.`);
for (const file of files) console.log(`  - ${file}`);

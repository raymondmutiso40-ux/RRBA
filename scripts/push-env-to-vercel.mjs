/**
 * Copy the credentials in .env.local up to the linked Vercel project.
 *
 * Run after `vercel login` and `vercel link`:
 *
 *   npm run env:push
 *
 * Values are piped straight from .env.local into the Vercel CLI, so no secret
 * is ever printed to the terminal or written anywhere else. Re-running is safe:
 * each variable is removed before being re-added, so this doubles as "update".
 *
 * NEXT_PUBLIC_SITE_URL is deliberately skipped. It is localhost in .env.local,
 * and getSiteUrl() already derives the right origin from Vercel's own env vars.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TARGETS = ["production", "preview", "development"];

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];
const OPTIONAL = ["BOOTSTRAP_ADMIN_EMAIL"];

function parseEnvFile(path) {
  const out = new Map();
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    console.error(`Could not read ${path}. Are you in the project root?`);
    process.exit(1);
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value) out.set(key, value);
  }
  return out;
}

function vercel(args, { input, quiet = true } = {}) {
  return execFileSync("vercel", args, {
    cwd: ROOT,
    input,
    encoding: "utf8",
    stdio: quiet ? ["pipe", "pipe", "pipe"] : "inherit",
    shell: process.platform === "win32",
  });
}

const env = parseEnvFile(join(ROOT, ".env.local"));

const missing = REQUIRED.filter((k) => !env.has(k));
if (missing.length > 0) {
  console.error("These are blank in .env.local and must be set first:");
  for (const k of missing) console.error(`  - ${k}`);
  process.exit(1);
}

// Check the link file rather than calling the CLI: an unauthenticated CLI
// starts an interactive login instead of exiting non-zero, which would slip
// past a try/catch and then fail on every single write. Linking is only
// possible while logged in, so this one file proves both.
if (!existsSync(join(ROOT, ".vercel", "project.json"))) {
  console.error("This project is not linked to Vercel yet. Run these first:");
  console.error("  vercel login");
  console.error("  vercel link");
  process.exit(1);
}

const names = [...REQUIRED, ...OPTIONAL.filter((k) => env.has(k))];
let failures = 0;

for (const name of names) {
  const value = env.get(name);
  for (const target of TARGETS) {
    // Remove first so a re-run updates rather than erroring on a duplicate.
    try {
      vercel(["env", "rm", name, target, "--yes"]);
    } catch {
      // Not present yet, which is the normal case on a first run.
    }
    try {
      vercel(["env", "add", name, target], { input: `${value}\n` });
      console.log(`  set ${name} -> ${target}`);
    } catch (error) {
      failures += 1;
      const detail = (error.stderr || error.message || "").trim().split("\n")[0];
      console.error(`  FAILED ${name} -> ${target}: ${detail}`);
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} variable(s) failed to set.`);
  process.exit(1);
}

console.log(`\nDone. ${names.length} variable(s) set across ${TARGETS.length} environments.`);
console.log("Environment changes only apply to new builds. Deploy with:");
console.log("  vercel --prod");

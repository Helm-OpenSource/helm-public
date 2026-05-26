#!/usr/bin/env tsx
/**
 * docs-lifecycle-find-eligible-packet — print the path of the most-recent
 * docs-owner-review-packet that is >= --grace-days old.
 *
 * Used by .github/workflows/docs-lifecycle-auto-apply.yml so the cron can
 * pick the packet to feed into docs-lifecycle-auto-apply.ts without
 * humans hard-coding a month.
 *
 * Exit codes:
 *   0   one or more eligible packets found; print path of the most-recent one
 *       to stdout. (No newline trickery; just the relative path.)
 *   3   no eligible packet found (all packets are too new, or none exist).
 *       Workflow should treat this as a no-op success.
 *   1   I/O error.
 *
 * Usage:
 *   npx tsx scripts/docs-lifecycle-find-eligible-packet.ts
 *   npx tsx scripts/docs-lifecycle-find-eligible-packet.ts --grace-days 30
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_GRACE_DAYS = 30;

function main(): void {
  const argv = process.argv.slice(2);
  const graceIdx = argv.indexOf("--grace-days");
  const graceDays = graceIdx !== -1 ? Number(argv[graceIdx + 1]) : DEFAULT_GRACE_DAYS;

  const dir = path.join(REPO_ROOT, "docs", "internal");
  if (!existsSync(dir)) {
    console.error(`docs/internal not found: ${dir}`);
    process.exit(1);
  }

  const candidates = readdirSync(dir)
    .filter((f) => f.startsWith("docs-owner-review-packet-") && f.endsWith(".json"))
    .sort()
    .reverse(); // newest first by filename (YYYY-MM lex sorts correctly)

  const nowMs = Date.now();
  const graceMs = graceDays * 86_400_000;

  for (const fname of candidates) {
    try {
      const full = path.join(dir, fname);
      const packet = JSON.parse(readFileSync(full, "utf8")) as { generatedAt?: string };
      if (!packet.generatedAt) continue;
      const age = nowMs - new Date(packet.generatedAt).getTime();
      if (age >= graceMs) {
        console.log(path.relative(REPO_ROOT, full));
        process.exit(0);
      }
    } catch {
      // Skip malformed packet
      continue;
    }
  }

  console.error(`No eligible packet found (grace=${graceDays}d). All ${candidates.length} packets are too new.`);
  process.exit(3);
}

main();

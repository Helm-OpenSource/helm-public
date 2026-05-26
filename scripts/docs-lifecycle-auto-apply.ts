#!/usr/bin/env tsx
/**
 * docs-lifecycle-auto-apply — implement HELM_DOC_LIFECYCLE_POLICY_V1 §1.4
 * "30 天未反驳 → 候选自动应用降档".
 *
 * Workflow per policy:
 *   1. Month-start cron generates docs-owner-review-packet-<YYYY-MM>.json
 *      (via scripts/docs-owner-review-packet.ts).
 *   2. Owner has 30 days to review / refute candidates.
 *   3. Items the owner does NOT touch within 30 days → auto-applied here.
 *
 * "Did the owner touch it?" signal:
 *   A. The file was committed (any change) AFTER the packet's generatedAt.
 *   B. Or the file's current frontmatter status no longer matches what the
 *      packet recorded (status was already changed externally).
 * If either is true → the owner addressed it → SKIP auto-apply.
 *
 * Auto-actions by packet bucket:
 *   - dormantCandidates       → promote status -> dormant
 *   - archiveReady            → promote status -> archived
 *                               (physical move handled by docs-archive-mover later)
 *   - pendingPhysicalMove     → NO frontmatter change; only invoked here for audit log.
 *                               Operator runs scripts/docs-archive-mover.ts --apply
 *                               separately.
 *   - staleFrontmatter        → NOT auto-applied. Policy §1.4 implies manual.
 *   - suspiciousPatternActive → NOT auto-applied. Manual review required.
 *
 * Safety:
 *   - Default DRY-RUN. Pass --apply to actually write.
 *   - --max-promotions caps changes per invocation (default 50).
 *   - --grace-days overrides the 30-day window (for testing or policy variance).
 *   - Audit log written to docs/internal/docs-lifecycle-auto-apply-<date>.json.
 *   - Per-file frontmatter audit comment line:
 *       "# auto-applied per HELM_DOC_LIFECYCLE_POLICY_V1 §1.4 on YYYY-MM-DD"
 *
 * Usage:
 *   npx tsx scripts/docs-lifecycle-auto-apply.ts \
 *     --packet docs/internal/docs-owner-review-packet-2026-04.json [--apply]
 *
 *   npx tsx scripts/docs-lifecycle-auto-apply.ts \
 *     --packet <path> --grace-days 30 --max-promotions 50 --apply
 *
 * Recommended cron: monthly, day-31 / packet+31days, manual review of
 * dry-run output before --apply.
 *
 * Reference: HELM_DOC_LIFECYCLE_POLICY_V1.md §1.4
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "..");

const DEFAULT_GRACE_DAYS = 30;
const DEFAULT_MAX_PROMOTIONS = 50;

type DocSummary = {
  path: string;
  status: string | null;
  owner: string | null;
  createdAt: string | null;
  reviewAfter: string | null;
  ageDays: number | null;
  daysPastReview: number | null;
  inboundRefs: number;
};

type Packet = {
  generatedAt: string;
  monthKey: string;
  retentionDays: number;
  counts: Record<string, number>;
  buckets: {
    dormantCandidates: DocSummary[];
    archiveReady: DocSummary[];
    pendingPhysicalMove: DocSummary[];
    staleFrontmatter: DocSummary[];
    suspiciousPatternActive: DocSummary[];
  };
};

type ActionDecision =
  | { rel: string; action: "promote-dormant" | "promote-archived"; reason: string }
  | { rel: string; action: "skip"; reason: string };

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function getLastCommitISO(rel: string): string | null {
  try {
    const out = execSync(`git log -1 --format=%cI -- "${rel}"`, {
      cwd: REPO_ROOT,
      encoding: "utf8",
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

function getCurrentStatus(rel: string): string | null {
  const abs = path.join(REPO_ROOT, rel);
  if (!existsSync(abs)) return null;
  const content = readFileSync(abs, "utf8");
  if (!content.startsWith("---")) return null;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return null;
  const frontmatter = content.substring(3, end);
  const m = frontmatter.match(/^status:\s*(.+)$/m);
  return m ? m[1].trim() : null;
}

function ownerTouchedSincePacket(rel: string, packetGeneratedAtISO: string, packetRecordedStatus: string | null): {
  touched: boolean;
  reason: string;
} {
  // SAFETY: missing/unreadable git history → treat as touched (skip auto-apply).
  // We never want to silently archive a file we can't ground in git.
  const lastCommitISO = getLastCommitISO(rel);
  if (!lastCommitISO) {
    return {
      touched: true,
      reason: "no git history found (file untracked, deleted, or moved) — skipping out of caution",
    };
  }
  if (new Date(lastCommitISO).getTime() > new Date(packetGeneratedAtISO).getTime()) {
    return {
      touched: true,
      reason: `committed at ${lastCommitISO} after packet ${packetGeneratedAtISO}`,
    };
  }
  // Status drift check: if current status no longer matches what the packet
  // recorded, owner already changed it via some other path.
  const currentStatus = getCurrentStatus(rel);
  if (packetRecordedStatus !== null && currentStatus !== null && currentStatus.trim() !== packetRecordedStatus.trim()) {
    return {
      touched: true,
      reason: `status drift: packet recorded "${packetRecordedStatus}", current "${currentStatus}"`,
    };
  }
  return { touched: false, reason: "no commit since packet + status unchanged" };
}

function applyStatusPromotion(rel: string, newStatus: "dormant" | "archived", packetMonthKey: string): boolean {
  const abs = path.join(REPO_ROOT, rel);
  if (!existsSync(abs)) return false;
  const content = readFileSync(abs, "utf8");
  if (!content.startsWith("---")) return false;
  const end = content.indexOf("\n---", 3);
  if (end === -1) return false;

  const frontmatter = content.substring(4, end);
  const body = content.substring(end + 4);

  const lines = frontmatter.split("\n");
  const out: string[] = [];
  let foundStatus = false;
  let oldStatus: string | null = null;
  for (const line of lines) {
    const m = line.match(/^status:\s*(.+)$/);
    if (m && !foundStatus) {
      oldStatus = m[1].trim();
      out.push(`status: ${newStatus}`);
      foundStatus = true;
      continue;
    }
    // Strip any previous auto-apply audit comment to keep frontmatter clean.
    if (line.match(/^# auto-applied per HELM_DOC_LIFECYCLE_POLICY_V1 §1\.4/)) continue;
    out.push(line);
  }
  if (!foundStatus) {
    out.push(`status: ${newStatus}`);
  }
  out.push(`# auto-applied per HELM_DOC_LIFECYCLE_POLICY_V1 §1.4 on ${todayUTC()} (packet ${packetMonthKey}; from ${oldStatus ?? "_unset_"})`);

  const next = `---\n${out.join("\n")}\n---${body}`;
  writeFileSync(abs, next, "utf8");
  return true;
}

function main(): void {
  const argv = process.argv.slice(2);
  const packetIdx = argv.indexOf("--packet");
  if (packetIdx === -1 || !argv[packetIdx + 1]) {
    console.error("Missing --packet <path-to-packet.json>");
    process.exit(64);
  }
  const packetPath = argv[packetIdx + 1];
  const apply = argv.includes("--apply");
  const graceIdx = argv.indexOf("--grace-days");
  const graceDays = graceIdx !== -1 ? Number(argv[graceIdx + 1]) : DEFAULT_GRACE_DAYS;
  const maxIdx = argv.indexOf("--max-promotions");
  const maxPromotions = maxIdx !== -1 ? Number(argv[maxIdx + 1]) : DEFAULT_MAX_PROMOTIONS;

  const packetAbs = path.isAbsolute(packetPath) ? packetPath : path.join(REPO_ROOT, packetPath);
  if (!existsSync(packetAbs)) {
    console.error(`Packet not found: ${packetAbs}`);
    process.exit(66);
  }
  const packet = JSON.parse(readFileSync(packetAbs, "utf8")) as Packet;

  const nowISO = new Date().toISOString();
  const ageDays = (new Date(nowISO).getTime() - new Date(packet.generatedAt).getTime()) / 86_400_000;

  console.log(`Auto-apply for packet ${packet.monthKey} (generated ${packet.generatedAt}, age ${ageDays.toFixed(1)}d)`);
  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`Grace window: ${graceDays} days; max promotions: ${maxPromotions}`);
  console.log("");

  if (ageDays < graceDays) {
    console.log(`Packet is only ${ageDays.toFixed(1)} days old; grace window is ${graceDays}. Nothing to apply.`);
    console.log(`Re-run after ${(graceDays - ageDays).toFixed(1)} more days.`);
    return;
  }

  const decisions: ActionDecision[] = [];

  for (const candidate of packet.buckets.dormantCandidates) {
    const touched = ownerTouchedSincePacket(candidate.path, packet.generatedAt, candidate.status);
    if (touched.touched) {
      decisions.push({ rel: candidate.path, action: "skip", reason: `owner touched: ${touched.reason}` });
      continue;
    }
    decisions.push({
      rel: candidate.path,
      action: "promote-dormant",
      reason: `untouched ${graceDays}d since packet; ${candidate.inboundRefs} inbound refs; age ${candidate.ageDays}d`,
    });
  }

  for (const candidate of packet.buckets.archiveReady) {
    const touched = ownerTouchedSincePacket(candidate.path, packet.generatedAt, candidate.status);
    if (touched.touched) {
      decisions.push({ rel: candidate.path, action: "skip", reason: `owner touched: ${touched.reason}` });
      continue;
    }
    decisions.push({
      rel: candidate.path,
      action: "promote-archived",
      reason: `dormant + review_after passed + untouched ${graceDays}d`,
    });
  }

  const promotions = decisions.filter((d) => d.action !== "skip");
  const skips = decisions.filter((d) => d.action === "skip");

  console.log(`Found ${promotions.length} candidate promotions (${skips.length} skips).`);
  console.log("");

  const willApply = promotions.slice(0, maxPromotions);
  const willDefer = promotions.slice(maxPromotions);

  if (promotions.length === 0 && skips.length > 0) {
    console.log(`All ${skips.length} packet candidates were skipped (owner touched them since packet).`);
    console.log("Skip reasons:");
    for (const s of skips.slice(0, 10)) {
      if (s.action !== "skip") continue;
      console.log(`  ${s.rel}: ${s.reason}`);
    }
    if (skips.length > 10) console.log(`  ... and ${skips.length - 10} more (see audit log)`);
    console.log("");
  }

  console.log(`Will ${apply ? "APPLY" : "REPORT"} ${willApply.length} promotions:`);
  for (const d of willApply) {
    console.log(`  ${d.action.toUpperCase()} ${d.rel}`);
    console.log(`    reason: ${d.reason}`);
  }
  if (willDefer.length > 0) {
    console.log("");
    console.log(`Deferred ${willDefer.length} additional candidates (over max-promotions cap of ${maxPromotions}):`);
    for (const d of willDefer.slice(0, 10)) {
      console.log(`  ${d.action.toUpperCase()} ${d.rel}`);
    }
    if (willDefer.length > 10) console.log(`  ... and ${willDefer.length - 10} more`);
  }
  console.log("");

  let actuallyApplied = 0;
  let applyFailed = 0;
  if (apply) {
    for (const d of willApply) {
      const newStatus = d.action === "promote-dormant" ? "dormant" : "archived";
      const ok = applyStatusPromotion(d.rel, newStatus, packet.monthKey);
      if (ok) actuallyApplied += 1;
      else applyFailed += 1;
    }
  }

  const auditLog = {
    invokedAt: nowISO,
    packetPath: path.relative(REPO_ROOT, packetAbs),
    packetMonthKey: packet.monthKey,
    packetGeneratedAt: packet.generatedAt,
    packetAgeDays: ageDays,
    graceDays,
    maxPromotions,
    applyMode: apply,
    counts: {
      dormantCandidatesInPacket: packet.buckets.dormantCandidates.length,
      archiveReadyInPacket: packet.buckets.archiveReady.length,
      skipped: skips.length,
      promotionsConsidered: promotions.length,
      promotionsAppliedThisRun: actuallyApplied,
      promotionsDeferred: willDefer.length,
      applyFailed,
    },
    decisions,
  };

  const outDir = path.join(REPO_ROOT, "docs", "internal");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `docs-lifecycle-auto-apply-${todayUTC()}.json`);
  writeFileSync(outPath, JSON.stringify(auditLog, null, 2), "utf8");

  console.log(`Audit log: ${path.relative(REPO_ROOT, outPath)}`);
  if (apply) {
    console.log(`Applied: ${actuallyApplied}, failed: ${applyFailed}, deferred: ${willDefer.length}`);
    if (willDefer.length > 0) {
      console.log(`Re-run with --apply to process deferred candidates (or raise --max-promotions).`);
    }
  } else {
    console.log(`DRY-RUN. Re-run with --apply to write changes.`);
  }
}

main();

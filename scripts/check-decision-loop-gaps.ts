#!/usr/bin/env tsx
/**
 * Decision loop gap register guard.
 *
 * docs/product/HELM_DECISION_LOOP_GAP_REGISTER.md records what is and is not
 * reachable in the decision/supervision loop. This checks every claim it makes,
 * so it cannot become a second docs/STATUS.md — which currently understates one
 * thing and overstates another in the same row, because nothing checks it.
 *
 * The register is written to be INVALIDATED. Closing a gap turns this red and
 * forces the register to be updated in the same change; that is the point, not
 * a nuisance. A gap list nobody re-derives is worth less than no list, because
 * it is read as current.
 *
 * WHAT "NO PRODUCTION CALLER" MEANS HERE. A symbol is unreachable when the only
 * files mentioning it are its own definition and test files. Tests exercising a
 * function prove it works; they do not put it on a path anything runs. That
 * distinction is the whole subject of this register: the supervision panel is
 * mounted, queried, rendered and green, and nothing produces what it displays.
 *
 * FAIL-CLOSED. Every claim is asserted in BOTH directions. The closed-loop
 * facts in §1 of the register are checked too, so a scanner that has stopped
 * finding anything fails here rather than reporting an empty gap list — "no
 * gaps" and "found nothing" are otherwise the same output.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export const REGISTER_PATH = "docs/product/HELM_DECISION_LOOP_GAP_REGISTER.md";
export const SCAN_ROOTS = ["lib", "app", "features", "tools"] as const;

export type Finding = Readonly<{ gap: string; detail: string }>;

const isTestFile = (file: string) => /\.(test|spec)\.[cm]?tsx?$/u.test(file);

/**
 * Match `needle` only when it is not a prefix of a longer identifier.
 *
 * A plain substring test is satisfied by a renamed symbol, so a fact asserted
 * that way survives the very edit that falsifies it.
 */
export function wordBoundaryRegExp(needle: string): RegExp {
  return new RegExp(`${needle.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\b`, "u");
}

export function listSourceFiles(repoRoot: string, root: string): string[] {
  const absolute = path.join(repoRoot, root);
  if (!existsSync(absolute)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(absolute)) {
    const relative = path.posix.join(root, entry);
    const full = path.join(repoRoot, relative);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      files.push(...listSourceFiles(repoRoot, relative));
    } else if (/\.[cm]?tsx?$/u.test(entry)) {
      files.push(relative);
    }
  }
  return files;
}

/**
 * Files that mention `symbol`, excluding its own definition file and any test.
 * An empty result means nothing on a runnable path reaches it.
 */
export function productionReferences(
  repoRoot: string,
  symbol: string,
  definedIn: string,
): string[] {
  const hits: string[] = [];
  for (const root of SCAN_ROOTS) {
    for (const file of listSourceFiles(repoRoot, root)) {
      if (file === definedIn || isTestFile(file)) continue;
      if (readFileSync(path.join(repoRoot, file), "utf8").includes(symbol)) {
        hits.push(file);
      }
    }
  }
  return hits.sort();
}

/** Symbols the register says have no production caller. */
export const RECORDED_UNREACHABLE = Object.freeze([
  Object.freeze({
    gap: "GAP-2",
    symbol: "evaluateStage1DecisionRecord",
    definedIn: "lib/stage1-owner-loop/decision-evaluation.service.ts",
  }),
]);

/**
 * Tables the register claims are, or are no longer, written only by seed.
 *
 * This asks the question GAP-1 was actually about. The first version asked
 * whether one exported symbol had a caller, and closing GAP-1 through a
 * different in-transaction path left that proxy true while the gap itself was
 * shut — the check was right about its proxy and the proxy was not the
 * property. Producers are counted by writes to the table, whoever performs
 * them.
 */
export const RECORDED_PRODUCERS = Object.freeze([
  Object.freeze({
    gap: "GAP-1",
    write: "supervisionSignalRecord.create",
    // Seed is not a producer: it populates a demo workspace, and a panel that
    // can only ever show seed rows is the defect, not the fix.
    excluding: ["prisma/seed.ts"],
    expected: "present" as const,
  }),
]);

/** Facts the register records as ALREADY CLOSED, checked so they stay closed. */
export const RECORDED_REACHABLE = Object.freeze([
  Object.freeze({
    claim: "the decision queue is mounted on a route",
    file: "app/(workspace)/approvals/page.tsx",
    needle: "Stage1DecisionQueue",
  }),
  Object.freeze({
    claim: "decision review posts to an implemented route",
    file: "app/api/stage1/decisions/[decisionId]/review/route.ts",
    needle: "export async function POST",
  }),
  Object.freeze({
    claim: "DecisionRecord has a production writer",
    file: "lib/stage1-owner-loop/decision-follow-through.service.ts",
    needle: "decisionRecord.create",
  }),
  Object.freeze({
    claim: "supervision signals have a mounted reader",
    file: "features/dashboard/stage1-owner-loop-query.ts",
    needle: "supervisionSignalRecord.findMany",
  }),
]);

/** Prisma models the register says do not exist. */
export const RECORDED_ABSENT_MODELS = Object.freeze([
  "KnowledgeCard",
  "KnowledgeSource",
]);

export function checkDecisionLoopGaps(repoRoot: string = process.cwd()): Finding[] {
  const findings: Finding[] = [];

  if (!existsSync(path.join(repoRoot, REGISTER_PATH))) {
    return [{ gap: "register", detail: `${REGISTER_PATH} is missing` }];
  }

  // GAP-1 / GAP-2: still unreachable?
  for (const entry of RECORDED_UNREACHABLE) {
    if (!existsSync(path.join(repoRoot, entry.definedIn))) {
      findings.push({
        gap: entry.gap,
        detail: `${entry.definedIn} no longer exists; the register describes code that has moved`,
      });
      continue;
    }
    const callers = productionReferences(repoRoot, entry.symbol, entry.definedIn);
    if (callers.length > 0) {
      findings.push({
        gap: entry.gap,
        detail: `${entry.symbol} now has production caller(s) — ${callers.join(", ")}; this gap is CLOSED, update ${REGISTER_PATH} in this change`,
      });
    }
  }

  // GAP-1: does anything still produce the row the panel displays?
  for (const entry of RECORDED_PRODUCERS) {
    const producers = productionReferences(repoRoot, entry.write, "").filter(
      (file) => !entry.excluding.includes(file),
    );
    if (entry.expected === "present" && producers.length === 0) {
      findings.push({
        gap: entry.gap,
        detail: `nothing outside ${entry.excluding.join(", ")} writes ${entry.write}; the register records this producer as present, so either it was removed or ${REGISTER_PATH} is wrong`,
      });
    }
  }

  // GAP-3: still no persistence?
  const schemaPath = path.join(repoRoot, "prisma/schema.prisma");
  if (!existsSync(schemaPath)) {
    findings.push({ gap: "GAP-3", detail: "prisma/schema.prisma is missing" });
  } else {
    const schema = readFileSync(schemaPath, "utf8");
    for (const model of RECORDED_ABSENT_MODELS) {
      if (new RegExp(`^model\\s+${model}\\b`, "mu").test(schema)) {
        findings.push({
          gap: "GAP-3",
          detail: `prisma model ${model} now exists; Company Memory has persistence, update ${REGISTER_PATH} in this change`,
        });
      }
    }
  }

  // CONTROL. The closed-loop facts must still hold. Without this, a scanner
  // that silently stopped matching would report an empty finding list, and an
  // empty list is exactly what "no gaps" looks like.
  for (const fact of RECORDED_REACHABLE) {
    const full = path.join(repoRoot, fact.file);
    if (!existsSync(full)) {
      findings.push({
        gap: "control",
        detail: `${fact.file} is missing, so "${fact.claim}" can no longer be checked`,
      });
      continue;
    }
    // Word-boundary, not substring. `includes("Stage1DecisionQueue")` still
    // matches `Stage1DecisionQueueX`, which made this control nearly
    // unbreakable — and a control that cannot fail is not a control. Found by
    // mutating the mount away and watching this stay green.
    if (!wordBoundaryRegExp(fact.needle).test(readFileSync(full, "utf8"))) {
      findings.push({
        gap: "control",
        detail: `${fact.file} no longer contains ${JSON.stringify(fact.needle)}, so "${fact.claim}" is no longer true`,
      });
    }
  }

  return findings;
}

export function main(repoRoot: string = process.cwd()): number {
  const findings = checkDecisionLoopGaps(repoRoot);
  if (findings.length === 0) {
    console.log(
      `decision-loop-gaps: OK — ${RECORDED_UNREACHABLE.length} recorded gap(s) still open, ${RECORDED_REACHABLE.length} closed-loop fact(s) still true; ${REGISTER_PATH} matches the code`,
    );
    return 0;
  }
  console.error(`decision-loop-gaps: FAIL — ${REGISTER_PATH} no longer matches the code:`);
  for (const finding of findings) {
    console.error(`  - [${finding.gap}] ${finding.detail}`);
  }
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main();
}

#!/usr/bin/env tsx
/**
 * external-resource-kit dry-run evaluator (Phase 2 scaffold).
 *
 * Loads `signal-rules.json` + `sample-payload.json` from a kit example
 * dir, applies deterministic rules, and emits `dry-run-result.json`
 * plus `review-packets.json`.
 *
 * Hard boundaries (public Core kit contract):
 *   - No DB write, no provider call, no schema migration.
 *   - LLM is not invoked; severity is deterministic.
 *   - Refuses to run inside `extensions/<tenant>/` paths — tenant-
 *     specific examples land outside the generic kit.
 *   - Phase-3-gated Must Push eligibility is always emitted as
 *     `eligible: false` regardless of signalType, since the gate
 *     prerequisites are not checked here.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type Disposition = "candidate" | "rejected" | "watch_only" | "skip";

type Verdict =
  | { disposition: "candidate"; severity: number }
  | { disposition: "rejected"; rejectionCategory: string; reviewNote: string | null }
  | { disposition: "watch_only"; reason: string | null }
  | { disposition: "skip"; reason: string };

type SampleRow = Record<string, unknown> & {
  _id?: string;
  _source?: Record<string, unknown>;
  _capturedAt?: string;
  _objectRefs?: unknown[];
  _evidenceRefs?: unknown[];
};

type RejectionRule = {
  rejectionCategory: string;
  condition: string | null;
  expectedDisposition?: string | null;
  reviewNote?: string | null;
  categoryRationale?: string | null;
};

type WatchOnlyRule = { rule: string | null; reason?: string | null };
type EligibilityRule = { rule: string | null; appliesTo?: string | null };
type ThresholdRule = {
  metric: string;
  operator: "gt" | "gte" | "lt" | "lte" | "eq" | "neq";
  value: number;
  windowDays?: number | null;
  severityWeight?: number;
};

type SignalRules = {
  signalType?: string | null;
  sourceTypes?: string[];
  rulePackVersion?: string;
  eligibilityRules?: EligibilityRule[];
  thresholdRules?: ThresholdRule[];
  watchOnlyRules?: WatchOnlyRule[];
  rejectionRules?: RejectionRule[];
};

function parseArgs(argv: string[]): { exampleDir: string } {
  const idx = argv.findIndex((a) => a === "--example");
  if (idx < 0 || idx === argv.length - 1) {
    throw new Error(
      "usage: tsx external-resource-kit/dry-run.ts --example <example-dir>",
    );
  }
  return { exampleDir: argv[idx + 1] };
}

function loadJson<T>(p: string): T {
  return JSON.parse(readFileSync(p, "utf-8")) as T;
}

function evaluatePredicate(row: SampleRow, predicate: string | null): boolean {
  if (!predicate) return false;
  const m = predicate.match(/^\s*(\w+)\s*(==|!=|>=|<=|>|<)\s*(.+?)\s*$/);
  if (!m) return false;
  const [, field, op, rawRhs] = m;
  const lhs = (row as Record<string, unknown>)[field];
  let rhs: unknown;
  const trimmed = rawRhs.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    rhs = trimmed.slice(1, -1);
  } else if (trimmed === "true" || trimmed === "false") {
    rhs = trimmed === "true";
  } else if (trimmed === "null") {
    rhs = null;
  } else {
    const n = Number(trimmed);
    rhs = Number.isNaN(n) ? trimmed : n;
  }
  switch (op) {
    case "==":
      return lhs === rhs;
    case "!=":
      return lhs !== rhs;
    case ">":
      return Number(lhs) > Number(rhs);
    case "<":
      return Number(lhs) < Number(rhs);
    case ">=":
      return Number(lhs) >= Number(rhs);
    case "<=":
      return Number(lhs) <= Number(rhs);
  }
  return false;
}

function evaluateThreshold(row: SampleRow, t: ThresholdRule): boolean {
  const value = Number((row as Record<string, unknown>)[t.metric]);
  if (Number.isNaN(value)) return false;
  const target = Number(t.value);
  switch (t.operator) {
    case "gt":
      return value > target;
    case "gte":
      return value >= target;
    case "lt":
      return value < target;
    case "lte":
      return value <= target;
    case "eq":
      return value === target;
    case "neq":
      return value !== target;
  }
  return false;
}

function evaluateRow(row: SampleRow, rules: SignalRules): Verdict {
  for (const r of rules.rejectionRules ?? []) {
    if (r.condition && evaluatePredicate(row, r.condition)) {
      return {
        disposition: "rejected",
        rejectionCategory: r.rejectionCategory,
        reviewNote: r.reviewNote ?? null,
      };
    }
  }
  for (const e of rules.eligibilityRules ?? []) {
    if (e.rule && !evaluatePredicate(row, e.rule)) {
      return {
        disposition: "skip",
        reason: `eligibility miss: ${e.appliesTo ?? e.rule}`,
      };
    }
  }
  let severity = 0;
  for (const t of rules.thresholdRules ?? []) {
    if (evaluateThreshold(row, t)) {
      severity = Math.max(severity, t.severityWeight ?? 1);
    }
  }
  if (severity > 0) {
    return { disposition: "candidate", severity };
  }
  for (const w of rules.watchOnlyRules ?? []) {
    if (w.rule && evaluatePredicate(row, w.rule)) {
      return { disposition: "watch_only", reason: w.reason ?? null };
    }
  }
  return { disposition: "skip", reason: "no threshold matched" };
}

function buildPacket(row: SampleRow, rules: SignalRules, severity: number) {
  const id = row._id ?? "row-unknown";
  const confidence = severity >= 3 ? "high" : severity === 2 ? "medium" : "low";
  return {
    packetId: `${rules.signalType ?? "unknown"}-${id}`,
    signalType: rules.signalType ?? null,
    sourceSummary: {
      ...(row._source ?? {}),
      freshnessAtCapture: row._capturedAt ?? null,
    },
    objectRefs: row._objectRefs ?? [],
    evidenceRefs: row._evidenceRefs ?? [],
    ruleResult: {
      rulePackVersion: rules.rulePackVersion ?? "v0",
      thresholdEvaluations: (rules.thresholdRules ?? [])
        .filter((t) => evaluateThreshold(row, t))
        .map((t) => `${t.metric} ${t.operator} ${t.value}`),
      matchedRules: [],
    },
    confidence,
    llmExplanation: null,
    boundaryNote: "review-first; no auto-action; LLM not consulted",
    recommendedNextMove: null,
    suggestedDri: null,
    suggestedDue: null,
    allowedActions: [
      {
        action: "review",
        surface: "approvals",
        capabilityRequired: "workspace_owner",
      },
    ],
    forbiddenActions: [
      "official_write_to_external_system",
      "auto_send",
      "auto_approval",
      "cross_workspace_aggregation",
    ],
    rollbackPath:
      "drop candidate from dry-run output; do not propagate to runtime; review-first",
    mustPushEligibility: {
      eligible: false,
      gateReason:
        "Phase 3 runtime enablement gate not satisfied; only TPQR-001/003/004 may surface to /mobile Must Push after 6 hard prerequisites + 5-role approval",
      phase3Prerequisites: {
        redactedCalibrationEvidence: false,
        fiveRoleApproval: false,
        disabledByDefaultRollout: false,
        rollbackProof: false,
        auditCompleteness: false,
        boundaryRegressionTest: false,
      },
    },
  };
}

function main(): number {
  const { exampleDir } = parseArgs(process.argv);
  const dir = path.resolve(exampleDir);

  if (/\/extensions\/[^/]+\//.test(dir + "/")) {
    throw new Error(
      "dry-run.ts must not be run on tenant-specific extensions/<tenant>/ paths. Use tenant-specific tooling.",
    );
  }
  if (!existsSync(dir)) {
    throw new Error(`example dir not found: ${dir}`);
  }

  const rulesPath = path.join(dir, "signal-rules.json");
  const samplePath = path.join(dir, "sample-payload.json");
  if (!existsSync(rulesPath)) {
    throw new Error(`missing signal-rules.json in ${dir}`);
  }
  if (!existsSync(samplePath)) {
    throw new Error(`missing sample-payload.json in ${dir}`);
  }

  const rules = loadJson<SignalRules>(rulesPath);
  const samples = loadJson<SampleRow[]>(samplePath);
  if (!Array.isArray(samples)) {
    throw new Error("sample-payload.json must be a JSON array of rows");
  }

  const verdicts: Array<{ rowId: string | null; verdict: Verdict }> = [];
  const packets: ReturnType<typeof buildPacket>[] = [];

  for (const row of samples) {
    const verdict = evaluateRow(row, rules);
    verdicts.push({ rowId: row._id ?? null, verdict });
    if (verdict.disposition === "candidate") {
      packets.push(buildPacket(row, rules, verdict.severity));
    }
  }

  const counts: Record<Disposition, number> = {
    candidate: 0,
    rejected: 0,
    watch_only: 0,
    skip: 0,
  };
  for (const v of verdicts) counts[v.verdict.disposition]++;

  const resultPath = path.join(dir, "dry-run-result.json");
  const packetsPath = path.join(dir, "review-packets.json");

  writeFileSync(
    resultPath,
    JSON.stringify(
      {
        rulePack: {
          signalType: rules.signalType ?? null,
          sourceTypes: rules.sourceTypes ?? [],
          rulePackVersion: rules.rulePackVersion ?? "v0",
        },
        rowCount: samples.length,
        counts,
        verdicts,
        boundaries: {
          llmConsulted: false,
          dbWritten: false,
          providerCalled: false,
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(packetsPath, JSON.stringify(packets, null, 2));

  console.log(
    `dry-run: ${samples.length} rows → ${counts.candidate} candidate, ${counts.rejected} rejected, ${counts.watch_only} watch-only, ${counts.skip} skip`,
  );
  console.log(`Result : ${path.relative(process.cwd(), resultPath)}`);
  console.log(`Packets: ${path.relative(process.cwd(), packetsPath)}`);
  return 0;
}

process.exit(main());

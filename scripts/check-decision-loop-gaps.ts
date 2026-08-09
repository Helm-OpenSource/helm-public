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
 * GAP-1 and GAP-2 are now closed by one canonical terminal-result path. This
 * guard pins the SERIALIZABLE transaction, receipt/evaluation/supervision
 * order, private result ingress, Pack consumer, and existing approvals entry.
 * Moving or deleting any part fails here instead of silently turning a closed
 * gap back into a documentation claim.
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

/** Locate a function invocation without depending on whether it is directly awaited. */
export function functionCallIndex(source: string, symbol: string): number {
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return source.search(new RegExp(`\\b${escaped}\\s*\\(`, "u"));
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

const TERMINAL_RECONCILER_FILE =
  "lib/stage1-owner-loop/terminal-result-reconciliation.service.ts";
const TERMINAL_TRIGGER_FILE = "features/approvals/actions.ts";
const PRIVATE_INGRESS_FILE =
  "lib/stage1-owner-loop/private-execution-result-ingress.service.ts";
const PRIVATE_INGRESS_COMPOSITION_FILE = "tools/caio-access-gateway/server.ts";
const PRIVATE_INGRESS_ROUTE_FILE =
  "lib/caio-access-gateway/gateway-http-core.ts";
const PACK_CONSUMER_FILE =
  "lib/stage1-owner-loop/caio-operating-question-store.service.ts";
const CROSS_REPO_SCHEMA_FILE =
  "docs/contracts/caio-pro-fde-cross-repo-interface.v1.schema.json";

/** Production producer paths the register records as CLOSED. */
export const RECORDED_CLOSED_GAPS = Object.freeze([
  Object.freeze({
    gap: "GAP-1",
    producerNeedle: "recordStage1SupervisionSignal",
    producerFile: TERMINAL_RECONCILER_FILE,
    definedIn: "lib/stage1-owner-loop/decision-follow-through.service.ts",
    triggerFile: TERMINAL_TRIGGER_FILE,
    triggerNeedle: "reconcileStage1TerminalResult",
  }),
  Object.freeze({
    gap: "GAP-2",
    producerNeedle: "evaluateStage1DecisionRecord",
    producerFile: TERMINAL_RECONCILER_FILE,
    definedIn: "lib/stage1-owner-loop/decision-evaluation.service.ts",
    triggerFile: TERMINAL_TRIGGER_FILE,
    triggerNeedle: "reconcileStage1TerminalResult",
  }),
]);

/** Gaps the register still records as OPEN. */
export const RECORDED_OPEN_GAPS = Object.freeze([
  Object.freeze({
    gap: "GAP-3",
    absentModels: Object.freeze(["KnowledgeCard", "KnowledgeSource"]),
  }),
]);

export const REQUIRED_REGISTER_MARKERS = Object.freeze([
  "<!-- decision-loop-gap:GAP-1=closed -->",
  "<!-- decision-loop-gap:GAP-2=closed -->",
  "<!-- decision-loop-gap:GAP-3=open -->",
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

export function checkDecisionLoopGaps(repoRoot: string = process.cwd()): Finding[] {
  const findings: Finding[] = [];

  const registerFullPath = path.join(repoRoot, REGISTER_PATH);
  if (!existsSync(registerFullPath)) {
    return [{ gap: "register", detail: `${REGISTER_PATH} is missing` }];
  }
  const register = readFileSync(registerFullPath, "utf8");
  for (const marker of REQUIRED_REGISTER_MARKERS) {
    if (!register.includes(marker)) {
      findings.push({
        gap: "register",
        detail: `${REGISTER_PATH} is missing checked status marker ${marker}`,
      });
    }
  }

  // GAP-1 / GAP-2: the same governed terminal path must still close both.
  for (const entry of RECORDED_CLOSED_GAPS) {
    const definitionFullPath = path.join(repoRoot, entry.definedIn);
    const producerFullPath = path.join(repoRoot, entry.producerFile);
    const triggerFullPath = path.join(repoRoot, entry.triggerFile);
    if (!existsSync(definitionFullPath)) {
      findings.push({
        gap: entry.gap,
        detail: `${entry.definedIn} no longer exists; the register describes code that has moved`,
      });
      continue;
    }
    if (!existsSync(producerFullPath)) {
      findings.push({
        gap: entry.gap,
        detail: `${entry.producerFile} is missing; the recorded terminal producer path is open again`,
      });
      continue;
    }
    const producerSource = readFileSync(producerFullPath, "utf8");
    if (functionCallIndex(producerSource, entry.producerNeedle) < 0) {
      findings.push({
        gap: entry.gap,
        detail: `${entry.producerFile} no longer calls ${entry.producerNeedle}; the recorded producer path is open again`,
      });
    }
    const callers = productionReferences(
      repoRoot,
      entry.producerNeedle,
      entry.definedIn,
    );
    if (!callers.includes(entry.producerFile)) {
      findings.push({
        gap: entry.gap,
        detail: `${entry.producerNeedle} has no checked production reference in ${entry.producerFile}`,
      });
    }
    const alternateProducerCallers = callers.filter(
      (caller) => caller !== entry.producerFile,
    );
    if (alternateProducerCallers.length > 0) {
      findings.push({
        gap: entry.gap,
        detail: `${entry.producerNeedle} must use only the canonical terminal producer; unexpected production caller(s): ${alternateProducerCallers.join(", ")}`,
      });
    }
    if (!existsSync(triggerFullPath)) {
      findings.push({
        gap: entry.gap,
        detail: `${entry.triggerFile} is missing; the recorded terminal trigger is not production-reachable`,
      });
      continue;
    }
    const triggerSource = readFileSync(triggerFullPath, "utf8");
    const receiptVerification = functionCallIndex(
      triggerSource,
      "verifyExecutionReceipt",
    );
    const reconciliation = functionCallIndex(
      triggerSource,
      entry.triggerNeedle,
    );
    if (receiptVerification < 0 || reconciliation < 0) {
      findings.push({
        gap: entry.gap,
        detail: `${entry.triggerFile} must route Stage 1 to ${entry.triggerNeedle} and retain standalone receipt verification for non-Stage1 actions`,
      });
    } else if (receiptVerification < reconciliation) {
      findings.push({
        gap: entry.gap,
        detail: `${entry.triggerFile} appears to pre-verify a Stage 1 receipt; Stage 1 must enter the atomic reconciler before the non-Stage1 standalone verification branch`,
      });
    }
    const triggerCallers = productionReferences(
      repoRoot,
      entry.triggerNeedle,
      TERMINAL_RECONCILER_FILE,
    );
    const alternateTriggerCallers = triggerCallers.filter(
      (caller) => caller !== entry.triggerFile,
    );
    if (alternateTriggerCallers.length > 0) {
      findings.push({
        gap: entry.gap,
        detail: `${entry.triggerNeedle} must use only the canonical approvals trigger; unexpected production caller(s): ${alternateTriggerCallers.join(", ")}`,
      });
    }
  }

  const terminalProducerPath = path.join(repoRoot, TERMINAL_RECONCILER_FILE);
  if (existsSync(terminalProducerPath)) {
    const source = readFileSync(terminalProducerPath, "utf8");
    const verification = functionCallIndex(source, "verifyExecutionReceipt");
    const evaluation = functionCallIndex(source, "evaluateStage1DecisionRecord");
    const supervision = functionCallIndex(source, "recordStage1SupervisionSignal");
    const serializable = source.indexOf(
      "Prisma.TransactionIsolationLevel.Serializable",
    );
    const transaction = source.indexOf("db.$transaction");
    const txClientBindings = source.match(/client:\s*tx/gu)?.length ?? 0;
    if (
      serializable < 0 ||
      transaction < 0 ||
      verification < transaction ||
      txClientBindings < 3
    ) {
      findings.push({
        gap: "terminal-atomicity",
        detail:
          "terminal reconciliation must keep receipt verification, decision evaluation, and supervision in one SERIALIZABLE transaction using the same transaction client",
      });
    }
    if (
      verification >= 0 &&
      evaluation >= 0 &&
      supervision >= 0 &&
      !(verification < evaluation && evaluation < supervision)
    ) {
      findings.push({
        gap: "terminal-order",
        detail:
          "terminal result order changed; receipt verification must precede decision evaluation, which must precede supervision inside the atomic boundary",
      });
    }
  }

  const privateIngressPath = path.join(repoRoot, PRIVATE_INGRESS_FILE);
  const privateCompositionPath = path.join(
    repoRoot,
    PRIVATE_INGRESS_COMPOSITION_FILE,
  );
  const privateRoutePath = path.join(repoRoot, PRIVATE_INGRESS_ROUTE_FILE);
  const privateIngressMarkers = [
    "Prisma.TransactionIsolationLevel.Serializable",
    "resolveCaioFdePortfolioScope",
    "resolveCaioFdeObservationEvidence",
    "recordExecutionReceipt",
  ];
  if (
    !existsSync(privateIngressPath) ||
    privateIngressMarkers.some(
      (marker) =>
        !readFileSync(privateIngressPath, "utf8").includes(marker),
    ) ||
    !existsSync(privateCompositionPath) ||
    !readFileSync(privateCompositionPath, "utf8").includes(
      "ingestCaioPrivateExecutionResultProjection",
    ) ||
    !existsSync(privateRoutePath) ||
    !readFileSync(privateRoutePath, "utf8").includes(
      "/v1/execution-results",
    )
  ) {
    findings.push({
      gap: "private-ingress",
      detail:
        "the authenticated private execution projection must remain wired through the Gateway to the sole Core receipt writer with Portfolio and evidence resolution",
    });
  }

  const packConsumerPath = path.join(repoRoot, PACK_CONSUMER_FILE);
  const packConsumerMarkers = [
    "generateCaioOperatingQuestionPortfolioFromPackInput",
    "validateCaioProFdeInterfaceDescriptor",
    "caioProPackOperatingInputSchema.safeParse",
    "resolveCaioFdePortfolioScope",
    "resolveCaioFdeObservationEvidence",
    "generateCaioOperatingQuestionPortfolioInternal",
  ];
  if (
    !existsSync(packConsumerPath) ||
    packConsumerMarkers.some(
      (marker) => !readFileSync(packConsumerPath, "utf8").includes(marker),
    )
  ) {
    findings.push({
      gap: "pack-consumer",
      detail:
        "Pack operating input must remain a strict, workspace-scoped consumer of the existing Core Portfolio and evidence snapshot before Core question generation",
    });
  }

  const portableSchemaPath = path.join(repoRoot, CROSS_REPO_SCHEMA_FILE);
  try {
    const portableSchema = JSON.parse(
      readFileSync(portableSchemaPath, "utf8"),
    ) as Record<string, unknown>;
    const definitions = portableSchema.$defs as
      | Record<string, unknown>
      | undefined;
    const packDefinition = definitions?.packOperatingInput as
      | Record<string, unknown>
      | undefined;
    const projectionDefinition = definitions?.privateExecutionResultProjection as
      | Record<string, unknown>
      | undefined;
    if (
      !Array.isArray(portableSchema.oneOf) ||
      portableSchema.oneOf.length !== 2 ||
      packDefinition?.additionalProperties !== false ||
      projectionDefinition?.additionalProperties !== false
    ) {
      throw new Error("portable schema is incomplete");
    }
  } catch {
    findings.push({
      gap: "cross-repo-contract",
      detail: `${CROSS_REPO_SCHEMA_FILE} must remain valid, strict, and expose both Pack input and private execution projection definitions`,
    });
  }

  // GAP-3: still no persistence?
  const schemaPath = path.join(repoRoot, "prisma/schema.prisma");
  if (!existsSync(schemaPath)) {
    findings.push({ gap: "GAP-3", detail: "prisma/schema.prisma is missing" });
  } else {
    const schema = readFileSync(schemaPath, "utf8");
    for (const entry of RECORDED_OPEN_GAPS) {
      for (const model of entry.absentModels) {
        if (new RegExp(`^model\\s+${model}\\b`, "mu").test(schema)) {
          findings.push({
            gap: entry.gap,
            detail: `prisma model ${model} now exists; Company Memory has persistence, update ${REGISTER_PATH} in this change`,
          });
        }
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
      `decision-loop-gaps: OK — ${RECORDED_CLOSED_GAPS.length} producer gap(s) closed, ${RECORDED_OPEN_GAPS.length} persistence gap(s) still open, ${RECORDED_REACHABLE.length} closed-loop control fact(s) still true; ${REGISTER_PATH} matches the code`,
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

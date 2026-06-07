/**
 * Helm Agentic Implementation Engineering Layer — AgentRunCapsule (§7).
 *
 * A reviewable, candidate-only record of an agent/human implementation or
 * diagnostic run. Pure builder + zod `.strict`. It never grants authority:
 *  - free-text is redacted (reusing the merged diagnostics `redactText`);
 *  - if redaction is not proven (`raw_blocked` / `unknown_blocked`) the capsule
 *    is QUARANTINED and persists no content;
 *  - a command result that declares a forbidden risk (external_write /
 *    activation / commitment) is rejected — those fail closed in Public Core;
 *  - there is no accepted/approved field — only humans accept downstream.
 */

import { z } from "zod";
import { redactText } from "../diagnostics/doctor-packet";
import {
  agentImplementationModeSchema,
  agentImplementationRiskSchema,
  agentRedactionStatusSchema,
  agentBoundaryDecisionSchema,
  worktreeProfileSchema,
  AGENT_FORBIDDEN_RISKS,
  isRedactionSafe,
  type AgentRedactionStatus,
} from "./contracts";

export const capsuleRepoSchema = z
  .object({
    alias: z.string().min(1),
    branchRef: z.string().min(1),
    dirtyState: z.enum(["clean", "dirty", "unknown"]),
  })
  .strict();

export const capsuleCommandResultSchema = z
  .object({
    name: z.string().min(1),
    args: z.array(z.string()).default([]),
    cwd: z.string().default("<cwd>"),
    risk: agentImplementationRiskSchema,
    exitCode: z.number().int(),
    startedAt: z.string().min(1),
    endedAt: z.string().min(1),
    outputSummary: z.string(),
  })
  .strict();

export const capsuleFileChangeSchema = z
  .object({
    path: z.string().min(1),
    change: z.enum(["added", "modified", "deleted"]),
    rationale: z.string(),
  })
  .strict();

export const capsuleBoundaryDecisionSchema = z
  .object({
    subject: z.string().min(1),
    decision: agentBoundaryDecisionSchema,
    reason: z.string(),
  })
  .strict();

export const capsuleValidationReceiptSchema = z
  .object({
    name: z.string().min(1),
    ok: z.boolean(),
    summary: z.string(),
  })
  .strict();

export const agentRunCapsuleSchema = z
  .object({
    runId: z.string().min(1),
    createdAt: z.string().min(1),
    actor: z.string().min(1),
    mode: agentImplementationModeSchema,
    worktreeProfile: worktreeProfileSchema,
    repo: capsuleRepoSchema,
    intent: z.string(),
    scope: z.array(z.string()).default([]),
    inputRefs: z.array(z.string()).default([]),
    redactionStatus: agentRedactionStatusSchema,
    commandResults: z.array(capsuleCommandResultSchema).default([]),
    fileChangeSummary: z.array(capsuleFileChangeSchema).default([]),
    outputArtifacts: z.array(z.string()).default([]),
    boundaryDecisions: z.array(capsuleBoundaryDecisionSchema).default([]),
    blockedActions: z.array(z.string()).default([]),
    validationReceipts: z.array(capsuleValidationReceiptSchema).default([]),
    humanReceipts: z.array(z.string()).default([]),
    nextSafeActions: z.array(z.string()).default([]),
    quarantined: z.boolean().default(false),
  })
  .strict();
export type AgentRunCapsule = z.infer<typeof agentRunCapsuleSchema>;

export type BuildAgentRunCapsuleInput = {
  runId: string;
  actor: string;
  mode: z.infer<typeof agentImplementationModeSchema>;
  worktreeProfile: z.infer<typeof worktreeProfileSchema>;
  repo: z.infer<typeof capsuleRepoSchema>;
  intent: string;
  scope?: string[];
  inputRefs?: string[];
  redactionStatus: AgentRedactionStatus;
  commandResults?: Array<z.infer<typeof capsuleCommandResultSchema>>;
  fileChangeSummary?: Array<z.infer<typeof capsuleFileChangeSchema>>;
  outputArtifacts?: string[];
  blockedActions?: string[];
  validationReceipts?: Array<z.infer<typeof capsuleValidationReceiptSchema>>;
  humanReceipts?: string[];
  nextSafeActions?: string[];
  now?: () => Date;
};

const QUARANTINE_NEXT_ACTION =
  "Quarantined: redaction not proven; human review required before any use.";

/**
 * Build a capsule with fail-closed safety. Throws if a command result declares a
 * forbidden risk (those must be blocked, recorded as blockedActions, never run).
 */
export function buildAgentRunCapsule(input: BuildAgentRunCapsuleInput): AgentRunCapsule {
  for (const cmd of input.commandResults ?? []) {
    if (AGENT_FORBIDDEN_RISKS.has(cmd.risk)) {
      throw new Error(
        `forbidden risk "${cmd.risk}" cannot appear as a command result; record it as a blockedAction`,
      );
    }
  }

  const clock = input.now ?? (() => new Date());
  const createdAt = clock().toISOString();
  const safe = isRedactionSafe(input.redactionStatus);

  // Redact all free-text. When redaction is unproven, persist NO content.
  const redactFields = (s: string) => (safe ? redactText(s) : "<quarantined>");

  const commandResults = (input.commandResults ?? []).map((c) => ({
    ...c,
    outputSummary: redactFields(c.outputSummary),
  }));
  const fileChangeSummary = (input.fileChangeSummary ?? []).map((f) => ({
    ...f,
    rationale: redactFields(f.rationale),
  }));

  const boundaryDecisions = safe
    ? []
    : [
        {
          subject: "redaction",
          decision: "quarantine" as const,
          reason: `redactionStatus=${input.redactionStatus}; content withheld`,
        },
      ];

  const nextSafeActions = safe
    ? input.nextSafeActions ?? ["Human review required; no automated action was taken."]
    : [QUARANTINE_NEXT_ACTION];

  const capsule = {
    runId: input.runId,
    createdAt,
    actor: input.actor,
    mode: input.mode,
    worktreeProfile: input.worktreeProfile,
    repo: input.repo,
    intent: redactFields(input.intent),
    scope: input.scope ?? [],
    inputRefs: safe ? input.inputRefs ?? [] : [],
    redactionStatus: input.redactionStatus,
    commandResults,
    fileChangeSummary,
    outputArtifacts: safe ? input.outputArtifacts ?? [] : [],
    boundaryDecisions,
    blockedActions: input.blockedActions ?? [],
    validationReceipts: input.validationReceipts ?? [],
    humanReceipts: input.humanReceipts ?? [],
    nextSafeActions,
    quarantined: !safe,
  };

  return agentRunCapsuleSchema.parse(capsule);
}

export type CapsuleViolation = { rule: string; detail: string };

/** Deterministic Public-Core checks over a capsule. Empty = clean. */
export function validateCapsuleWithinPublicCore(capsule: AgentRunCapsule): CapsuleViolation[] {
  const violations: CapsuleViolation[] = [];

  for (const cmd of capsule.commandResults) {
    if (AGENT_FORBIDDEN_RISKS.has(cmd.risk)) {
      violations.push({ rule: "forbidden-risk-command", detail: `${cmd.name}:${cmd.risk}` });
    }
  }
  if (!isRedactionSafe(capsule.redactionStatus) && !capsule.quarantined) {
    violations.push({
      rule: "unproven-redaction-not-quarantined",
      detail: `redactionStatus=${capsule.redactionStatus}`,
    });
  }
  // repo_write capsules must record an owned, reviewed worktree profile.
  const hasRepoWrite = capsule.commandResults.some((c) => c.risk === "repo_write");
  if (hasRepoWrite && capsule.worktreeProfile !== "repo_write_reviewed") {
    violations.push({
      rule: "repo-write-needs-reviewed-worktree",
      detail: `worktreeProfile=${capsule.worktreeProfile}`,
    });
  }
  return violations;
}

/**
 * Helm Diagnostic Automation Evidence Layer — Command Registry (slice 1).
 *
 * Implements the typed `DiagnosticCommand` contract from
 * `docs/product/HELM_DIAGNOSTIC_AUTOMATION_EVIDENCE_LAYER_REQUIREMENTS.md` §3.
 *
 * Public Core automation ceiling is `read` / `local_draft`. Higher-risk entries
 * (`repo_write` / `external_write` / `activation` / `commitment`) may exist in
 * the registry ONLY when explicitly `disabled: true` (a blocked placeholder),
 * never as live automation. No entry performs network I/O, DB row reads,
 * external writes, connector activation, auto-send, auto-approve, or
 * auto-accept. Sibling-repo names are ownership pointers only — no cross-repo
 * execution.
 *
 * Pure data + zod. No I/O.
 */

import { z } from "zod";

export const diagnosticCommandRiskSchema = z.enum([
  "read",
  "local_draft",
  "repo_write",
  "external_write",
  "activation",
  "commitment",
]);
export type DiagnosticCommandRisk = z.infer<typeof diagnosticCommandRiskSchema>;

/**
 * Repo ownership pointers. Public Core source must NOT hard-code sibling
 * split-repo slugs — the public-mirror / release guards forbid naming sibling
 * repositories in public code (comments included). Any command owned outside
 * Public Core is therefore an opaque `sibling-repo` pointer; the concrete owner
 * is resolved out-of-band by that repo, never named here. (Contract alignment
 * vs. the requirements doc §3 enum, which listed sibling slugs.)
 */
export const REPO_OWNERS = ["helm-public", "sibling-repo"] as const;
export const repoOwnerSchema = z.enum(REPO_OWNERS);
export type RepoOwner = z.infer<typeof repoOwnerSchema>;

/** Risks Public Core automation may run by default. */
export const PUBLIC_CORE_AUTOMATABLE_RISKS: ReadonlySet<DiagnosticCommandRisk> = new Set([
  "read",
  "local_draft",
]);

/** Closed vocabulary of recognized forbidden actions (declarative only). */
export const KNOWN_FORBIDDEN_ACTIONS = [
  "auto_send",
  "auto_approve",
  "auto_accept_mapping",
  "activate_connector",
  "write_source_system",
  "read_business_rows",
  "materialize_overlay",
  "create_customer_commitment",
] as const;
export type KnownForbiddenAction = (typeof KNOWN_FORBIDDEN_ACTIONS)[number];

/** sideEffect terms that would breach the Public Core automation boundary. */
const FORBIDDEN_SIDE_EFFECT_TERMS = [
  "network",
  "external_write",
  "external-write",
  "activation",
  "activate",
  "commitment",
  "writeback",
  "write-back",
  "db_write",
  "row_read",
  "auto_send",
  "auto-send",
  "send_email",
  "connector_activation",
];

export const diagnosticCommandSchema = z
  .object({
    id: z.string().min(1),
    command: z.string().min(1),
    repoOwner: repoOwnerSchema,
    risk: diagnosticCommandRiskSchema,
    sideEffects: z.array(z.string()).default([]),
    requiredInputs: z.array(z.string()).default([]),
    outputSchemaRef: z.string().min(1),
    evidenceRefs: z.array(z.string()).default([]),
    forbiddenActions: z.array(z.string()).default([]),
    /** Blocked placeholder for a higher-risk command — never live automation. */
    disabled: z.boolean().optional(),
  })
  .strict();
export type DiagnosticCommand = z.infer<typeof diagnosticCommandSchema>;

/**
 * Slice-1 registry: public-safe `read` / `local_draft` entries only.
 * Source-to-Signal blueprint is a deferred `local_draft` placeholder (the real
 * contract lands with the source-profiler work; this is not its implementation).
 */
export const DIAGNOSTIC_COMMANDS: readonly DiagnosticCommand[] = [
  {
    id: "public-docs-guard",
    command: "npm run check:public-docs",
    repoOwner: "helm-public",
    risk: "read",
    sideEffects: ["reads public docs manifest and link sources"],
    requiredInputs: [],
    outputSchemaRef: "public-docs-curation",
    evidenceRefs: ["docs/public-docs-manifest.json"],
    forbiddenActions: ["auto_send", "auto_approve"],
  },
  {
    id: "public-release-guard",
    command: "npm run check:public-release",
    repoOwner: "helm-public",
    risk: "read",
    sideEffects: ["scans tracked files for public-mirror blockers"],
    requiredInputs: [],
    outputSchemaRef: "public-release-guard",
    evidenceRefs: ["scripts/public-release-guard.ts"],
    forbiddenActions: ["auto_send", "write_source_system"],
  },
  {
    id: "public-boundaries",
    command: "npm run check:boundaries",
    repoOwner: "helm-public",
    risk: "read",
    sideEffects: ["runs public mirror smoke and boundary guards"],
    requiredInputs: [],
    outputSchemaRef: "public-mirror-smoke",
    evidenceRefs: ["scripts/public-mirror-smoke.ts"],
    forbiddenActions: ["activate_connector", "materialize_overlay"],
  },
  {
    id: "delivery-doctor",
    command: "npm run delivery:doctor",
    repoOwner: "helm-public",
    risk: "read",
    sideEffects: ["local environment and Golden Path diagnosis"],
    requiredInputs: [],
    outputSchemaRef: "delivery-engineer-doctor",
    evidenceRefs: ["scripts/delivery-engineer-doctor.ts"],
    forbiddenActions: ["auto_approve", "write_source_system"],
  },
  {
    id: "diagnostic-doctor",
    command: "npm run diagnostics:doctor",
    repoOwner: "helm-public",
    risk: "read",
    sideEffects: ["read-only diagnostic packet over the local repo"],
    requiredInputs: [],
    outputSchemaRef: "HelmDoctorPacket",
    evidenceRefs: ["lib/diagnostics/doctor-packet.ts"],
    forbiddenActions: ["auto_send", "auto_approve", "materialize_overlay"],
  },
  {
    id: "private-repo-handoff-reference",
    command: "(reference only) handoff to owning repo",
    repoOwner: "helm-public",
    risk: "read",
    sideEffects: ["names the owning repo for an action; no cross-repo execution"],
    requiredInputs: [],
    outputSchemaRef: "HelmDoctorPacket",
    evidenceRefs: ["docs/product/HELM_DIAGNOSTIC_AUTOMATION_EVIDENCE_LAYER_REQUIREMENTS.md"],
    forbiddenActions: ["activate_connector", "write_source_system", "create_customer_commitment"],
  },
  {
    id: "incident-packet-draft",
    command: "(local draft) diagnostic incident packet",
    repoOwner: "helm-public",
    risk: "local_draft",
    sideEffects: ["produces a local incident draft; never auto-sent"],
    requiredInputs: ["commandId", "outputSummary"],
    outputSchemaRef: "DiagnosticIncidentPacket",
    evidenceRefs: ["docs/product/HELM_DIAGNOSTIC_AUTOMATION_EVIDENCE_LAYER_REQUIREMENTS.md"],
    forbiddenActions: ["auto_send", "create_customer_commitment"],
  },
  {
    id: "source-to-signal-blueprint-draft",
    command: "(deferred placeholder) source-to-signal blueprint",
    repoOwner: "helm-public",
    risk: "local_draft",
    sideEffects: ["candidate-only mapping draft; deferred to source-profiler work"],
    requiredInputs: ["redactedSourcePacket"],
    outputSchemaRef: "SourceToSignalBlueprint",
    evidenceRefs: ["docs/product/HELM_DIAGNOSTIC_AUTOMATION_EVIDENCE_LAYER_REQUIREMENTS.md"],
    forbiddenActions: [
      "auto_accept_mapping",
      "activate_connector",
      "materialize_overlay",
      "write_source_system",
    ],
  },
].map((entry) => diagnosticCommandSchema.parse(entry));

export type RegistryViolation = { commandId: string; rule: string; detail: string };

/**
 * Validate that a registry stays within the Public Core boundary. Returns a list
 * of violations (empty = clean). Used by both the risk guard and tests.
 */
export function validateRegistryWithinPublicCore(
  commands: readonly DiagnosticCommand[],
): RegistryViolation[] {
  const violations: RegistryViolation[] = [];
  const seen = new Set<string>();

  for (const cmd of commands) {
    if (seen.has(cmd.id)) {
      violations.push({ commandId: cmd.id, rule: "duplicate-id", detail: `duplicate command id ${cmd.id}` });
    }
    seen.add(cmd.id);

    // Risk ceiling: higher-than-local_draft must be an explicitly disabled placeholder.
    if (!PUBLIC_CORE_AUTOMATABLE_RISKS.has(cmd.risk) && cmd.disabled !== true) {
      violations.push({
        commandId: cmd.id,
        rule: "risk-ceiling",
        detail: `risk "${cmd.risk}" requires disabled:true (only read/local_draft are live automation)`,
      });
    }

    // Forbidden actions must come from the closed vocabulary.
    for (const action of cmd.forbiddenActions) {
      if (!(KNOWN_FORBIDDEN_ACTIONS as readonly string[]).includes(action)) {
        violations.push({
          commandId: cmd.id,
          rule: "unknown-forbidden-action",
          detail: `forbiddenActions contains unknown token "${action}"`,
        });
      }
    }

    // Side effects must not describe a boundary-breaching capability.
    for (const effect of cmd.sideEffects) {
      const lower = effect.toLowerCase();
      const hit = FORBIDDEN_SIDE_EFFECT_TERMS.find((term) => lower.includes(term));
      if (hit) {
        violations.push({
          commandId: cmd.id,
          rule: "forbidden-side-effect",
          detail: `sideEffects describes a forbidden capability ("${hit}")`,
        });
      }
    }

    // Sibling-repo entries are ownership pointers only and must be read-only.
    if (cmd.repoOwner !== "helm-public" && cmd.risk !== "read") {
      violations.push({
        commandId: cmd.id,
        rule: "sibling-repo-pointer-only",
        detail: `repoOwner "${cmd.repoOwner}" entries must be read-only ownership pointers`,
      });
    }
  }

  return violations;
}

export function isPublicCoreAutomatable(cmd: DiagnosticCommand): boolean {
  return PUBLIC_CORE_AUTOMATABLE_RISKS.has(cmd.risk) && cmd.disabled !== true;
}

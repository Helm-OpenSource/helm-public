/**
 * Helm Diagnostic Automation Evidence Layer — Doctor Packet (slice 1).
 *
 * Implements `HelmDoctorPacket` from the requirements doc §4. The builder is a
 * pure function: it accepts injected, read-only command results and repo info,
 * redacts free-text summaries, and produces a reviewable packet. It never
 * mutates files, calls the network, reads DB rows, or claims readiness/approval.
 *
 * `ok` on a command result means the doctor catalogued/observed that command;
 * `degradedEvidence` records when a command was not actually executed (slice 1
 * is catalog + read-only). The packet contains no release-ready / deployment /
 * accepted-by-human / approval claim.
 */

import { z } from "zod";
import { diagnosticCommandRiskSchema } from "./command-registry";

export const redactionStatusSchema = z.enum([
  "synthetic",
  "redacted",
  "alias_only",
  "raw_private_rejected",
  "unknown",
]);
export type RedactionStatus = z.infer<typeof redactionStatusSchema>;

export const doctorCommandResultSchema = z
  .object({
    commandId: z.string().min(1),
    /** Catalogued/observed by the doctor (NOT a pass/approval claim). */
    ok: z.boolean(),
    risk: diagnosticCommandRiskSchema,
    outputSummary: z.string(),
    evidenceRefs: z.array(z.string()).default([]),
    degradedEvidence: z.array(z.string()).optional(),
  })
  .strict();
export type DoctorCommandResult = z.infer<typeof doctorCommandResultSchema>;

export const doctorRepoSchema = z
  .object({
    name: z.string().min(1),
    branch: z.string().min(1),
    head: z.string().min(1),
    dirtyState: z.enum(["clean", "dirty", "unknown"]),
  })
  .strict();
export type DoctorRepo = z.infer<typeof doctorRepoSchema>;

export const helmDoctorPacketSchema = z
  .object({
    packetId: z.string().min(1),
    generatedAt: z.string().min(1),
    redactionStatus: redactionStatusSchema,
    repo: doctorRepoSchema,
    commandResults: z.array(doctorCommandResultSchema).default([]),
    warnings: z.array(z.string()).default([]),
    blockedActions: z.array(z.string()).default([]),
    nextActions: z.array(z.string()).default([]),
  })
  .strict();
export type HelmDoctorPacket = z.infer<typeof helmDoctorPacketSchema>;

/**
 * Redact free-text so a packet cannot leak raw private paths, emails, or
 * URL-embedded credentials. Structural content is preserved.
 */
export function redactText(input: string): string {
  return input
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@[^\s/]+/gi, "<redacted-credential>")
    .replace(/(?:\/(?:Users|home|root|var|tmp|private|opt|etc)\/)[^\s'")]*/g, "<path>")
    .replace(/[A-Za-z]:\\[^\s'")]*/g, "<path>")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "<email>");
}

export type BuildDoctorPacketInput = {
  repo: DoctorRepo;
  commandResults: Array<Omit<DoctorCommandResult, "outputSummary"> & { outputSummary: string }>;
  redactionStatus?: RedactionStatus;
  packetId?: string;
  now?: () => Date;
  /** Extra reviewer-facing next actions (kept free of readiness/approval claims). */
  nextActions?: string[];
};

/** Always-present, neutral next action — never an approval/readiness claim. */
const DEFAULT_NEXT_ACTION =
  "Human review required; the doctor took no automated action.";

export function buildDoctorPacket(input: BuildDoctorPacketInput): HelmDoctorPacket {
  const clock = input.now ?? (() => new Date());
  const generatedAt = clock().toISOString();

  const commandResults: DoctorCommandResult[] = input.commandResults.map((r) => ({
    commandId: r.commandId,
    ok: r.ok,
    risk: r.risk,
    outputSummary: redactText(r.outputSummary),
    evidenceRefs: r.evidenceRefs ?? [],
    ...(r.degradedEvidence ? { degradedEvidence: r.degradedEvidence } : {}),
  }));

  const warnings: string[] = [];
  const degradedCount = commandResults.filter((r) => (r.degradedEvidence?.length ?? 0) > 0).length;
  if (degradedCount > 0) {
    warnings.push(`${degradedCount} command(s) reported degraded evidence (not executed / incomplete).`);
  }
  if (input.repo.dirtyState === "unknown") {
    warnings.push("repo dirty-state is unknown (computed without git execution).");
  }

  // blockedActions: capabilities the doctor never performs. Stated as evidence
  // that nothing was sent/approved/activated — not a readiness claim.
  const blockedActions = [
    "auto_send: not performed",
    "auto_approve: not performed",
    "auto_accept_mapping: not performed",
    "activate_connector: not performed",
    "materialize_overlay: not performed",
  ];

  const packet = {
    packetId: input.packetId ?? `doctor-${generatedAt}`,
    generatedAt,
    redactionStatus: input.redactionStatus ?? "redacted",
    repo: input.repo,
    commandResults,
    warnings,
    blockedActions,
    nextActions: [DEFAULT_NEXT_ACTION, ...(input.nextActions ?? [])],
  };

  return helmDoctorPacketSchema.parse(packet);
}

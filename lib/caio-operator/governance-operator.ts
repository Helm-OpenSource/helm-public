import "server-only";

import { MembershipStatus } from "@prisma/client";
import { z } from "zod";

import { CAIO_IN_FLIGHT_DISPOSITIONS, CAIO_MANDATE_STAGES } from "@/lib/caio-governance/types";
import {
  activateCaioMandate,
  CaioMandateStoreError,
  createCaioMandateDraft,
  recordCaioGuardianStop,
  registerCaioPrincipalBinding,
  resumeCaioGuardianStop,
  revokeCaioMandate,
  revokeCaioPrincipalBinding,
  suspendCaioMandate,
} from "@/lib/caio-governance/mandate-store.service";
import { db } from "@/lib/db";

import {
  executeCaioOperation,
  type CaioOperationSummary,
  type CaioOperatorAccess,
  type CaioOperatorContext,
  type CaioOperatorResult,
} from "./operation-core";
import { mapCaioOperatorError, type CaioOperatorErrorCode } from "./operator-error-codes";
import { instant, principalRef, ref, refs, text } from "./schema-primitives";

/**
 * Controlled CLI entry for CAIO governance records: principal bindings, mandate lifecycle, guardian
 * stop and CEO resume. The frozen CAIO ADR keeps these records free of API routes and server actions
 * (enforced by the authority firewall in check:caio-terminology), so they are registered here by an
 * operator with database access, never from the web. The services re-check OWNER membership, CEO /
 * guardian bindings and write the audit log inside their own transactions. Registering a record
 * grants no runtime permission and triggers no execution or outbound effect.
 *
 * Nothing under app/, features/*\/actions or any "use server" module may import this file.
 */

export const registerPrincipalBindingSchema = z.object({
  userId: ref,
  principalRef,
  principalKind: z.enum(["ceo", "guardian", "fde"]),
  evidenceRef: ref,
}).strict();

export const revokePrincipalBindingSchema = z.object({ bindingId: ref }).strict();

export const createMandateDraftSchema = z.object({
  caioRef: principalRef,
  ceoRef: principalRef,
  stage: z.enum(CAIO_MANDATE_STAGES),
  stageDecisionRef: ref,
  objectiveRefs: refs,
  scopeRefs: refs,
  grantBasisRefs: refs,
  reservedMatterRefs: refs,
  humanResponsePolicyRef: ref,
  accountabilityAnchorRefs: refs,
  guardianStopRefs: refs,
  validFrom: instant,
  validUntil: instant,
  inFlightDisposition: z.enum(CAIO_IN_FLIGHT_DISPOSITIONS),
  auditRefs: refs,
}).strict();

export const mandateTransitionSchema = z.object({
  actorCeoRef: principalRef,
  mandateRecordId: ref,
  supersedesRecordId: ref.nullable().optional(),
}).strict();

const mandateSuspendOrRevokeSchema = mandateTransitionSchema.omit({ supersedesRecordId: true });

export const guardianStopSchema = z.object({
  guardianRef: principalRef,
  mandateRecordId: ref,
  reason: text(500),
  auditRefs: refs,
}).strict();

export const resumeGuardianStopSchema = z.object({
  actorCeoRef: principalRef,
  stopRecordId: ref,
}).strict();

type GovernanceOperation = Readonly<{
  access: CaioOperatorAccess;
  actor: "owner" | "ceo" | "guardian";
  schema: z.ZodTypeAny;
  invoke: (ctx: CaioOperatorContext, input: never) => Promise<unknown>;
  /** Schema-valid example; placeholder refs must be replaced with real references before --apply. */
  template: Readonly<Record<string, unknown>>;
}>;

const identity = (ctx: CaioOperatorContext) => ({
  workspaceId: ctx.workspaceId,
  actorUserId: ctx.actorUserId,
  english: ctx.english,
});

function operation<S extends z.ZodTypeAny>(definition: {
  access: CaioOperatorAccess;
  actor: "owner" | "ceo" | "guardian";
  schema: S;
  invoke: (ctx: CaioOperatorContext, input: z.infer<S>) => Promise<unknown>;
  template: Readonly<Record<string, unknown>>;
}): GovernanceOperation {
  return definition as GovernanceOperation;
}

const NOW = "2026-01-01T00:00:00.000Z";
const LATER = "2026-01-08T00:00:00.000Z";

export const CAIO_GOVERNANCE_OPERATIONS = {
  registerPrincipalBinding: operation({
    access: "owner", actor: "owner", schema: registerPrincipalBindingSchema,
    invoke: (ctx, input) => registerCaioPrincipalBinding({ ...input, ...identity(ctx) }),
    template: { userId: "user-id", principalRef: "ceo-primary", principalKind: "ceo", evidenceRef: "evidence:replace-me" },
  }),
  revokePrincipalBinding: operation({
    access: "owner", actor: "owner", schema: revokePrincipalBindingSchema,
    invoke: (ctx, input) => revokeCaioPrincipalBinding({ ...input, ...identity(ctx) }),
    template: { bindingId: "binding-id" },
  }),
  createMandateDraft: operation({
    access: "owner", actor: "owner", schema: createMandateDraftSchema,
    invoke: (ctx, input) => createCaioMandateDraft({ ...input, ...identity(ctx) }),
    template: { caioRef: "caio-primary", ceoRef: "ceo-primary", stage: "observe", stageDecisionRef: "decision:replace-me",
      objectiveRefs: ["objective:replace-me"], scopeRefs: ["scope:workspace"], grantBasisRefs: ["caio-mandate-grant:ceo-primary:issuance-replace-me"],
      reservedMatterRefs: [], humanResponsePolicyRef: "policy:replace-me", accountabilityAnchorRefs: ["anchor:replace-me"],
      guardianStopRefs: ["guardian-primary"], validFrom: NOW, validUntil: LATER, inFlightDisposition: "freeze", auditRefs: ["audit:replace-me"] },
  }),
  activateMandate: operation({
    access: "principal_bound", actor: "ceo", schema: mandateTransitionSchema,
    invoke: (ctx, input) => activateCaioMandate({ ...input, ...identity(ctx) }),
    template: { actorCeoRef: "ceo-primary", mandateRecordId: "mandate-record-id" },
  }),
  suspendMandate: operation({
    access: "principal_bound", actor: "ceo", schema: mandateSuspendOrRevokeSchema,
    invoke: (ctx, input) => suspendCaioMandate({ ...input, ...identity(ctx) }),
    template: { actorCeoRef: "ceo-primary", mandateRecordId: "mandate-record-id" },
  }),
  revokeMandate: operation({
    access: "principal_bound", actor: "ceo", schema: mandateSuspendOrRevokeSchema,
    invoke: (ctx, input) => revokeCaioMandate({ ...input, ...identity(ctx) }),
    template: { actorCeoRef: "ceo-primary", mandateRecordId: "mandate-record-id" },
  }),
  recordGuardianStop: operation({
    access: "principal_bound", actor: "guardian", schema: guardianStopSchema,
    invoke: (ctx, input) => recordCaioGuardianStop({ ...input, ...identity(ctx) }),
    template: { guardianRef: "guardian-primary", mandateRecordId: "mandate-record-id", reason: "replace with the stop reason", auditRefs: ["audit:replace-me"] },
  }),
  resumeGuardianStop: operation({
    access: "principal_bound", actor: "ceo", schema: resumeGuardianStopSchema,
    invoke: (ctx, input) => resumeCaioGuardianStop({ ...input, ...identity(ctx) }),
    template: { actorCeoRef: "ceo-primary", stopRecordId: "stop-record-id" },
  }),
} as const satisfies Record<string, GovernanceOperation>;

export type CaioGovernanceOperationKey = keyof typeof CAIO_GOVERNANCE_OPERATIONS;

export function isCaioGovernanceOperationKey(value: string): value is CaioGovernanceOperationKey {
  return Object.prototype.hasOwnProperty.call(CAIO_GOVERNANCE_OPERATIONS, value);
}

export function mapCaioGovernanceOperatorError(error: unknown): CaioOperatorErrorCode {
  if (error instanceof CaioMandateStoreError) return "governance_rejected";
  return mapCaioOperatorError(error);
}

/**
 * Runs one governance operation for an explicit actor. Without apply, only access and input are
 * validated and nothing is written. The actor is named by the operator, so every write still passes
 * the services' own membership, binding and audit checks.
 */
export async function runCaioGovernanceOperation(args: {
  operation: CaioGovernanceOperationKey;
  workspaceId: string;
  actorUserId: string;
  rawInput: unknown;
  apply: boolean;
}): Promise<CaioOperatorResult<CaioOperationSummary>> {
  const definition: GovernanceOperation = CAIO_GOVERNANCE_OPERATIONS[args.operation];
  const [membership, user, workspace] = await Promise.all([
    db.membership.findUnique({
      where: { workspaceId_userId: { workspaceId: args.workspaceId, userId: args.actorUserId } },
      select: { role: true, status: true },
    }),
    db.user.findUnique({ where: { id: args.actorUserId }, select: { name: true } }),
    db.workspace.findUnique({ where: { id: args.workspaceId }, select: { defaultLocale: true } }),
  ]);
  const activeRole = membership?.status === MembershipStatus.ACTIVE ? membership.role : null;
  return executeCaioOperation({
    access: definition.access,
    membershipRole: activeRole,
    context: {
      workspaceId: args.workspaceId,
      actorUserId: args.actorUserId,
      actorName: user?.name ?? "",
      english: workspace?.defaultLocale === "en-US",
    },
    schema: definition.schema,
    rawInput: args.rawInput,
    invoke: definition.invoke as (ctx: CaioOperatorContext, input: unknown) => Promise<unknown>,
    mapError: mapCaioGovernanceOperatorError,
    validateOnly: !args.apply,
  });
}

export type CaioGovernanceCliArgs =
  | { mode: "template"; operation: CaioGovernanceOperationKey }
  | {
    mode: "run";
    operation: CaioGovernanceOperationKey;
    workspaceId: string;
    actorUserId: string;
    inputFile: string;
    apply: boolean;
  }
  | { mode: "invalid"; reason: string };

export function parseCaioGovernanceCliArgs(argv: readonly string[]): CaioGovernanceCliArgs {
  const get = (name: string) => {
    const hits = argv.filter((arg) => arg.startsWith(`--${name}=`));
    return hits.length === 1 ? hits[0].slice(name.length + 3).trim() : hits.length === 0 ? undefined : null;
  };
  const known = new Set(["operation", "template", "workspace-id", "actor-user-id", "input-file"]);
  for (const arg of argv) {
    if (arg === "--apply") continue;
    const name = /^--([a-z-]+)=/u.exec(arg)?.[1];
    if (!name || !known.has(name)) return { mode: "invalid", reason: "unknown_argument" };
  }
  if (argv.filter((arg) => arg === "--apply").length > 1) return { mode: "invalid", reason: "duplicate_argument" };

  const template = get("template");
  if (template !== undefined) {
    if (template === null || argv.length !== 1) return { mode: "invalid", reason: "template_takes_no_other_arguments" };
    if (!isCaioGovernanceOperationKey(template)) return { mode: "invalid", reason: "unknown_operation" };
    return { mode: "template", operation: template };
  }

  const operationKey = get("operation");
  const workspaceId = get("workspace-id");
  const actorUserId = get("actor-user-id");
  const inputFile = get("input-file");
  if ([operationKey, workspaceId, actorUserId, inputFile].some((value) => value === null)) {
    return { mode: "invalid", reason: "duplicate_argument" };
  }
  if (!operationKey || !workspaceId || !actorUserId || !inputFile) return { mode: "invalid", reason: "missing_argument" };
  if (!isCaioGovernanceOperationKey(operationKey)) return { mode: "invalid", reason: "unknown_operation" };
  return { mode: "run", operation: operationKey, workspaceId, actorUserId, inputFile, apply: argv.includes("--apply") };
}

"use server";

/**
 * CAIO operator entry points. Each action is a thin wrapper: session → access pre-check → schema →
 * existing service (which re-checks access, verifies CEO/guardian bindings where required, and
 * writes the audit log in its transaction). Registration is OWNER-only; CEO/guardian acts are
 * authorized by the service through the registered principal binding.
 * These actions register governance records and initialization evidence only; they grant no
 * runtime permission and trigger no execution or outbound effect.
 */
import {
  activateCaioMandate,
  createCaioMandateDraft,
  recordCaioGuardianStop,
  registerCaioPrincipalBinding,
  resumeCaioGuardianStop,
  revokeCaioMandate,
  revokeCaioPrincipalBinding,
  suspendCaioMandate,
} from "@/lib/caio-governance/mandate-store.service";

import {
  createDataAssetCatalogEntry,
  recordDataAssetAuthorizationReceipt,
  recordDataAssetClassificationReceipt,
  recordDataAssetConnectionReceipt,
  recordDataAssetInitializationReceipt,
} from "@/lib/stage1-owner-loop/data-asset-catalog.service";
import {
  createEnterpriseObservationProgram,
  registerObservationSource,
} from "@/lib/stage1-owner-loop/observation.service";

import { runOwnerOperation, type CaioOperatorContext } from "./run-owner-operation";
import {
  catalogAuthorizationSchema,
  catalogClassificationSchema,
  catalogConnectionSchema,
  catalogInitializationSchema,
  createCatalogEntrySchema,
  createMandateDraftSchema,
  createObservationProgramSchema,
  registerObservationSourceSchema,
  guardianStopSchema,
  mandateTransitionSchema,
  registerPrincipalBindingSchema,
  resumeGuardianStopSchema,
  revokePrincipalBindingSchema,
} from "./schemas";

export async function registerPrincipalBindingAction(rawInput: unknown) {
  return runOwnerOperation({
    access: "owner",
    schema: registerPrincipalBindingSchema,
    rawInput,
    invoke: (ctx, input) => registerCaioPrincipalBinding({
      ...input, workspaceId: ctx.workspaceId, actorUserId: ctx.actorUserId, english: ctx.english,
    }),
  });
}

export async function revokePrincipalBindingAction(rawInput: unknown) {
  return runOwnerOperation({
    access: "owner",
    schema: revokePrincipalBindingSchema,
    rawInput,
    invoke: (ctx, input) => revokeCaioPrincipalBinding({
      ...input, workspaceId: ctx.workspaceId, actorUserId: ctx.actorUserId, english: ctx.english,
    }),
  });
}

export async function createMandateDraftAction(rawInput: unknown) {
  return runOwnerOperation({
    access: "owner",
    schema: createMandateDraftSchema,
    rawInput,
    invoke: (ctx, input) => createCaioMandateDraft({
      ...input, workspaceId: ctx.workspaceId, actorUserId: ctx.actorUserId, english: ctx.english,
    }),
  });
}

export async function activateMandateAction(rawInput: unknown) {
  return runOwnerOperation({
    access: "principal_bound",
    schema: mandateTransitionSchema,
    rawInput,
    invoke: (ctx, input) => activateCaioMandate({
      ...input, workspaceId: ctx.workspaceId, actorUserId: ctx.actorUserId, english: ctx.english,
    }),
  });
}

export async function suspendMandateAction(rawInput: unknown) {
  return runOwnerOperation({
    access: "principal_bound",
    schema: mandateTransitionSchema.omit({ supersedesRecordId: true }),
    rawInput,
    invoke: (ctx, input) => suspendCaioMandate({
      ...input, workspaceId: ctx.workspaceId, actorUserId: ctx.actorUserId, english: ctx.english,
    }),
  });
}

export async function revokeMandateAction(rawInput: unknown) {
  return runOwnerOperation({
    access: "principal_bound",
    schema: mandateTransitionSchema.omit({ supersedesRecordId: true }),
    rawInput,
    invoke: (ctx, input) => revokeCaioMandate({
      ...input, workspaceId: ctx.workspaceId, actorUserId: ctx.actorUserId, english: ctx.english,
    }),
  });
}

export async function recordGuardianStopAction(rawInput: unknown) {
  return runOwnerOperation({
    access: "principal_bound",
    schema: guardianStopSchema,
    rawInput,
    invoke: (ctx, input) => recordCaioGuardianStop({
      ...input, workspaceId: ctx.workspaceId, actorUserId: ctx.actorUserId, english: ctx.english,
    }),
  });
}

export async function resumeGuardianStopAction(rawInput: unknown) {
  return runOwnerOperation({
    access: "principal_bound",
    schema: resumeGuardianStopSchema,
    rawInput,
    invoke: (ctx, input) => resumeCaioGuardianStop({
      ...input, workspaceId: ctx.workspaceId, actorUserId: ctx.actorUserId, english: ctx.english,
    }),
  });
}

const actor = (ctx: CaioOperatorContext) => ({
  workspaceId: ctx.workspaceId,
  actorUserId: ctx.actorUserId,
  actorName: ctx.actorName,
  english: ctx.english,
});

// Data asset catalog and observation registration. Observation runs are not exposed here:
// the operating-context snapshot runtime starts and completes them.

export async function createCatalogEntryAction(rawInput: unknown) {
  return runOwnerOperation({
    access: "owner",
    schema: createCatalogEntrySchema,
    rawInput,
    invoke: (ctx, input) => createDataAssetCatalogEntry({ ...input, ...actor(ctx) }),
  });
}

export async function recordCatalogClassificationAction(rawInput: unknown) {
  return runOwnerOperation({
    access: "owner",
    schema: catalogClassificationSchema,
    rawInput,
    invoke: (ctx, input) => recordDataAssetClassificationReceipt({ ...input, ...actor(ctx) }),
  });
}

export async function recordCatalogAuthorizationAction(rawInput: unknown) {
  return runOwnerOperation({
    access: "owner",
    schema: catalogAuthorizationSchema,
    rawInput,
    invoke: (ctx, input) => recordDataAssetAuthorizationReceipt({ ...input, ...actor(ctx) }),
  });
}

export async function recordCatalogConnectionAction(rawInput: unknown) {
  return runOwnerOperation({
    access: "owner",
    schema: catalogConnectionSchema,
    rawInput,
    invoke: (ctx, input) => recordDataAssetConnectionReceipt({ ...input, ...actor(ctx) }),
  });
}

export async function recordCatalogInitializationAction(rawInput: unknown) {
  return runOwnerOperation({
    access: "owner",
    schema: catalogInitializationSchema,
    rawInput,
    invoke: (ctx, input) => recordDataAssetInitializationReceipt({ ...input, ...actor(ctx) }),
  });
}

export async function createObservationProgramAction(rawInput: unknown) {
  return runOwnerOperation({
    access: "owner",
    schema: createObservationProgramSchema,
    rawInput,
    invoke: (ctx, input) => createEnterpriseObservationProgram({ ...input, ...actor(ctx) }),
  });
}

export async function registerObservationSourceAction(rawInput: unknown) {
  return runOwnerOperation({
    access: "owner",
    schema: registerObservationSourceSchema,
    rawInput,
    invoke: (ctx, input) => registerObservationSource({ ...input, ...actor(ctx) }),
  });
}


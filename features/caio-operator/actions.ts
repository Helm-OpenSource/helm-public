"use server";

/**
 * CAIO operator web entry points for the data asset catalog, observation registration and G0
 * initialization. Each action is a thin wrapper: session → access pre-check → schema → existing
 * service (which re-checks access, verifies the CEO binding where required, and writes the audit log
 * in its transaction). Registration is OWNER-only; G0 acceptance and revocation are CEO acts
 * authorized by the service through the registered principal binding.
 * Governance records (bindings, mandate, guardian stop, CEO resume) are deliberately absent: the
 * frozen CAIO ADR keeps them free of server actions (authority firewall), so they go through the
 * controlled CLI `npm run caio:governance-operator`. These actions grant no runtime permission and
 * trigger no execution or outbound effect.
 */
import {
  acceptCaioInitializationGate,
  recordCaioInitializationAssessment,
  revokeCaioInitializationGate,
} from "@/lib/stage1-owner-loop/caio-initialization-gate-store.service";
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
  acceptInitializationGateSchema,
  catalogAuthorizationSchema,
  catalogClassificationSchema,
  catalogConnectionSchema,
  catalogInitializationSchema,
  createCatalogEntrySchema,
  createObservationProgramSchema,
  recordInitializationAssessmentSchema,
  registerObservationSourceSchema,
  revokeInitializationGateSchema,
} from "./schemas";

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

// G0 initialization. Recording an assessment is registration (OWNER); accepting or revoking the
// gate is a CEO act authorized by the service through the live CEO binding.

export async function recordInitializationAssessmentAction(rawInput: unknown) {
  return runOwnerOperation({
    access: "owner",
    schema: recordInitializationAssessmentSchema,
    rawInput,
    invoke: (ctx, input) => recordCaioInitializationAssessment({
      ...input, workspaceId: ctx.workspaceId, actorUserId: ctx.actorUserId, english: ctx.english,
    }),
  });
}

export async function acceptInitializationGateAction(rawInput: unknown) {
  return runOwnerOperation({
    access: "principal_bound",
    schema: acceptInitializationGateSchema,
    rawInput,
    invoke: (ctx, input) => acceptCaioInitializationGate({
      ...input, workspaceId: ctx.workspaceId, actorUserId: ctx.actorUserId, english: ctx.english,
    }),
  });
}

export async function revokeInitializationGateAction(rawInput: unknown) {
  return runOwnerOperation({
    access: "principal_bound",
    schema: revokeInitializationGateSchema,
    rawInput,
    invoke: (ctx, input) => revokeCaioInitializationGate({
      ...input, workspaceId: ctx.workspaceId, actorUserId: ctx.actorUserId, english: ctx.english,
    }),
  });
}


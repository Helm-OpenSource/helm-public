// CAIO Pro V1 completion-gate store — isolated MySQL suite.
//
// Exercises the persistence discipline of the completion store against a
// real database: append-only attestations with idempotent replay and
// divergent-replay conflict, cross-workspace isolation, the live-derived
// not_ready assessment, fail-closed acceptance against a not_ready
// assessment, and the TODO status readout. The full ready -> accept ->
// revoke chain runs inside the synthetic vertical loop suite
// (caio-pro-v1-synthetic-loop.mysql.test.ts) where the complete evidence
// world already exists.
//
// Honesty statement: every fixture string is synthetic. This suite is NOT
// customer initialization, NOT production evidence, and performs no
// external side effect.

import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

import { registerCaioPrincipalBinding } from "@/lib/caio-governance/mandate-store.service";
import { db } from "@/lib/db";

import {
  acceptCaioProV1CompletionGate,
  getCaioProV1CompletionStatus,
  recordCaioProV1CompletionAssessment,
  recordCaioProV1EvidenceAttestation,
  recordCaioQuestionValueReceipt,
} from "./caio-pro-completion-store.service";
import { CAIO_PRO_V1_COMPLETION_ITEMS } from "./caio-pro-completion";
import { syntheticCaioQuestionValueReceiptInput } from "./caio-pro-completion.test-fixtures";

const integrationDatabaseUrl = process.env.CAIO_PRO_V1_DATABASE_URL;
const confirmedIntegrationDatabaseName =
  process.env.CAIO_PRO_V1_TEST_DATABASE_NAME;
const describeMysql = integrationDatabaseUrl
  ? describe.sequential
  : describe.skip;
const suffix = `${process.pid}-${Date.now()}`;
const ISOLATED_DATABASE_PREFIX = "helm_caio_pro_v1_";

function assertIsolatedDatabaseTarget(): void {
  if (
    !integrationDatabaseUrl ||
    process.env.DATABASE_URL !== integrationDatabaseUrl
  ) {
    throw new Error(
      "DATABASE_URL must equal CAIO_PRO_V1_DATABASE_URL for the isolated integration test.",
    );
  }
  let databaseName = "";
  try {
    const parsed = new URL(integrationDatabaseUrl);
    databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/u, ""));
  } catch {
    throw new Error(
      "CAIO_PRO_V1_DATABASE_URL must be a valid isolated MySQL URL.",
    );
  }
  if (
    !databaseName.startsWith(ISOLATED_DATABASE_PREFIX) ||
    databaseName !== confirmedIntegrationDatabaseName
  ) {
    throw new Error(
      "Refusing CAIO Pro V1 completion integration test: confirm the isolated database name with CAIO_PRO_V1_TEST_DATABASE_NAME and use the helm_caio_pro_v1_ prefix.",
    );
  }
}

async function establishWorkspace(key: string): Promise<{
  workspaceId: string;
  ownerUserId: string;
  ceoRef: string;
}> {
  const workspace = await db.workspace.create({
    data: {
      name: `CAIO completion ${key} ${suffix}`,
      slug: `caio-completion-${key}-${suffix}`,
    },
  });
  const owner = await db.user.create({
    data: {
      name: `Completion Owner ${key}`,
      email: `caio-completion-${key}-${suffix}@example.test`,
    },
  });
  await db.membership.create({
    data: {
      workspaceId: workspace.id,
      userId: owner.id,
      role: WorkspaceRole.OWNER,
      status: MembershipStatus.ACTIVE,
    },
  });
  const ceoRef = `ceo-completion-${key}-${suffix}`;
  await registerCaioPrincipalBinding({
    workspaceId: workspace.id,
    actorUserId: owner.id,
    userId: owner.id,
    principalRef: ceoRef,
    principalKind: "ceo",
    evidenceRef: `evidence:ceo-binding:${key}:${suffix}`,
  });
  return { workspaceId: workspace.id, ownerUserId: owner.id, ceoRef };
}

function valueReceiptPayload(questionId: string) {
  const {
    workspaceRef: _workspaceRef,
    selectionReceiptRef: _selectionReceiptRef,
    recordedAt: _recordedAt,
    ...payload
  } = syntheticCaioQuestionValueReceiptInput(questionId);
  return payload;
}

describeMysql(
  "CAIO Pro V1 completion store with an isolated MySQL database",
  () => {
    let workspaceA = { workspaceId: "", ownerUserId: "", ceoRef: "" };
    let workspaceB = { workspaceId: "", ownerUserId: "", ceoRef: "" };

    afterAll(async () => {
      // Disposable prefix-guarded database; per-run suffixes prevent
      // collisions with later runs. Evidence rows are append-only by design.
      await db.$disconnect();
    });

    it("prepares two isolated workspaces", async () => {
      assertIsolatedDatabaseTarget();
      workspaceA = await establishWorkspace("a");
      workspaceB = await establishWorkspace("b");
      expect(workspaceA.workspaceId).not.toBe(workspaceB.workspaceId);
    });

    it("records an owner attestation, replays identically, and refuses divergent replay", async () => {
      const input = {
        workspaceId: workspaceA.workspaceId,
        actorUserId: workspaceA.ownerUserId,
        ceoPrincipalRef: workspaceA.ceoRef,
        itemKey: "p4_asset_inventory_confirmed" as const,
        statement: "Synthetic inventory confirmation walkthrough completed",
        evidenceRefs: [`evidence:inventory-confirmed:${suffix}`],
        idempotencyKey: `attest-inventory-${suffix}`,
      };
      const first = await recordCaioProV1EvidenceAttestation(input);
      expect(first.replayed).toBe(false);
      expect(first.attestation.version).toBe(1);

      const replay = await recordCaioProV1EvidenceAttestation(input);
      expect(replay.replayed).toBe(true);
      expect(replay.attestation.contentHash).toBe(
        first.attestation.contentHash,
      );

      await expect(
        recordCaioProV1EvidenceAttestation({
          ...input,
          statement: "A divergent statement under the same idempotency key",
        }),
      ).rejects.toThrow("idempotency_key_payload_conflict");
    });

    it("supersedes an attestation by version without deleting history", async () => {
      const second = await recordCaioProV1EvidenceAttestation({
        workspaceId: workspaceA.workspaceId,
        actorUserId: workspaceA.ownerUserId,
        ceoPrincipalRef: workspaceA.ceoRef,
        itemKey: "p4_asset_inventory_confirmed",
        statement: "Synthetic inventory confirmation superseding statement",
        evidenceRefs: [`evidence:inventory-confirmed-v2:${suffix}`],
        idempotencyKey: `attest-inventory-v2-${suffix}`,
      });
      expect(second.attestation.version).toBe(2);
      expect(
        await db.caioProV1EvidenceAttestation.count({
          where: {
            workspaceId: workspaceA.workspaceId,
            itemKey: "p4_asset_inventory_confirmed",
          },
        }),
      ).toBe(2);
    });

    it("lets a bound FDE record on the CEO's behalf but never sign acceptance", async () => {
      // Register a distinct FDE member + fde principal binding.
      const fde = await db.user.create({
        data: {
          email: `caio-completion-fde-${suffix}@example.com`,
          name: "CAIO completion fde",
        },
      });
      await db.membership.create({
        data: {
          workspaceId: workspaceA.workspaceId,
          userId: fde.id,
          role: WorkspaceRole.ADMIN,
          status: MembershipStatus.ACTIVE,
        },
      });
      const fdeRef = `fde-completion-${suffix}`;
      await registerCaioPrincipalBinding({
        workspaceId: workspaceA.workspaceId,
        actorUserId: workspaceA.ownerUserId,
        userId: fde.id,
        principalRef: fdeRef,
        principalKind: "fde",
        evidenceRef: `evidence:fde-binding:${suffix}`,
      });
      // FDE records an attestation; the recorder seat is stamped as fde
      // while the CEO seat stays the accountable anchor.
      const recorded = await recordCaioProV1EvidenceAttestation({
        workspaceId: workspaceA.workspaceId,
        actorUserId: fde.id,
        ceoPrincipalRef: workspaceA.ceoRef,
        recorderFdePrincipalRef: fdeRef,
        itemKey: "p3_device_security_accepted",
        statement: "Synthetic device security walkthrough recorded by fde",
        evidenceRefs: [`evidence:device-security:${suffix}`],
        idempotencyKey: `attest-fde-device-${suffix}`,
      });
      expect(recorded.attestation.recordedByPrincipalKind).toBe("fde");
      expect(recorded.attestation.recordedByPrincipalRef).toBe(fdeRef);
      expect(recorded.attestation.ceoPrincipalRef).toBe(workspaceA.ceoRef);
      // Claiming the fde path without a live fde binding fails closed.
      await expect(
        recordCaioProV1EvidenceAttestation({
          workspaceId: workspaceA.workspaceId,
          actorUserId: workspaceA.ownerUserId,
          ceoPrincipalRef: workspaceA.ceoRef,
          recorderFdePrincipalRef: `fde-unbound-${suffix}`,
          itemKey: "p3_runtime_truth_bound",
          statement: "Should fail closed",
          evidenceRefs: [`evidence:should-fail:${suffix}`],
          idempotencyKey: `attest-fde-unbound-${suffix}`,
        }),
      ).rejects.toThrow("live_fde_principal_binding_required");
      // The FDE can never sign completion acceptance: acceptance asserts a
      // live CEO binding held by the ACTOR, which the fde user lacks.
      await recordCaioProV1CompletionAssessment({
        workspaceId: workspaceA.workspaceId,
        actorUserId: workspaceA.ownerUserId,
        evaluationKey: `completion-eval-fde-${suffix}`,
      });
      const fdeAssessmentRow =
        await db.caioProV1CompletionAssessment.findFirst({
          where: { workspaceId: workspaceA.workspaceId },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
      if (!fdeAssessmentRow) throw new Error("assessment row required");
      await expect(
        acceptCaioProV1CompletionGate({
          workspaceId: workspaceA.workspaceId,
          actorUserId: fde.id,
          ceoPrincipalRef: workspaceA.ceoRef,
          assessmentId: fdeAssessmentRow.id,
          idempotencyKey: `accept-by-fde-${suffix}`,
          reasonCodes: ["site_deployment_reviewed"],
          evidenceRefs: [`evidence:fde-accept-attempt:${suffix}`],
        }),
      ).rejects.toThrow(/live_ceo_principal_binding_required/);
    });

    it("refuses an attestation without a live CEO binding in that workspace", async () => {
      await expect(
        recordCaioProV1EvidenceAttestation({
          workspaceId: workspaceB.workspaceId,
          actorUserId: workspaceB.ownerUserId,
          // Workspace A's CEO ref is not bound in workspace B.
          ceoPrincipalRef: workspaceA.ceoRef,
          itemKey: "p3_runtime_truth_bound",
          statement: "Synthetic cross-workspace attempt",
          evidenceRefs: [`evidence:cross:${suffix}`],
          idempotencyKey: `attest-cross-${suffix}`,
        }),
      ).rejects.toThrow("live_ceo_principal_binding_required");
    });

    it("refuses a value receipt while no CEO selection exists", async () => {
      await expect(
        recordCaioQuestionValueReceipt({
          workspaceId: workspaceA.workspaceId,
          actorUserId: workspaceA.ownerUserId,
          payload: valueReceiptPayload("question-1"),
          idempotencyKey: `value-no-selection-${suffix}`,
        }),
      ).rejects.toThrow("current_question_selection_required");
    });

    it("derives a not_ready completion assessment live and replays it by key", async () => {
      const evaluationKey = `completion-eval-${suffix}`;
      const first = await recordCaioProV1CompletionAssessment({
        workspaceId: workspaceA.workspaceId,
        actorUserId: workspaceA.ownerUserId,
        evaluationKey,
      });
      expect(first.replayed).toBe(false);
      expect(first.assessment.decision).toBe("not_ready");
      // The recorded attestation flips its item; the rest stay missing.
      const inventoryItem = first.assessment.items.find(
        (item) => item.itemKey === "p4_asset_inventory_confirmed",
      );
      expect(inventoryItem?.status).toBe("satisfied");
      expect(first.assessment.missingItemKeys).toContain("p5_g0_accepted");
      expect(first.assessment.missingItemKeys).toContain(
        "p6_ceo_selection_recorded",
      );

      const replay = await recordCaioProV1CompletionAssessment({
        workspaceId: workspaceA.workspaceId,
        actorUserId: workspaceA.ownerUserId,
        evaluationKey,
      });
      expect(replay.replayed).toBe(true);
      expect(replay.assessment.contentHash).toBe(
        first.assessment.contentHash,
      );
    });

    it("refuses CEO acceptance against a not_ready assessment", async () => {
      const assessmentRow = await db.caioProV1CompletionAssessment.findFirst(
        {
          where: { workspaceId: workspaceA.workspaceId },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        },
      );
      if (!assessmentRow) throw new Error("assessment row required");
      await expect(
        acceptCaioProV1CompletionGate({
          workspaceId: workspaceA.workspaceId,
          actorUserId: workspaceA.ownerUserId,
          ceoPrincipalRef: workspaceA.ceoRef,
          assessmentId: assessmentRow.id,
          idempotencyKey: `accept-not-ready-${suffix}`,
          reasonCodes: ["site_deployment_reviewed"],
          evidenceRefs: [`evidence:acceptance-attempt:${suffix}`],
        }),
      ).rejects.toThrow("completion_assessment_stale_reassessment_required");
      expect(
        await db.caioProV1CompletionGateReceipt.count({
          where: { workspaceId: workspaceA.workspaceId },
        }),
      ).toBe(0);
      expect(
        await db.caioProV1CompletionGateHead.findUnique({
          where: { workspaceId: workspaceA.workspaceId },
        }),
      ).toBeNull();
    });

    it("keeps attestation evidence isolated across workspaces", async () => {
      const statusB = await getCaioProV1CompletionStatus({
        workspaceId: workspaceB.workspaceId,
        actorUserId: workspaceB.ownerUserId,
      });
      expect(statusB.state).toBe("not_ready");
      // Workspace A's inventory attestation must not leak into B.
      expect(statusB.missingItemKeys).toContain(
        "p4_asset_inventory_confirmed",
      );
    });

    it("surfaces the full governed TODO list in the status readout", async () => {
      const status = await getCaioProV1CompletionStatus({
        workspaceId: workspaceA.workspaceId,
        actorUserId: workspaceA.ownerUserId,
      });
      expect(status.state).toBe("not_ready");
      expect(status.receipt).toBeNull();
      expect(status.items.map((item) => item.itemKey)).toEqual([
        ...CAIO_PRO_V1_COMPLETION_ITEMS,
      ]);
      expect(status.liveAssessment.fullFunctionOperation).toBe(
        "not_authorized_by_this_receipt",
      );
    });
  },
);

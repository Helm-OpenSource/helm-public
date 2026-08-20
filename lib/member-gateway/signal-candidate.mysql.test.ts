// lib/member-gateway/signal-candidate.mysql.test.ts
// Isolated-MySQL coverage for the member signal candidate slice (spec
// §5.1; M2c Tasks 2-3): materialization, review, and stage-one (task-only)
// promotion. Gated on MEMBER_SIGNAL_CANDIDATE_DATABASE_URL — same mandate
// pattern as signal-store.mysql.test.ts.

import {
  ActionType,
  ApprovalStatus,
  ArtifactBundleStatus,
  ArtifactReviewStatus,
  ActorType,
  MembershipStatus,
  SourceType,
  WorkspaceRole,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { WorkspaceServiceGovernanceError } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import type { MemberWorkSignalPayload, MemberWorkSignalDraft } from "@/lib/member-gateway/signal";
import {
  MemberSignalCandidateError,
  materializeMemberWorkSignalCandidate,
} from "@/lib/member-gateway/signal-candidate-materializer";
import {
  MemberSignalCandidateReviewError,
  promoteMemberWorkSignalCandidateToTask,
  reviewMemberWorkSignalCandidate,
} from "@/lib/member-gateway/signal-candidate-review.service";
import {
  MEMBER_SIGNAL_CANDIDATE_ARTIFACT_TYPE,
  MEMBER_SIGNAL_CANDIDATE_REVIEW_POSTURE,
  validateMemberWorkSignalCandidateArtifact,
} from "@/lib/member-gateway/signal-candidate";
import type {
  MemberSignalCandidateObjectAnchor,
  MemberWorkSignalCandidateArtifact,
} from "@/lib/member-gateway/signal-candidate";
import {
  issueMemberWorkSignalChallenge,
  submitMemberWorkSignal,
} from "@/lib/member-gateway/signal-store.service";
import type {
  MemberPrincipal,
  MemberReadSurfaceDecision,
} from "@/lib/member-gateway/types";

const integrationDatabaseUrl = process.env.MEMBER_SIGNAL_CANDIDATE_DATABASE_URL;
const describeMysql = integrationDatabaseUrl ? describe.sequential : describe.skip;
const suffix = `${process.pid}-${Date.now()}`;

const ALLOWED_SURFACE: MemberReadSurfaceDecision = {
  allowed: true,
  deniedDimensions: [],
};

const POLICY_REF = "signal-candidate-policy-1";
const POLICY_VERSION = 1;

describeMysql(
  "member work signal candidate slice with an isolated MySQL database",
  () => {
    let workspaceId = "";
    let ownerUserId = "";
    let memberUserId = "";
    let signalCounter = 0;

    beforeAll(async () => {
      if (process.env.DATABASE_URL !== integrationDatabaseUrl) {
        throw new Error(
          "DATABASE_URL must equal MEMBER_SIGNAL_CANDIDATE_DATABASE_URL for the isolated integration test.",
        );
      }
      const workspace = await db.workspace.create({
        data: {
          name: `Member signal candidate integration ${suffix}`,
          slug: `member-signal-candidate-integration-${suffix}`,
        },
      });
      workspaceId = workspace.id;

      const owner = await db.user.create({
        data: {
          email: `member-signal-candidate-owner-${suffix}@example.com`,
          name: "Member signal candidate owner",
        },
      });
      ownerUserId = owner.id;
      await db.membership.create({
        data: {
          workspaceId,
          userId: ownerUserId,
          role: WorkspaceRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      });

      // MEMBER role: WORKSPACE_CAPABILITIES matrix maps MEMBER to an empty
      // capability set (lib/auth/authorization.ts), so this fixture is
      // structural proof, not a mock, of ruling 6's "members cannot review
      // or promote their own signals" claim.
      const member = await db.user.create({
        data: {
          email: `member-signal-candidate-member-${suffix}@example.com`,
          name: "Member signal candidate member",
        },
      });
      memberUserId = member.id;
      await db.membership.create({
        data: {
          workspaceId,
          userId: memberUserId,
          role: WorkspaceRole.MEMBER,
          status: MembershipStatus.ACTIVE,
        },
      });
    });

    afterAll(async () => {
      // This suite targets a disposable, suffix-guarded database.
      // MemberWorkSignalReceipt rows are append-only (blocked by database
      // triggers); ArtifactBundle/ArtifactReview/ActionItem/ApprovalTask
      // rows this suite creates carry no such trigger, but the workspace
      // row cannot be deleted while the signal receipt/challenge rows
      // still reference it (onDelete: Restrict on those tables), so
      // teardown only disconnects, same as every other member-gateway
      // isolated-MySQL suite.
      await db.$disconnect();
    });

    function principal(
      overrides: Partial<MemberPrincipal> = {},
    ): MemberPrincipal {
      return {
        workspaceRef: workspaceId,
        memberRef: `member-${suffix}`,
        sessionRef: `session-${suffix}`,
        deviceRegistrationRef: `device-${suffix}`,
        clientId: "workbuddy-desktop",
        ...overrides,
      };
    }

    function payload(
      overrides: Partial<MemberWorkSignalPayload> = {},
    ): MemberWorkSignalPayload {
      return {
        kind: "progress",
        summary: "客户已确认还款意向",
        detail: "电话沟通 20 分钟,确认周五前处理。",
        relatedEvidenceRefs: [],
        ...overrides,
      };
    }

    // Issues + submits a fresh, always-uniquely-scoped signal receipt.
    async function createSignalReceipt(input: {
      payloadOverrides?: Partial<MemberWorkSignalPayload>;
      evidenceSurfaces?: ReadonlyMap<string, MemberReadSurfaceDecision>;
      objectRef?: string;
      supersedesReceiptRef?: string | null;
    } = {}): Promise<{ receiptId: string; objectRef: string }> {
      signalCounter += 1;
      const objectRef = input.objectRef ?? `candidate-case-${suffix}-${signalCounter}`;
      const draft: MemberWorkSignalDraft = {
        principal: principal(),
        objectRef,
        objectVersion: 1,
        payload: payload(input.payloadOverrides),
      };
      const challenge = await issueMemberWorkSignalChallenge({
        draft,
        ttlMs: 60_000,
      });
      const receiptId = `candidate-receipt-${suffix}-${signalCounter}`;
      const result = await submitMemberWorkSignal({
        principal: draft.principal,
        challengeRef: challenge.challengeRef,
        payload: draft.payload,
        surface: ALLOWED_SURFACE,
        evidenceSurfaces: input.evidenceSurfaces ?? new Map(),
        policyRef: POLICY_REF,
        policyVersion: POLICY_VERSION,
        receiptId,
        supersedesReceiptRef: input.supersedesReceiptRef ?? null,
      });
      return { receiptId: result.receipt.receiptId, objectRef };
    }

    function unresolvedAnchor(objectRef: string): MemberSignalCandidateObjectAnchor {
      return { resolved: false, objectRef, objectVersion: 1 };
    }

    async function materializeFreshCandidate(input: {
      payloadOverrides?: Partial<MemberWorkSignalPayload>;
      evidenceSurfaces?: ReadonlyMap<string, MemberReadSurfaceDecision>;
    } = {}) {
      const { receiptId, objectRef } = await createSignalReceipt({
        payloadOverrides: input.payloadOverrides,
        evidenceSurfaces: input.evidenceSurfaces,
      });
      const materialized = await materializeMemberWorkSignalCandidate({
        workspaceId,
        signalReceiptId: receiptId,
        objectAnchor: unresolvedAnchor(objectRef),
      });
      return { receiptId, objectRef, ...materialized };
    }

    async function loadStoredArtifact(
      artifactBundleId: string,
    ): Promise<MemberWorkSignalCandidateArtifact> {
      const bundle = await db.artifactBundle.findUniqueOrThrow({
        where: { id: artifactBundleId },
      });
      return JSON.parse(bundle.artifactsJson) as MemberWorkSignalCandidateArtifact;
    }

    async function expectMaterializeError(
      promise: Promise<unknown>,
      message: string,
    ): Promise<void> {
      await expect(promise).rejects.toBeInstanceOf(MemberSignalCandidateError);
      await promise.catch((error: unknown) => {
        expect(error).toBeInstanceOf(MemberSignalCandidateError);
        expect((error as MemberSignalCandidateError).message).toContain(message);
      });
    }

    async function expectReviewError(
      promise: Promise<unknown>,
      code: string,
    ): Promise<void> {
      await expect(promise).rejects.toBeInstanceOf(MemberSignalCandidateReviewError);
      await promise.catch((error: unknown) => {
        expect(error).toBeInstanceOf(MemberSignalCandidateReviewError);
        expect((error as MemberSignalCandidateReviewError).code).toBe(code);
      });
    }

    describe("materialization", () => {
      it("materializes a fresh signal into a DRAFT/PENDING candidate with an audit row", async () => {
        const { receiptId, artifactBundleId, artifactReviewId, reused } =
          await materializeFreshCandidate();
        expect(reused).toBe(false);

        const bundle = await db.artifactBundle.findUniqueOrThrow({
          where: { id: artifactBundleId },
        });
        expect(bundle.artifactType).toBe(MEMBER_SIGNAL_CANDIDATE_ARTIFACT_TYPE);
        expect(bundle.reviewPosture).toBe(MEMBER_SIGNAL_CANDIDATE_REVIEW_POSTURE);
        expect(bundle.status).toBe(ArtifactBundleStatus.DRAFT);
        expect(bundle.systemOfRecordWrite).toBe(false);
        const provenance = JSON.parse(bundle.sourceProvenance ?? "null") as {
          taint: string;
        };
        expect(provenance.taint).toBe("untrusted");

        const review = await db.artifactReview.findUniqueOrThrow({
          where: { id: artifactReviewId },
        });
        expect(review.status).toBe(ArtifactReviewStatus.PENDING);
        expect(review.artifactBundleId).toBe(artifactBundleId);

        const audit = await db.auditLog.findFirst({
          where: {
            workspaceId,
            actionType: "MEMBER_WORK_SIGNAL_CANDIDATE_MATERIALIZED",
            targetType: "ArtifactBundle",
            targetId: artifactBundleId,
          },
        });
        expect(audit).not.toBeNull();

        const artifact = await loadStoredArtifact(artifactBundleId);
        expect(artifact.signalReceiptRef).toBe(receiptId);
        expect(validateMemberWorkSignalCandidateArtifact(artifact)).toEqual({
          valid: true,
          errors: [],
        });
      });

      it("is idempotent: re-materializing the same signal returns reused:true with the same ids", async () => {
        const { receiptId, objectRef, artifactBundleId, artifactReviewId } =
          await materializeFreshCandidate();

        const second = await materializeMemberWorkSignalCandidate({
          workspaceId,
          signalReceiptId: receiptId,
          objectAnchor: unresolvedAnchor(objectRef),
        });
        expect(second.reused).toBe(true);
        expect(second.artifactBundleId).toBe(artifactBundleId);
        expect(second.artifactReviewId).toBe(artifactReviewId);
      });

      it("rejects a drifted stored artifact as a conflict rather than silently reusing it", async () => {
        const { receiptId, objectRef, artifactBundleId } =
          await materializeFreshCandidate({
            payloadOverrides: { kind: "progress" },
          });

        // Tweak the stored artifactsJson so it no longer byte-matches the
        // deterministic recomputation from the (immutable) receipt row.
        await db.$executeRaw`
          UPDATE ArtifactBundle
          SET artifactsJson = REPLACE(artifactsJson, '"kind":"progress"', '"kind":"blocker"')
          WHERE id = ${artifactBundleId}
        `;

        await expectMaterializeError(
          materializeMemberWorkSignalCandidate({
            workspaceId,
            signalReceiptId: receiptId,
            objectAnchor: unresolvedAnchor(objectRef),
          }),
          "existing_candidate_conflict",
        );
      });

      it("refuses to materialize a signal receipt that has been superseded", async () => {
        const { receiptId: priorReceiptId, objectRef } = await createSignalReceipt();
        await createSignalReceipt({
          objectRef,
          payloadOverrides: { summary: "更正:客户已还清欠款" },
          supersedesReceiptRef: priorReceiptId,
        });

        await expectMaterializeError(
          materializeMemberWorkSignalCandidate({
            workspaceId,
            signalReceiptId: priorReceiptId,
            objectAnchor: unresolvedAnchor(objectRef),
          }),
          "signal_receipt_superseded",
        );
      });

      it("de-links mixed-case URLs from the candidate body and numbers linkEvidence across fields", async () => {
        const { artifactBundleId } = await materializeFreshCandidate({
          payloadOverrides: {
            summary: "详情见 HTTPS://Example.com/case/42",
            detail: "补充材料 http://b.example.com/more 和 HTTP://c.example.com/more2",
          },
        });

        const artifact = await loadStoredArtifact(artifactBundleId);
        expect(artifact.projectedSummary).not.toMatch(/https?:\/\//i);
        expect(artifact.projectedDetail).not.toMatch(/https?:\/\//i);
        expect(artifact.linkEvidence).toHaveLength(3);
        expect(artifact.linkEvidence.map((entry) => entry.token)).toEqual([
          "[link-evidence:1]",
          "[link-evidence:2]",
          "[link-evidence:3]",
        ]);
        const body = `${artifact.projectedSummary}\n${artifact.projectedDetail}`;
        for (const entry of artifact.linkEvidence) {
          expect(body).toContain(entry.token);
          expect(entry.evidenceRef).toContain(artifact.signalReceiptRef);
        }
      });

      it("rejects credential-style text in the candidate body via the contract-layer scan", async () => {
        // A credential-style string inside summary/detail is caught by
        // Task 1's contract validator (candidate_body_link_bearing) BEFORE
        // the materializer's own full-artifact safety scan ever runs —
        // both layers share the same private persistable-text pattern, and
        // the narrower body-only check fires first. This is the expected,
        // and stricter, outcome: the candidate is still rejected.
        const { receiptId, objectRef } = await createSignalReceipt({
          payloadOverrides: { detail: "password: hunter2" },
        });
        await expect(
          materializeMemberWorkSignalCandidate({
            workspaceId,
            signalReceiptId: receiptId,
            objectAnchor: unresolvedAnchor(objectRef),
          }),
        ).rejects.toMatchObject({
          message: expect.stringContaining("candidate_artifact_invalid"),
          reasons: expect.arrayContaining(["candidate_body_link_bearing"]),
        });
      });

      it("rejects credential-style text outside the body via the materializer's own full-artifact scan", async () => {
        // relatedEvidenceRefs content is opaque to the Task 1 contract
        // validator (it only checks refs are non-blank) — this is exactly
        // the text surface the materializer's fourth private regex copy
        // exists to cover, scanning the FULL serialized artifact rather
        // than just summary/detail.
        const evidenceRef = "password: hunter2";
        const { receiptId, objectRef } = await createSignalReceipt({
          payloadOverrides: { relatedEvidenceRefs: [evidenceRef] },
          evidenceSurfaces: new Map([[evidenceRef, ALLOWED_SURFACE]]),
        });
        await expectMaterializeError(
          materializeMemberWorkSignalCandidate({
            workspaceId,
            signalReceiptId: receiptId,
            objectAnchor: unresolvedAnchor(objectRef),
          }),
          "unsafe_candidate_text",
        );
      });
    });

    describe("review", () => {
      it("confirms a candidate: bundle CONFIRMED, review CONFIRMED with reviewer fields", async () => {
        const { artifactBundleId, artifactReviewId } = await materializeFreshCandidate();

        const result = await reviewMemberWorkSignalCandidate({
          workspaceId,
          reviewerId: ownerUserId,
          reviewerName: "Owner",
          artifactBundleId,
          decision: "confirm",
        });
        expect(result.reviewStatus).toBe(ArtifactReviewStatus.CONFIRMED);

        const bundle = await db.artifactBundle.findUniqueOrThrow({
          where: { id: artifactBundleId },
        });
        expect(bundle.status).toBe(ArtifactBundleStatus.CONFIRMED);
        expect(bundle.confirmedAt).not.toBeNull();

        const review = await db.artifactReview.findUniqueOrThrow({
          where: { id: artifactReviewId },
        });
        expect(review.status).toBe(ArtifactReviewStatus.CONFIRMED);
        expect(review.reviewedByUserId).toBe(ownerUserId);
        expect(review.reviewedAt).not.toBeNull();
      });

      it("rejects a fresh candidate: both bundle and review REJECTED", async () => {
        const { artifactBundleId, artifactReviewId } = await materializeFreshCandidate();

        const result = await reviewMemberWorkSignalCandidate({
          workspaceId,
          reviewerId: ownerUserId,
          reviewerName: "Owner",
          artifactBundleId,
          decision: "reject",
        });
        expect(result.reviewStatus).toBe(ArtifactReviewStatus.REJECTED);

        const bundle = await db.artifactBundle.findUniqueOrThrow({
          where: { id: artifactBundleId },
        });
        expect(bundle.status).toBe(ArtifactBundleStatus.REJECTED);
        expect(bundle.confirmedAt).toBeNull();

        const review = await db.artifactReview.findUniqueOrThrow({
          where: { id: artifactReviewId },
        });
        expect(review.status).toBe(ArtifactReviewStatus.REJECTED);
        expect(review.reviewedByUserId).toBe(ownerUserId);
      });

      it("treats a bundle of a different artifact type as not found", async () => {
        const bundle = await db.artifactBundle.create({
          data: {
            workspaceId,
            artifactType: "some_other_artifact_type.json",
            title: "Not a member signal candidate",
            status: ArtifactBundleStatus.DRAFT,
            systemOfRecordWrite: false,
            artifactsJson: "{}",
            reviewPosture: "some_other_review_required",
          },
        });
        await db.artifactReview.create({
          data: {
            workspaceId,
            artifactBundleId: bundle.id,
            status: ArtifactReviewStatus.PENDING,
          },
        });

        await expectReviewError(
          reviewMemberWorkSignalCandidate({
            workspaceId,
            reviewerId: ownerUserId,
            reviewerName: "Owner",
            artifactBundleId: bundle.id,
            decision: "confirm",
          }),
          "candidate_not_found",
        );
      });

      it("rejects a corrupt stored artifact (tampered taint) as candidate_artifact_corrupt", async () => {
        const { artifactBundleId } = await materializeFreshCandidate();

        await db.$executeRaw`
          UPDATE ArtifactBundle
          SET artifactsJson = REPLACE(artifactsJson, '"taint":"untrusted"', '"taint":"tampered"')
          WHERE id = ${artifactBundleId}
        `;

        await expectReviewError(
          reviewMemberWorkSignalCandidate({
            workspaceId,
            reviewerId: ownerUserId,
            reviewerName: "Owner",
            artifactBundleId,
            decision: "confirm",
          }),
          "candidate_artifact_corrupt",
        );
      });
    });

    describe("promotion", () => {
      let confirmedBundleId = "";
      let promotedActionItemId = "";
      let promotedApprovalTaskId = "";

      it("promotes a confirmed candidate to a pending internal CREATE_TASK approval", async () => {
        const { artifactBundleId } = await materializeFreshCandidate();
        await reviewMemberWorkSignalCandidate({
          workspaceId,
          reviewerId: ownerUserId,
          reviewerName: "Owner",
          artifactBundleId,
          decision: "confirm",
        });
        confirmedBundleId = artifactBundleId;

        const result = await promoteMemberWorkSignalCandidateToTask({
          workspaceId,
          actorUserId: ownerUserId,
          actorName: "Owner",
          artifactBundleId,
          title: "Follow up on member signal",
          description: "Promoted from a confirmed member work-signal candidate.",
        });
        expect(result.reused).toBe(false);
        promotedActionItemId = result.actionItemId;
        promotedApprovalTaskId = result.approvalTaskId;

        const action = await db.actionItem.findUniqueOrThrow({
          where: { id: result.actionItemId },
        });
        expect(action.sourceId).toBe(
          `member-signal-candidate-artifact:${artifactBundleId}`,
        );
        expect(action.sourceType).toBe(SourceType.SYSTEM_INFERENCE);
        expect(action.actionType).toBe(ActionType.CREATE_TASK);
        expect(action.contentAuthorship).toBe(ActorType.USER);
        expect(action.requiresApproval).toBe(true);

        const approvalTask = await db.approvalTask.findUniqueOrThrow({
          where: { id: result.approvalTaskId },
        });
        expect(approvalTask.actionItemId).toBe(result.actionItemId);
        expect(approvalTask.status).toBe(ApprovalStatus.PENDING);
        expect(approvalTask.isHighRisk).toBe(false);
        expect(approvalTask.autoExecute).toBe(false);

        const bundle = await db.artifactBundle.findUniqueOrThrow({
          where: { id: artifactBundleId },
        });
        expect(bundle.status).toBe(ArtifactBundleStatus.CONSUMED);
        expect(bundle.consumedAt).not.toBeNull();
      });

      it("rejects promotion of a candidate that has not been confirmed", async () => {
        const { artifactBundleId } = await materializeFreshCandidate();

        await expectReviewError(
          promoteMemberWorkSignalCandidateToTask({
            workspaceId,
            actorUserId: ownerUserId,
            actorName: "Owner",
            artifactBundleId,
            title: "Should not promote",
          }),
          "candidate_promotion_requires_confirmation",
        );
      });

      it("replays the same promotion idempotently on a second call", async () => {
        expect(confirmedBundleId).not.toBe("");
        const second = await promoteMemberWorkSignalCandidateToTask({
          workspaceId,
          actorUserId: ownerUserId,
          actorName: "Owner",
          artifactBundleId: confirmedBundleId,
          title: "Follow up on member signal (replay)",
        });
        expect(second.reused).toBe(true);
        expect(second.actionItemId).toBe(promotedActionItemId);
        expect(second.approvalTaskId).toBe(promotedApprovalTaskId);
      });
    });

    describe("capability gate", () => {
      it("rejects a MEMBER-role caller reviewing a candidate", async () => {
        const { artifactBundleId } = await materializeFreshCandidate();

        await expect(
          reviewMemberWorkSignalCandidate({
            workspaceId,
            reviewerId: memberUserId,
            reviewerName: "Member",
            artifactBundleId,
            decision: "confirm",
          }),
        ).rejects.toBeInstanceOf(WorkspaceServiceGovernanceError);
      });

      it("rejects a MEMBER-role caller promoting a candidate", async () => {
        const { artifactBundleId } = await materializeFreshCandidate();
        await reviewMemberWorkSignalCandidate({
          workspaceId,
          reviewerId: ownerUserId,
          reviewerName: "Owner",
          artifactBundleId,
          decision: "confirm",
        });

        await expect(
          promoteMemberWorkSignalCandidateToTask({
            workspaceId,
            actorUserId: memberUserId,
            actorName: "Member",
            artifactBundleId,
            title: "Member cannot promote their own signal",
          }),
        ).rejects.toBeInstanceOf(WorkspaceServiceGovernanceError);
      });
    });
  },
);

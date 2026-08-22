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
  RuntimeMemoryCandidateStatus,
  SourceType,
  WorkspaceRole,
} from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { WorkspaceServiceGovernanceError } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import type { MemberWorkSignalPayload, MemberWorkSignalDraft } from "@/lib/member-gateway/signal";
import {
  MemberSignalCandidateError,
  materializeMemberWorkSignalCandidate,
} from "@/lib/member-gateway/signal-candidate-materializer";
import {
  MemberSignalMemoryProjectionError,
  projectConfirmedMemberSignalCandidateToMemoryCandidate,
} from "@/lib/member-gateway/signal-candidate-memory-projection.service";
import {
  MemberSignalMemoryVerificationError,
  verifyMemberSignalMemoryCandidate,
} from "@/lib/member-gateway/signal-candidate-memory-verification.service";
import {
  MemberSignalCandidateReviewError,
  promoteMemberWorkSignalCandidateToTask,
  reviewMemberWorkSignalCandidate,
} from "@/lib/member-gateway/signal-candidate-review.service";
import {
  MemberEvidenceProjectionError,
  projectCandidateEvidenceForReviewer,
  resetMemberEvidenceAuthorizationResolverForTests,
} from "@/lib/member-gateway/reviewer-evidence-projection.service";
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
// base36 breaks pure-digit runs: pid-decimal-timestamp suffixes occasionally
// Luhn-pass as bank-card shapes under the member-authored-text PII scan.
const suffix = `${process.pid.toString(36)}-${Date.now().toString(36)}`;

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
    let runtimeAnchoredFixtureCounter = 0;

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

    // A resolved anchor whose objectType is a real, whitelisted Prisma
    // ObjectType member (e.g. "CONTACT") — used by the memory
    // member-fact-write suite below to prove verifyMemberSignalMemoryCandidate
    // carries a resolved anchor through onto the written MemoryItem's typed
    // objectType/objectId columns.
    function resolvedAnchor(
      objectType: string,
    ): (objectRef: string) => MemberSignalCandidateObjectAnchor {
      return (objectRef) => ({
        resolved: true,
        objectType,
        objectId: `resolved-object-${objectRef}`,
      });
    }

    async function materializeFreshCandidate(input: {
      payloadOverrides?: Partial<MemberWorkSignalPayload>;
      evidenceSurfaces?: ReadonlyMap<string, MemberReadSurfaceDecision>;
      objectAnchor?: (objectRef: string) => MemberSignalCandidateObjectAnchor;
    } = {}) {
      const { receiptId, objectRef } = await createSignalReceipt({
        payloadOverrides: input.payloadOverrides,
        evidenceSurfaces: input.evidenceSurfaces,
      });
      const buildAnchor = input.objectAnchor ?? unresolvedAnchor;
      const materialized = await materializeMemberWorkSignalCandidate({
        workspaceId,
        signalReceiptId: receiptId,
        objectAnchor: buildAnchor(objectRef),
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

    async function expectEvidenceProjectionError(
      promise: Promise<unknown>,
      code: string,
    ): Promise<void> {
      await expect(promise).rejects.toBeInstanceOf(MemberEvidenceProjectionError);
      await promise.catch((error: unknown) => {
        expect(error).toBeInstanceOf(MemberEvidenceProjectionError);
        expect((error as MemberEvidenceProjectionError).code).toBe(code);
      });
    }

    async function expectProjectionError(
      promise: Promise<unknown>,
      code: string,
    ): Promise<void> {
      await expect(promise).rejects.toBeInstanceOf(
        MemberSignalMemoryProjectionError,
      );
      await promise.catch((error: unknown) => {
        expect(error).toBeInstanceOf(MemberSignalMemoryProjectionError);
        expect((error as MemberSignalMemoryProjectionError).code).toBe(code);
      });
    }

    // M2d Task 3: materializes, confirms, and returns the confirmed
    // candidate's gatewaySessionRef (stamped at signal-issuance time by
    // M2d Task 2) so projection tests can assert the anchor is copied
    // through unchanged.
    async function materializeAndConfirmCandidate(
      input: {
        payloadOverrides?: Partial<MemberWorkSignalPayload>;
        evidenceSurfaces?: ReadonlyMap<string, MemberReadSurfaceDecision>;
        objectAnchor?: (objectRef: string) => MemberSignalCandidateObjectAnchor;
      } = {},
    ) {
      const { receiptId, objectRef, artifactBundleId, artifactReviewId } =
        await materializeFreshCandidate(input);
      await reviewMemberWorkSignalCandidate({
        workspaceId,
        reviewerId: ownerUserId,
        reviewerName: "Owner",
        artifactBundleId,
        decision: "confirm",
      });
      const receiptRow = await db.memberWorkSignalReceipt.findUniqueOrThrow({
        where: { id: receiptId },
      });
      if (!receiptRow.gatewaySessionRef) {
        throw new Error(
          "expected a freshly-issued signal receipt to carry a gatewaySessionRef",
        );
      }
      return {
        receiptId,
        objectRef,
        artifactBundleId,
        artifactReviewId,
        gatewaySessionRef: receiptRow.gatewaySessionRef,
      };
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
        // Task 1's contract validator (candidate_body_unsafe_text) BEFORE
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
          reasons: expect.arrayContaining(["candidate_body_unsafe_text"]),
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

    describe("supersession re-check at review time", () => {
      it("rejects reviewing a candidate whose signal has since been superseded, but the correction's own candidate reviews fine", async () => {
        const { receiptId: priorReceiptId, objectRef } = await createSignalReceipt();
        const staleCandidate = await materializeMemberWorkSignalCandidate({
          workspaceId,
          signalReceiptId: priorReceiptId,
          objectAnchor: unresolvedAnchor(objectRef),
        });

        // Supersede the prior signal via the signal store (a member
        // correction), landing AFTER the stale candidate was already
        // materialized.
        const { receiptId: correctionReceiptId } = await createSignalReceipt({
          objectRef,
          payloadOverrides: { summary: "更正:客户已还清欠款" },
          supersedesReceiptRef: priorReceiptId,
        });

        await expectReviewError(
          reviewMemberWorkSignalCandidate({
            workspaceId,
            reviewerId: ownerUserId,
            reviewerName: "Owner",
            artifactBundleId: staleCandidate.artifactBundleId,
            decision: "confirm",
          }),
          "signal_receipt_superseded",
        );

        // The correction's own candidate — a separate ArtifactBundle
        // materialized off the correction receipt — is the reviewable
        // head and must materialize and review normally.
        const correctionCandidate = await materializeMemberWorkSignalCandidate({
          workspaceId,
          signalReceiptId: correctionReceiptId,
          objectAnchor: unresolvedAnchor(objectRef),
        });
        const result = await reviewMemberWorkSignalCandidate({
          workspaceId,
          reviewerId: ownerUserId,
          reviewerName: "Owner",
          artifactBundleId: correctionCandidate.artifactBundleId,
          decision: "confirm",
        });
        expect(result.reviewStatus).toBe(ArtifactReviewStatus.CONFIRMED);
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

      it("rejects a too-long title with a typed error rather than a raw MySQL column-width failure", async () => {
        const { artifactBundleId } = await materializeFreshCandidate();
        await reviewMemberWorkSignalCandidate({
          workspaceId,
          reviewerId: ownerUserId,
          reviewerName: "Owner",
          artifactBundleId,
          decision: "confirm",
        });

        // 176 chars: one over MEMBER_SIGNAL_CANDIDATE_PROMOTION_TITLE_MAX_CHARS
        // (175) — the tightest consumer is the 191-char
        // Notification.title literal `Pending review: ${title}` (16
        // chars of fixed prefix). Un-bounded, this used to reach Prisma
        // and fail as a raw P2000 "value too long" error; it must now be
        // rejected by typed input validation before any write is
        // attempted.
        const tooLongTitle = "T".repeat(176);
        await expectReviewError(
          promoteMemberWorkSignalCandidateToTask({
            workspaceId,
            actorUserId: ownerUserId,
            actorName: "Owner",
            artifactBundleId,
            title: tooLongTitle,
          }),
          "promotion_title_too_long",
        );

        // No partial write: the bundle must still be CONFIRMED, not
        // CONSUMED — the length check runs before the CAS transaction.
        const bundle = await db.artifactBundle.findUniqueOrThrow({
          where: { id: artifactBundleId },
        });
        expect(bundle.status).toBe(ArtifactBundleStatus.CONFIRMED);
      });

      it("rejects a too-long description with a typed error", async () => {
        const { artifactBundleId } = await materializeFreshCandidate();
        await reviewMemberWorkSignalCandidate({
          workspaceId,
          reviewerId: ownerUserId,
          reviewerName: "Owner",
          artifactBundleId,
          decision: "confirm",
        });

        // 192 chars: one over the 191-char VARCHAR cap shared by
        // ActionItem.description/draftContent and ApprovalTask.
        // contextSnapshot/editableContent.
        const tooLongDescription = "D".repeat(192);
        await expectReviewError(
          promoteMemberWorkSignalCandidateToTask({
            workspaceId,
            actorUserId: ownerUserId,
            actorName: "Owner",
            artifactBundleId,
            title: "Valid title",
            description: tooLongDescription,
          }),
          "promotion_description_too_long",
        );
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

    // T3 (docs/superpowers/plans/2026-08-20-member-gateway-reviewer-evidence
    // -projection.md): DB-bound coverage for projectCandidateEvidenceForReviewer
    // — capability gate, candidate loading/membership checks, and the audit
    // row. The judgment/whitelist/envelope-validation composition itself is
    // already covered db-free in reviewer-evidence-projection.test.ts against
    // synthetic resolvers; this suite only exercises the paths that need a
    // real database.
    describe("reviewer evidence projection", () => {
      afterEach(() => {
        resetMemberEvidenceAuthorizationResolverForTests();
      });

      it("default resolver: blocks with read_surface_denied, 7 deniedDimensions, and an audit row with no field values", async () => {
        const evidenceRef = `evidence:case-${suffix}-1`;
        const { artifactBundleId } = await materializeFreshCandidate({
          payloadOverrides: { relatedEvidenceRefs: [evidenceRef] },
          evidenceSurfaces: new Map([[evidenceRef, ALLOWED_SURFACE]]),
        });

        const { envelope, deniedDimensions } =
          await projectCandidateEvidenceForReviewer({
            workspaceId,
            reviewerUserId: ownerUserId,
            artifactBundleId,
            evidenceRef,
          });

        expect(envelope.ok).toBe(true);
        expect(envelope.data).toBeNull();
        expect(envelope.boundary.decision.projection).toBeNull();
        expect(envelope.boundary.decision.blockReason).toBe(
          "read_surface_denied",
        );
        expect(deniedDimensions).toEqual([
          "live_membership",
          "tool_scope",
          "object_relationship_authorization",
          "field_purpose_policy",
          "source_authorization",
          "tenant_provider_egress_policy",
          "current_classification",
        ]);

        const audit = await db.auditLog.findFirst({
          where: {
            workspaceId,
            actionType: "MEMBER_SIGNAL_EVIDENCE_PROJECTION_REQUESTED",
            targetType: "ArtifactBundle",
            targetId: artifactBundleId,
          },
        });
        expect(audit).not.toBeNull();
        expect(audit?.userId).toBe(ownerUserId);
        const payload = JSON.parse(audit?.payload ?? "null") as {
          evidenceRef: string;
          projection: string | null;
          blockReason: string | null;
          deniedDimensions: readonly string[];
        };
        expect(payload.evidenceRef).toBe(evidenceRef);
        expect(payload.projection).toBeNull();
        expect(payload.blockReason).toBe("read_surface_denied");
        expect(payload.deniedDimensions).toHaveLength(7);
        // No field VALUES are ever audited — only the identifier and the
        // judgment outcome.
        expect(Object.keys(payload).sort()).toEqual([
          "blockReason",
          "deniedDimensions",
          "evidenceRef",
          "projection",
        ]);
      });

      it("rejects an evidenceRef that does not belong to the candidate", async () => {
        const { artifactBundleId } = await materializeFreshCandidate();

        await expectEvidenceProjectionError(
          projectCandidateEvidenceForReviewer({
            workspaceId,
            reviewerUserId: ownerUserId,
            artifactBundleId,
            evidenceRef: `evidence:not-in-candidate-${suffix}`,
          }),
          "evidence_ref_not_in_candidate",
        );
      });

      it("rejects a bogus artifactBundleId as candidate_not_found", async () => {
        await expectEvidenceProjectionError(
          projectCandidateEvidenceForReviewer({
            workspaceId,
            reviewerUserId: ownerUserId,
            artifactBundleId: `member-signal-candidate:bogus-${suffix}`,
            evidenceRef: `evidence:case-${suffix}-bogus`,
          }),
          "candidate_not_found",
        );
      });

      it("rejects a MEMBER-role reviewer with a capability error, not a projection decision", async () => {
        const evidenceRef = `evidence:case-${suffix}-member`;
        const { artifactBundleId } = await materializeFreshCandidate({
          payloadOverrides: { relatedEvidenceRefs: [evidenceRef] },
          evidenceSurfaces: new Map([[evidenceRef, ALLOWED_SURFACE]]),
        });

        await expect(
          projectCandidateEvidenceForReviewer({
            workspaceId,
            reviewerUserId: memberUserId,
            artifactBundleId,
            evidenceRef,
          }),
        ).rejects.toBeInstanceOf(WorkspaceServiceGovernanceError);
      });

      it("accepts a linkEvidence-derived evidenceRef (still default-denied)", async () => {
        const { artifactBundleId } = await materializeFreshCandidate({
          payloadOverrides: {
            detail: "补充材料见 https://example.com/case/evidence-link",
          },
        });
        const artifact = await loadStoredArtifact(artifactBundleId);
        expect(artifact.linkEvidence).toHaveLength(1);
        const linkEvidenceRef = artifact.linkEvidence[0]?.evidenceRef;
        expect(linkEvidenceRef).toBeDefined();

        const { envelope, deniedDimensions } =
          await projectCandidateEvidenceForReviewer({
            workspaceId,
            reviewerUserId: ownerUserId,
            artifactBundleId,
            evidenceRef: linkEvidenceRef as string,
          });

        // Accepted for projection (no evidence_ref_not_in_candidate) —
        // still denied by the default fail-closed resolver, not by the
        // membership check.
        expect(envelope.boundary.decision.blockReason).toBe(
          "read_surface_denied",
        );
        expect(deniedDimensions).toHaveLength(7);
      });
    });

    // M2d Task 3 (docs/superpowers/plans/2026-08-20-member-gateway-m2d
    // -fact-promotion.md): projectConfirmedMemberSignalCandidateToMemory
    // Candidate — session-anchored stage-two fact promotion of a CONFIRMED
    // member signal candidate into a PENDING_VERIFICATION MemoryCandidate.
    describe("memory projection", () => {
      it("projects a confirmed candidate into a session-anchored PENDING_VERIFICATION MemoryCandidate with taint/evaluationUseProhibited/provenance and an audit row", async () => {
        const confirmed = await materializeAndConfirmCandidate();

        const result =
          await projectConfirmedMemberSignalCandidateToMemoryCandidate({
            workspaceId,
            actorUserId: ownerUserId,
            actorName: "Owner",
            artifactBundleId: confirmed.artifactBundleId,
          });
        expect(result.reused).toBe(false);
        expect(result.receipt.candidateStatus).toBe("pending_verification");
        expect(result.receipt.memoryPromotionCreated).toBe(false);
        expect(result.receipt.canonicalMemoryWritten).toBe(false);
        expect(result.receipt.memberGatewaySessionRef).toBe(
          confirmed.gatewaySessionRef,
        );
        expect(result.receipt.sourceArtifactBundleId).toBe(
          confirmed.artifactBundleId,
        );
        expect(result.receipt.sourceArtifactReviewId).toBe(
          confirmed.artifactReviewId,
        );

        const row = await db.memoryCandidate.findUniqueOrThrow({
          where: { id: result.receipt.memoryCandidateId },
        });
        expect(row.memberGatewaySessionRef).toBe(confirmed.gatewaySessionRef);
        expect(row.runtimeSessionId).toBeNull();
        expect(row.status).toBe(RuntimeMemoryCandidateStatus.PENDING_VERIFICATION);
        expect(row.artifactBundleId).toBe(confirmed.artifactBundleId);
        expect(row.candidateKey).toBe(result.receipt.memoryCandidateKey);

        const sourceStatus = JSON.parse(row.sourceStatus) as {
          taint: string;
          evaluationUseProhibited: boolean;
          candidateStatus: string;
          officialMemoryPromotionAllowed: boolean;
          provenance: {
            memberRef: string;
            deviceRegistrationRef: string;
            clientId: string;
            policyRef: string;
            policyVersion: number;
            signalReceiptRef: string;
            gatewaySessionRef: string;
          };
        };
        expect(sourceStatus.taint).toBe("untrusted");
        expect(sourceStatus.evaluationUseProhibited).toBe(true);
        expect(sourceStatus.candidateStatus).toBe("pending_verification");
        expect(sourceStatus.officialMemoryPromotionAllowed).toBe(false);
        expect(sourceStatus.provenance.signalReceiptRef).toBe(
          confirmed.receiptId,
        );
        expect(sourceStatus.provenance.gatewaySessionRef).toBe(
          confirmed.gatewaySessionRef,
        );
        expect(sourceStatus.provenance.memberRef).toBe(`member-${suffix}`);

        const sourceVerification = JSON.parse(row.sourceVerification) as {
          artifactReviewId: string;
          reviewedByUserId: string;
          reviewStatus: string;
        };
        expect(sourceVerification.artifactReviewId).toBe(
          confirmed.artifactReviewId,
        );
        expect(sourceVerification.reviewedByUserId).toBe(ownerUserId);
        expect(sourceVerification.reviewStatus).toBe("CONFIRMED");

        const audit = await db.auditLog.findFirst({
          where: {
            workspaceId,
            actionType: "MEMBER_SIGNAL_MEMORY_CANDIDATE_PROJECTED",
            targetType: "MemoryCandidate",
            targetId: row.id,
          },
        });
        expect(audit).not.toBeNull();
        const auditPayload = JSON.parse(audit?.payload ?? "null") as {
          memoryPromotionCreated: boolean;
          canonicalMemoryWritten: boolean;
        };
        expect(auditPayload.memoryPromotionCreated).toBe(false);
        expect(auditPayload.canonicalMemoryWritten).toBe(false);
      });

      it("is idempotent: a second projection call reuses the same MemoryCandidate row", async () => {
        const confirmed = await materializeAndConfirmCandidate();

        const first =
          await projectConfirmedMemberSignalCandidateToMemoryCandidate({
            workspaceId,
            actorUserId: ownerUserId,
            actorName: "Owner",
            artifactBundleId: confirmed.artifactBundleId,
          });
        expect(first.reused).toBe(false);

        const second =
          await projectConfirmedMemberSignalCandidateToMemoryCandidate({
            workspaceId,
            actorUserId: ownerUserId,
            actorName: "Owner",
            artifactBundleId: confirmed.artifactBundleId,
          });
        expect(second.reused).toBe(true);
        expect(second.receipt.memoryCandidateId).toBe(
          first.receipt.memoryCandidateId,
        );
        expect(second.receipt.memoryCandidateKey).toBe(
          first.receipt.memoryCandidateKey,
        );

        const count = await db.memoryCandidate.count({
          where: { artifactBundleId: confirmed.artifactBundleId },
        });
        expect(count).toBe(1);
      });

      it("rejects projection of a candidate whose signal receipt was born anchorless (signal_receipt_without_session)", async () => {
        signalCounter += 1;
        const objectRef = `candidate-case-${suffix}-anchorless-${signalCounter}`;
        const draft: MemberWorkSignalDraft = {
          principal: principal(),
          objectRef,
          objectVersion: 1,
          payload: payload(),
        };
        const challenge = await issueMemberWorkSignalChallenge({
          draft,
          ttlMs: 60_000,
        });
        // Simulate a pre-M2d/historical receipt (Owner 裁定记录 #2:
        // historical receipts permanently do not participate in stage-two
        // fact promotion): MemberWorkSignalChallenge carries no
        // append-only trigger, so null its gatewaySessionRef BEFORE
        // submit. submitMemberWorkSignal copies the challenge's ref
        // verbatim (never re-resolves), so the receipt is born anchorless.
        await db.$executeRaw`
          UPDATE MemberWorkSignalChallenge
          SET gatewaySessionRef = NULL
          WHERE id = ${challenge.challengeRef} AND workspaceId = ${workspaceId}
        `;
        const receiptId = `candidate-receipt-${suffix}-anchorless-${signalCounter}`;
        const submitted = await submitMemberWorkSignal({
          principal: draft.principal,
          challengeRef: challenge.challengeRef,
          payload: draft.payload,
          surface: ALLOWED_SURFACE,
          evidenceSurfaces: new Map(),
          policyRef: POLICY_REF,
          policyVersion: POLICY_VERSION,
          receiptId,
        });
        expect(submitted.receipt.receiptId).toBe(receiptId);
        const receiptRow = await db.memberWorkSignalReceipt.findUniqueOrThrow(
          { where: { id: receiptId } },
        );
        expect(receiptRow.gatewaySessionRef).toBeNull();

        const materialized = await materializeMemberWorkSignalCandidate({
          workspaceId,
          signalReceiptId: receiptId,
          objectAnchor: unresolvedAnchor(objectRef),
        });
        await reviewMemberWorkSignalCandidate({
          workspaceId,
          reviewerId: ownerUserId,
          reviewerName: "Owner",
          artifactBundleId: materialized.artifactBundleId,
          decision: "confirm",
        });

        await expectProjectionError(
          projectConfirmedMemberSignalCandidateToMemoryCandidate({
            workspaceId,
            actorUserId: ownerUserId,
            actorName: "Owner",
            artifactBundleId: materialized.artifactBundleId,
          }),
          "signal_receipt_without_session",
        );
      });

      it("rejects a MEMBER-role caller", async () => {
        const confirmed = await materializeAndConfirmCandidate();

        await expect(
          projectConfirmedMemberSignalCandidateToMemoryCandidate({
            workspaceId,
            actorUserId: memberUserId,
            actorName: "Member",
            artifactBundleId: confirmed.artifactBundleId,
          }),
        ).rejects.toBeInstanceOf(WorkspaceServiceGovernanceError);
      });

      it("writes no MemoryPromotion or MemoryItem row anywhere in the projection path", async () => {
        const promotionCountBefore = await db.memoryPromotion.count();
        const itemCountBefore = await db.memoryItem.count();

        const confirmed = await materializeAndConfirmCandidate();
        await projectConfirmedMemberSignalCandidateToMemoryCandidate({
          workspaceId,
          actorUserId: ownerUserId,
          actorName: "Owner",
          artifactBundleId: confirmed.artifactBundleId,
        });

        const promotionCountAfter = await db.memoryPromotion.count();
        const itemCountAfter = await db.memoryItem.count();
        expect(promotionCountAfter).toBe(promotionCountBefore);
        expect(itemCountAfter).toBe(itemCountBefore);
      });

      it("enforces the exactly-one-anchor CHECK at the database layer for both under- and over-anchored rows", async () => {
        // Root-free DB proof: attempt raw inserts that violate
        // MemoryCandidate_anchor_check directly, bypassing the service
        // layer entirely, using the same non-privileged app DB connection
        // as every other query in this suite. The legacy
        // MemoryCandidate_runtimeSessionId_fkey FK was dropped in the M2d
        // T1 migration (required to add this CHECK — MySQL error 3823
        // otherwise), so an arbitrary non-existent runtimeSessionId value
        // is accepted by the schema; only the anchor CHECK is under test
        // here.
        const bothAnchorsId = `memcand-both-${suffix}`;
        await expect(
          db.$executeRaw`
            INSERT INTO MemoryCandidate
              (id, workspaceId, runtimeSessionId, memberGatewaySessionRef, candidateKey, summary, sourceVerification, sourceStatus, status, createdAt, updatedAt)
            VALUES
              (${bothAnchorsId}, ${workspaceId}, 'some-runtime-session', 'some-gateway-session', ${`candidateKey-both-${suffix}`}, 'summary', '{}', '{}', 'PENDING_VERIFICATION', NOW(3), NOW(3))
          `,
        ).rejects.toThrow(/check/iu);

        const neitherAnchorId = `memcand-neither-${suffix}`;
        await expect(
          db.$executeRaw`
            INSERT INTO MemoryCandidate
              (id, workspaceId, runtimeSessionId, memberGatewaySessionRef, candidateKey, summary, sourceVerification, sourceStatus, status, createdAt, updatedAt)
            VALUES
              (${neitherAnchorId}, ${workspaceId}, NULL, NULL, ${`candidateKey-neither-${suffix}`}, 'summary', '{}', '{}', 'PENDING_VERIFICATION', NOW(3), NOW(3))
          `,
        ).rejects.toThrow(/check/iu);

        const survivingRows = await db.memoryCandidate.findMany({
          where: { id: { in: [bothAnchorsId, neitherAnchorId] } },
        });
        expect(survivingRows).toHaveLength(0);
      });
    });

    // Memory member-fact-write slice (docs/superpowers/plans/2026-08-22
    // -memory-member-fact-write.md, Architecture 3): verifyMemberSignal
    // MemoryCandidate — a "verify" decision now BOTH confirms a
    // member-anchored (memberGatewaySessionRef non-null) MemoryCandidate as
    // a genuine signal AND writes a permanently-tainted MemoryItem in the
    // same CAS write that flips PENDING_VERIFICATION -> PROMOTED (memory
    // ItemId backfilled). "reject" stays REJECTED with no MemoryItem. This
    // service never touches a runtimeSession-anchored (reflection-family)
    // row; acceptReflectionCandidate/dismissReflectionCandidate in
    // lib/helm-v2/runtime-upgrade.ts own that state machine exclusively.
    describe("memory verification", () => {
      async function createMemberAnchoredMemoryCandidate(
        input: {
          objectAnchor?: (objectRef: string) => MemberSignalCandidateObjectAnchor;
        } = {},
      ): Promise<{
        candidateId: string;
        artifactBundleId: string;
        objectRef: string;
      }> {
        const confirmed = await materializeAndConfirmCandidate({
          objectAnchor: input.objectAnchor,
        });
        const projected =
          await projectConfirmedMemberSignalCandidateToMemoryCandidate({
            workspaceId,
            actorUserId: ownerUserId,
            actorName: "Owner",
            artifactBundleId: confirmed.artifactBundleId,
          });
        return {
          candidateId: projected.receipt.memoryCandidateId,
          artifactBundleId: confirmed.artifactBundleId,
          objectRef: confirmed.objectRef,
        };
      }

      // A runtime-anchored (reflection-family-shaped) row, created directly
      // via db rather than through the member-gateway path, to prove
      // verifyMemberSignalMemoryCandidate refuses to touch it. Needs its
      // own RuntimeSession fixture (workspace-scoped, unique sessionKey)
      // since MemoryCandidate.runtimeSessionId has no FK enforcement under
      // relationMode=prisma but the row must still be a plausible reflection
      // candidate shape.
      async function createRuntimeAnchoredMemoryCandidate(): Promise<string> {
        runtimeAnchoredFixtureCounter += 1;
        const session = await db.runtimeSession.create({
          data: {
            workspaceId,
            sessionKey: `member-verification-runtime-session-${suffix}-${runtimeAnchoredFixtureCounter}`,
            label: "Runtime session fixture for member-verification tests",
            currentStage: "active",
            boundaryNote:
              "Fixture session backing a non-member-anchored MemoryCandidate rejection test.",
          },
        });
        const candidate = await db.memoryCandidate.create({
          data: {
            workspaceId,
            runtimeSessionId: session.id,
            candidateKey: `runtime-anchored-candidate-${suffix}-${runtimeAnchoredFixtureCounter}`,
            summary: "Runtime-anchored candidate fixture (not member-anchored).",
            sourceVerification: "inferred",
            sourceStatus: "draft_fact",
            status: RuntimeMemoryCandidateStatus.PENDING_VERIFICATION,
          },
        });
        return candidate.id;
      }

      async function expectVerificationError(
        promise: Promise<unknown>,
        code: string,
      ): Promise<void> {
        await expect(promise).rejects.toBeInstanceOf(
          MemberSignalMemoryVerificationError,
        );
        await promise.catch((error: unknown) => {
          expect(error).toBeInstanceOf(MemberSignalMemoryVerificationError);
          expect((error as MemberSignalMemoryVerificationError).code).toBe(
            code,
          );
        });
      }

      it("verifies a member-anchored candidate with a resolved, whitelisted anchor: PROMOTED + memoryItemId backfilled + a MemoryItem carrying the enum anchor + audit with memoryItemCreated", async () => {
        const promotionCountBefore = await db.memoryPromotion.count();
        const { candidateId, artifactBundleId, objectRef } =
          await createMemberAnchoredMemoryCandidate({
            objectAnchor: resolvedAnchor("CONTACT"),
          });

        const result = await verifyMemberSignalMemoryCandidate({
          workspaceId,
          actorUserId: ownerUserId,
          actorName: "Owner",
          candidateId,
          decision: "verify",
        });
        expect(result.outcome).toBe("decided");
        expect(result.status).toBe("PROMOTED");
        expect(typeof result.memoryItemId).toBe("string");
        const memoryItemId = result.memoryItemId as string;

        const row = await db.memoryCandidate.findUniqueOrThrow({
          where: { id: candidateId },
        });
        expect(row.status).toBe(RuntimeMemoryCandidateStatus.PROMOTED);
        expect(row.memoryItemId).toBe(memoryItemId);

        const item = await db.memoryItem.findUniqueOrThrow({
          where: { id: memoryItemId },
        });
        expect(item.workspaceId).toBe(workspaceId);
        expect(item.artifactBundleId).toBe(artifactBundleId);
        expect(item.objectType).toBe("CONTACT");
        expect(item.objectId).toBe(`resolved-object-${objectRef}`);

        const provenance = JSON.parse(item.sourceProvenance ?? "null") as {
          taint: string;
          evaluationUseProhibited: boolean;
          memberRef: string;
          deviceRegistrationRef: string;
          clientId: string;
          policyRef: string;
          policyVersion: number;
          signalReceiptRef: string;
          gatewaySessionRef: string;
          artifactBundleId: string;
          candidateKey: string;
        };
        expect(provenance.taint).toBe("untrusted");
        expect(provenance.evaluationUseProhibited).toBe(true);
        expect(provenance.memberRef).toBe(`member-${suffix}`);
        expect(provenance.artifactBundleId).toBe(artifactBundleId);
        expect(provenance.candidateKey).toBe(row.candidateKey);
        expect(provenance.gatewaySessionRef).toBe(row.memberGatewaySessionRef);

        const audit = await db.auditLog.findFirst({
          where: {
            workspaceId,
            actionType: "MEMBER_SIGNAL_MEMORY_CANDIDATE_VERIFIED",
            targetType: "MemoryCandidate",
            targetId: candidateId,
          },
        });
        expect(audit).not.toBeNull();
        const payload = JSON.parse(audit?.payload ?? "null") as {
          previousStatus: string;
          nextStatus: string;
          candidateKey: string;
          memoryItemId: string;
          memoryItemCreated: boolean;
        };
        expect(payload.previousStatus).toBe(
          RuntimeMemoryCandidateStatus.PENDING_VERIFICATION,
        );
        expect(payload.nextStatus).toBe(RuntimeMemoryCandidateStatus.PROMOTED);
        expect(payload.candidateKey).toBe(row.candidateKey);
        expect(payload.memoryItemId).toBe(memoryItemId);
        expect(payload.memoryItemCreated).toBe(true);

        const promotionCountAfter = await db.memoryPromotion.count();
        expect(promotionCountAfter).toBe(promotionCountBefore);
      });

      it("a spoofed resolved objectType outside the enum whitelist falls back to an anchor-less item", async () => {
        // The artifact validator only requires a non-empty objectType
        // string, so a member-controlled "resolved" anchor with a fake
        // type is a reachable input; the enum whitelist must neutralize
        // it into the anchor-less branch rather than cast it through.
        const { candidateId } = await createMemberAnchoredMemoryCandidate({
          objectAnchor: resolvedAnchor("NOT_A_REAL_TYPE"),
        });

        const result = await verifyMemberSignalMemoryCandidate({
          workspaceId,
          actorUserId: ownerUserId,
          actorName: "Owner",
          candidateId,
          decision: "verify",
        });
        expect(result.status).toBe("PROMOTED");
        const item = await db.memoryItem.findUniqueOrThrow({
          where: { id: result.memoryItemId as string },
        });
        expect(item.objectType).toBeNull();
        expect(item.objectId).toBeNull();
      });

      it("verifies a member-anchored candidate with the default unresolved anchor: an anchor-less MemoryItem with the opaque objectRef preserved in provenance", async () => {
        const { candidateId, objectRef } =
          await createMemberAnchoredMemoryCandidate();

        const result = await verifyMemberSignalMemoryCandidate({
          workspaceId,
          actorUserId: ownerUserId,
          actorName: "Owner",
          candidateId,
          decision: "verify",
        });
        expect(result.status).toBe("PROMOTED");
        expect(typeof result.memoryItemId).toBe("string");
        const memoryItemId = result.memoryItemId as string;

        const item = await db.memoryItem.findUniqueOrThrow({
          where: { id: memoryItemId },
        });
        expect(item.objectType).toBeNull();
        expect(item.objectId).toBeNull();

        const provenance = JSON.parse(item.sourceProvenance ?? "null") as {
          objectAnchor: {
            resolved: boolean;
            objectRef?: string;
            objectVersion?: number;
          };
        };
        expect(provenance.objectAnchor.resolved).toBe(false);
        expect(provenance.objectAnchor.objectRef).toBe(objectRef);
      });

      it("rejects a member-anchored candidate: status flips to REJECTED with an audit row and writes no MemoryItem", async () => {
        const itemCountBefore = await db.memoryItem.count();
        const { candidateId } = await createMemberAnchoredMemoryCandidate();

        const result = await verifyMemberSignalMemoryCandidate({
          workspaceId,
          actorUserId: ownerUserId,
          actorName: "Owner",
          candidateId,
          decision: "reject",
          note: "Does not match anything in the CRM.",
        });
        expect(result).toEqual({ outcome: "decided", status: "REJECTED" });

        const row = await db.memoryCandidate.findUniqueOrThrow({
          where: { id: candidateId },
        });
        expect(row.status).toBe(RuntimeMemoryCandidateStatus.REJECTED);
        expect(row.memoryItemId).toBeNull();
        expect(row.reviewerNote).toContain(
          "Does not match anything in the CRM.",
        );

        const audit = await db.auditLog.findFirst({
          where: {
            workspaceId,
            actionType: "MEMBER_SIGNAL_MEMORY_CANDIDATE_REJECTED",
            targetType: "MemoryCandidate",
            targetId: candidateId,
          },
        });
        expect(audit).not.toBeNull();

        const itemCountAfter = await db.memoryItem.count();
        expect(itemCountAfter).toBe(itemCountBefore);
      });

      it("is idempotent: a repeat same-direction decision returns already_decided with the same memoryItemId, and writes no second audit row or MemoryItem", async () => {
        const { candidateId } = await createMemberAnchoredMemoryCandidate();

        const first = await verifyMemberSignalMemoryCandidate({
          workspaceId,
          actorUserId: ownerUserId,
          actorName: "Owner",
          candidateId,
          decision: "verify",
        });
        expect(first.outcome).toBe("decided");
        expect(first.status).toBe("PROMOTED");
        const itemCountAfterFirst = await db.memoryItem.count();

        const second = await verifyMemberSignalMemoryCandidate({
          workspaceId,
          actorUserId: ownerUserId,
          actorName: "Owner",
          candidateId,
          decision: "verify",
        });
        expect(second).toEqual({
          outcome: "already_decided",
          status: "PROMOTED",
          memoryItemId: first.memoryItemId,
        });

        const itemCountAfterSecond = await db.memoryItem.count();
        expect(itemCountAfterSecond).toBe(itemCountAfterFirst);

        const auditCount = await db.auditLog.count({
          where: {
            workspaceId,
            actionType: "MEMBER_SIGNAL_MEMORY_CANDIDATE_VERIFIED",
            targetType: "MemoryCandidate",
            targetId: candidateId,
          },
        });
        expect(auditCount).toBe(1);
      });

      it("rejects an opposite-direction re-decision as a terminal state conflict", async () => {
        const { candidateId } = await createMemberAnchoredMemoryCandidate();

        await verifyMemberSignalMemoryCandidate({
          workspaceId,
          actorUserId: ownerUserId,
          actorName: "Owner",
          candidateId,
          decision: "verify",
        });

        await expectVerificationError(
          verifyMemberSignalMemoryCandidate({
            workspaceId,
            actorUserId: ownerUserId,
            actorName: "Owner",
            candidateId,
            decision: "reject",
          }),
          "memory_candidate_state_conflict",
        );

        const row = await db.memoryCandidate.findUniqueOrThrow({
          where: { id: candidateId },
        });
        expect(row.status).toBe(RuntimeMemoryCandidateStatus.PROMOTED);
      });

      it("rejects a legacy VERIFIED row (pre-2026-08-22-second-round semantics) as a state conflict, never auto-upgrading it to PROMOTED", async () => {
        const { candidateId } = await createMemberAnchoredMemoryCandidate();
        // MemoryCandidate has no append-only triggers; hand-set the row to
        // the legacy VERIFIED status this service no longer produces, to
        // simulate a row that predates the 2026-08-22 second-round ruling.
        await db.$executeRaw`
          UPDATE MemoryCandidate SET status = 'VERIFIED'
          WHERE id = ${candidateId}`;

        await expectVerificationError(
          verifyMemberSignalMemoryCandidate({
            workspaceId,
            actorUserId: ownerUserId,
            actorName: "Owner",
            candidateId,
            decision: "verify",
          }),
          "memory_candidate_state_conflict",
        );

        const row = await db.memoryCandidate.findUniqueOrThrow({
          where: { id: candidateId },
        });
        expect(row.status).toBe(RuntimeMemoryCandidateStatus.VERIFIED);
        expect(row.memoryItemId).toBeNull();
      });

      it("rejects a candidate whose provenance JSON fails validation", async () => {
        const { candidateId } = await createMemberAnchoredMemoryCandidate();
        // MemoryCandidate has no append-only triggers; corrupt the stored
        // provenance directly to simulate a damaged row.
        await db.$executeRaw`
          UPDATE MemoryCandidate SET sourceStatus = 'not-json'
          WHERE id = ${candidateId}`;

        await expectVerificationError(
          verifyMemberSignalMemoryCandidate({
            workspaceId,
            actorUserId: ownerUserId,
            actorName: "Owner",
            candidateId,
            decision: "verify",
          }),
          "memory_candidate_corrupt",
        );

        const row = await db.memoryCandidate.findUniqueOrThrow({
          where: { id: candidateId },
        });
        expect(row.status).toBe(
          RuntimeMemoryCandidateStatus.PENDING_VERIFICATION,
        );
      });

      it("rejects a non-member-anchored (runtime-anchored) row without touching it", async () => {
        const candidateId = await createRuntimeAnchoredMemoryCandidate();

        await expectVerificationError(
          verifyMemberSignalMemoryCandidate({
            workspaceId,
            actorUserId: ownerUserId,
            actorName: "Owner",
            candidateId,
            decision: "verify",
          }),
          "memory_candidate_not_member_anchored",
        );

        const row = await db.memoryCandidate.findUniqueOrThrow({
          where: { id: candidateId },
        });
        expect(row.status).toBe(RuntimeMemoryCandidateStatus.PENDING_VERIFICATION);
      });

      it("rejects a MEMBER-role caller", async () => {
        const { candidateId } = await createMemberAnchoredMemoryCandidate();

        await expect(
          verifyMemberSignalMemoryCandidate({
            workspaceId,
            actorUserId: memberUserId,
            actorName: "Member",
            candidateId,
            decision: "verify",
          }),
        ).rejects.toBeInstanceOf(WorkspaceServiceGovernanceError);

        const row = await db.memoryCandidate.findUniqueOrThrow({
          where: { id: candidateId },
        });
        expect(row.status).toBe(
          RuntimeMemoryCandidateStatus.PENDING_VERIFICATION,
        );
      });
    });
  },
);

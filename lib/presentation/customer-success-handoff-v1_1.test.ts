import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("customer success handoff v1.1", () => {
  it("keeps the source-of-truth and issue/escalation spec docs present", () => {
    for (const relativePath of [
      "docs/product/CUSTOMER_SUCCESS_HANDOFF_SOURCE_OF_TRUTH_V1_1.md",
      "docs/product/CUSTOMER_SUCCESS_ISSUE_ESCALATION_QUEUE_V1_1_SPEC.md",
    ]) {
      expect(
        existsSync(path.join(root, relativePath)),
        `${relativePath} should exist`,
      ).toBe(true);
    }
  });

  it("keeps README and docs index pointed at the v1.1 customer success docs", () => {
    const docsReadme = read("docs/README.md");

    for (const snippet of [
      "CUSTOMER_SUCCESS_HANDOFF_SOURCE_OF_TRUTH_V1_1.md",
      "CUSTOMER_SUCCESS_ISSUE_ESCALATION_QUEUE_V1_1_SPEC.md",
    ]) {
      expect(docsReadme).toContain(snippet);
    }
    expect(docsReadme).toContain(
      "Customer Success Handoff v1.1 Source Of Truth / Spec 入口",
    );
  });

  it("keeps the thin derived customer success queue surface wired into the handoff baseline", () => {
    const queueRoute = read("app/(workspace)/customer-success/page.tsx");
    const queueModel = read("features/customer-success-handoff/queue-model.ts");
    const queueView = read("features/customer-success-handoff/queue-view.tsx");
    const sharedQueueCardView = read("components/shared/agent-queue-card.tsx");
    const queries = read("data/queries.ts");
    const detailModel = read("features/customer-success-handoff/detail-model.ts");
    const inboxDetailModel = read(
      "features/inbox-followup-review-request/detail-model.ts",
    );

    for (const snippet of [
      "CustomerSuccessQueueSurfaceView",
      "buildCustomerSuccessQueueSurfaceModel",
      "getCustomerSuccessQueueData",
      "data-customer-success-queue-surface",
      "data-success-inbox-surface",
      "issue-follow-through",
      "escalation-follow-through",
      "judgementLabel",
      "variantSummary",
      "decisionPostureLabel",
      "ownershipPressureLabel",
      "readinessLabel",
      "readinessTone",
      "AgentQueueCardView",
      "AgentQueueCardHeader",
      "AgentQueueCardStatusChips",
      "AgentQueueCardResurfaceSummary",
      "AgentQueueCardProgressSummary",
      "data-agent-queue-card-view",
      "/customer-success/",
      "/inbox/",
      "customerSuccessHref",
    ]) {
      expect(
        [
          queueRoute,
          queueModel,
          queueView,
          sharedQueueCardView,
          queries,
          detailModel,
          inboxDetailModel,
        ].join("\n"),
      ).toContain(snippet);
    }
  });

  it("keeps limited internal execution action-level, internal-only and attributable", () => {
    const detailModel = read("features/customer-success-handoff/detail-model.ts");
    const detailView = read("features/customer-success-handoff/detail-view.tsx");
    const queueModel = read("features/customer-success-handoff/queue-model.ts");
    const queueView = read("features/customer-success-handoff/queue-view.tsx");
    const shell = read("components/shared/role-conversation-detail-shell.tsx");
    const actions = read("features/customer-success-handoff/actions.ts");
    const panel = read(
      "features/customer-success-handoff/internal-actions-panel.tsx",
    );
    const helper = read("features/customer-success-handoff/internal-actions.ts");

    for (const snippet of [
      "data-customer-success-limited-internal-execution",
      "internalActionsLabel",
      "internalActions: CustomerSuccessInternalActionViewModel[]",
      "user-approved-to-execute",
      "executed-internally",
      "Approve internal execution",
      "Execute internally",
      "customerSuccessInternalActionKey",
      "internalActionStatusLabel",
      "internalActionResultLabel",
      "CUSTOMER_SUCCESS_INTERNAL_ACTION_APPROVED",
      "ActionType.DRAFT_INTERNAL_NOTE",
      "ActionType.CREATE_TASK",
      "internal-only",
      "action-level provenance/execution state",
    ]) {
      expect(
        [detailModel, detailView, queueModel, queueView, shell, actions, panel, helper].join(
          "\n",
        ),
      ).toContain(snippet);
    }
  });

  it("keeps process advisory thin, derived and non-controlling", () => {
    const detailModel = read("features/customer-success-handoff/detail-model.ts");
    const detailView = read("features/customer-success-handoff/detail-view.tsx");
    const queueModel = read("features/customer-success-handoff/queue-model.ts");
    const queueView = read("features/customer-success-handoff/queue-view.tsx");
    const shell = read("components/shared/role-conversation-detail-shell.tsx");

    for (const snippet of [
      "data-customer-success-process-advisory",
      "CustomerSuccessProcessAdvisoryCategory",
      "processAdvisoryLabel",
      "processAdvisoryItems",
      "missing-decision",
      "blocked-by-dependency",
      "boundary-limited",
      "repeated-review-before-send",
      "widened-ownership-pressure",
      "expansion-readiness-distorted",
      "advisory categories are not stages",
      "not workflow states",
      "do not change route ownership",
      "Playbook recommendations are suggestions, not automatic actions.",
      "advisoryCategoryLabel",
      "advisoryPlaybookLabel",
      "Advisory cue",
      "Safe playbook",
    ]) {
      expect([detailModel, detailView, queueModel, queueView, shell].join("\n")).toContain(
        snippet,
      );
    }
  });

  it("keeps policy surface thin, conservative and non-controlling", () => {
    const detailModel = read("features/customer-success-handoff/detail-model.ts");
    const detailView = read("features/customer-success-handoff/detail-view.tsx");
    const queueModel = read("features/customer-success-handoff/queue-model.ts");
    const queueView = read("features/customer-success-handoff/queue-view.tsx");
    const panel = read(
      "features/customer-success-handoff/internal-actions-panel.tsx",
    );
    const shell = read("components/shared/role-conversation-detail-shell.tsx");

    for (const snippet of [
      "data-customer-success-policy-surface",
      "CustomerSuccessPolicyCue",
      "CustomerSuccessPolicySurfaceModel",
      "policyLabel",
      "policyItems",
      "advisory-only",
      "approval-required",
      "internal-execution-allowed",
      "external-send-disabled",
      "commitment-disabled",
      "policy cues are governance markers, not stages or workflow states",
      "they do not mutate route ownership or approval chains",
      "they keep external send and commitment disabled on this surface",
      "What stays available now",
      "What remains blocked",
      "Requires your approval",
      "Not customer-sendable",
      "Non-commitment",
      "External send disabled",
      "Commitment disabled",
    ]) {
      expect(
        [detailModel, detailView, queueModel, queueView, panel, shell].join("\n"),
      ).toContain(snippet);
    }
  });

  it("keeps prepared external drafts reviewable-only, non-sendable and non-commitment", () => {
    const detailModel = read("features/customer-success-handoff/detail-model.ts");
    const detailView = read("features/customer-success-handoff/detail-view.tsx");
    const queueModel = read("features/customer-success-handoff/queue-model.ts");
    const queueView = read("features/customer-success-handoff/queue-view.tsx");
    const draftPanel = read(
      "features/customer-success-handoff/external-drafts-panel.tsx",
    );
    const shell = read("components/shared/role-conversation-detail-shell.tsx");

    for (const snippet of [
      "data-customer-success-external-draft-surface",
      "data-customer-success-draft-review-handoff",
      "data-customer-success-post-send-outcome",
      "CustomerSuccessExternalDraftCue",
      "CustomerSuccessExternalDraftKind",
      "CustomerSuccessDraftReviewOutcomeCue",
      "CustomerSuccessDraftReviewOutcomeModel",
      "CustomerSuccessPostSendOutcomeCue",
      "CustomerSuccessPostSendOutcomeModel",
      "externalDraftsLabel",
      "externalDrafts: CustomerSuccessExternalDraftViewModel[]",
      "draft-only",
      "review-before-send",
      "not-sendable-yet",
      "boundary-limited",
      "non-commitment-required",
      "human-review-required",
      "review-pending",
      "reviewed-by-human",
      "revision-requested",
      "handoff-to-human-sender",
      "manual-send-recorded",
      "awaiting-external-outcome",
      "external-reply-received",
      "outcome-requested-clarification",
      "outcome-tightened-boundary",
      "outcome-unblocked",
      "outcome-shifted-next-action",
      "outcome-maintains-review-posture",
      "draft cues are not stages",
      "draft cues are not workflow states",
      "they do not enable send",
      "they do not imply commitment",
      "review / handoff cues are draft-level provenance markers, not stages or workflow states",
      "handoff-to-human-sender does not give Helm send authority",
      "manual send can only be recorded after the fact",
      "post-send outcome cues are derived outcome markers, not stages or workflow states",
      "they keep send authority outside Helm and only assimilate visible external results back into the working surface",
      "Prepared external drafts",
      "Prepared external draft",
      "Draft policy",
      "Draft remains blocked by",
      "Review outcome",
      "Send handoff",
      "Manual send record",
      "What happened after send handoff",
      "First meaningful external outcome",
      "What changed now",
      "What still remains unresolved",
      "External send still stays disabled",
      "Draft only",
      "Not customer-sendable yet",
      "Non-commitment required",
      "Human review required",
      "Review pending",
      "Reviewed by human",
      "Revision requested",
      "Handed off to human sender",
      "Manual send recorded",
      "Awaiting external outcome",
      "External reply received",
      "Clarification requested",
      "Outcome tightened boundary",
      "Outcome unblocked progress",
      "Next action shifted",
      "Still review-limited",
    ]) {
      expect(
        [detailModel, detailView, queueModel, queueView, draftPanel, shell].join(
          "\n",
        ),
      ).toContain(snippet);
    }
  });

  it("keeps detail decision separate from decisionRequest and treats supported fields as optional", () => {
    const contract = read(
      "lib/presentation/customer-success-handoff-surface-contract.ts",
    );
    const detailModel = read("features/customer-success-handoff/detail-model.ts");

    for (const snippet of [
      "customerSuccessDetailDecision: string[];",
      "decision?: string[];",
      "customerSuccessHandoffAudienceMode?:",
      "customerSuccessHandoffOwnership?:",
      "customerSuccessHandoffEvidenceGroups?:",
      "customerSuccessDetailAudienceMode?:",
      "customerSuccessDetailSendabilityMode?:",
      "customerSuccessDetailFallbackMode?:",
      "customerSuccessDetailEvidenceGroups?:",
      "customerSuccessDetailDecision: decisionItems,",
      "customerSuccessDetailDecisionRequest:",
    ]) {
      expect([contract, detailModel].join("\n")).toContain(snippet);
    }
  });

  it("keeps checks and regression aligned to the v1.1 boundary", () => {
    const selfCheck = read("scripts/helm-self-check.ts");
    const boundaryCheck = read("scripts/decision-first-boundary-check.ts");
    const pilotReadiness = read("scripts/pilot-readiness-check.ts");
    const demoScript = read("docs/product/demo-script.md");
    const manualAcceptance = read("docs/pilot/manual-acceptance-paths.md");
    const deliveryBoundary = read("docs/pilot/delivery-boundary.md");
    const principles = read("docs/product/product-principles.md");
    const packageJson = read("package.json");

    for (const snippet of [
      "CUSTOMER_SUCCESS_HANDOFF_SOURCE_OF_TRUTH_V1_1.md",
      "CUSTOMER_SUCCESS_ISSUE_ESCALATION_QUEUE_V1_1_SPEC.md",
    ]) {
      expect(selfCheck).toContain(snippet);
      expect(pilotReadiness).toContain(snippet);
    }

    expect(boundaryCheck).toContain(
      "customer_success_handoff_v1_1_keeps_issue_escalation_and_derived_queue_boundary",
    );
    expect(demoScript).toContain("Customer Success Handoff Source Of Truth v1.1");
    expect(manualAcceptance).toContain("Customer Success Queue / Inbox Surface");
    expect(deliveryBoundary).toContain("derived `success queue / success inbox`");
    expect(principles).toContain("derived `success queue / success inbox`");
    expect(packageJson).toContain(
      "lib/presentation/customer-success-handoff-v1_1.test.ts",
    );
  });

  it("freezes the exact 10-stage model as the complete minimal v1.1 set", () => {
    const sourceOfTruth = read(
      "docs/product/CUSTOMER_SUCCESS_HANDOFF_SOURCE_OF_TRUTH_V1_1.md",
    );

    expect(sourceOfTruth).toContain(
      "These 10 stages are the complete frozen minimal stage model for v1.1.",
    );
    expect(sourceOfTruth).toContain(
      "If code, docs, tests, or checks diverge, they must be aligned back to this list.",
    );
    expect(sourceOfTruth).toContain(
      "No extra stage is permitted in v1.1 without an explicit follow-on revision to this document.",
    );

    for (const stage of [
      "success-follow-through",
      "activation-follow-through",
      "review-follow-through",
      "expansion-review",
      "expansion-ready-but-blocked",
      "issue-follow-through",
      "escalation-follow-through",
      "internal-prep-only",
      "review-before-send",
      "blocked-by-boundary",
    ]) {
      expect(sourceOfTruth).toContain(stage);
    }
  });

  it("keeps company review context primary and inbox/meeting/memory as supporting only", () => {
    const sourceOfTruth = read(
      "docs/product/CUSTOMER_SUCCESS_HANDOFF_SOURCE_OF_TRUTH_V1_1.md",
    );
    const spec = read(
      "docs/product/CUSTOMER_SUCCESS_ISSUE_ESCALATION_QUEUE_V1_1_SPEC.md",
    );

    for (const content of [sourceOfTruth, spec]) {
      expect(content).toContain(
        "derived primarily from existing `opportunity / review request / company` context",
      );
      expect(content).toContain(
        "`inbox / meeting / memory` may contribute supporting evidence and context, but do not become new canonical parent objects for the handoff model.",
      );
    }
  });

  it("keeps field interpretation notes and issue/escalation routing clarifications explicit", () => {
    const sourceOfTruth = read(
      "docs/product/CUSTOMER_SUCCESS_HANDOFF_SOURCE_OF_TRUTH_V1_1.md",
    );
    const spec = read(
      "docs/product/CUSTOMER_SUCCESS_ISSUE_ESCALATION_QUEUE_V1_1_SPEC.md",
    );

    for (const snippet of [
      "`decisionRequest` is the explicit ask carried by the handoff surface.",
      "`decision` is the current decision framing shown in detail and may summarize current decision posture, not only the outbound ask.",
      "`owner` in queue / inbox views is a thin operational projection derived from `ownership`; it does not create a new canonical ownership object.",
      "Presentation labels such as `why it matters` and `action summary` are UI slots derived from frozen contract fields and do not introduce new schema fields.",
    ]) {
      expect(sourceOfTruth).toContain(snippet);
    }

    for (const snippet of [
      "`issue-follow-through` is used when customer success sees a real follow-through problem, but the path to resolution remains within normal current-round coordination and does not yet require widened ownership pressure.",
      "`escalation-follow-through` is used when progress is materially blocked by dependency, boundary, missing decision, cross-functional ownership pressure, or elevated execution risk.",
      "a required dependency is blocked or unresolved",
      "ownership must widen beyond the normal customer success path",
      "risk has increased enough that normal follow-through wording would understate reality",
      "a decision is required before safe external progression",
      "the current path would otherwise drift into implied commitment",
      "blocking dependencies are cleared",
      "ownership pressure narrows back to normal customer success handling",
      "the decision bottleneck is resolved",
      "the boundary / risk posture no longer requires widened escalation framing",
      "`issue-follow-through` may route forward into `success check` when the issue is sufficiently contained.",
      "`issue-follow-through` may route into `expansion review` only when the issue does not distort commercial readiness.",
      "`escalation-follow-through` does not imply commitment and should remain boundary / risk / decision-first.",
      "`escalation-follow-through` may downgrade into `review-before-send` or `blocked-by-boundary` when external sendability would otherwise overstate certainty.",
    ]) {
      expect(spec).toContain(snippet);
    }
  });

  it("keeps the code source pinned to the shared customer success handoff contract file", () => {
    const sourceOfTruth = read(
      "docs/product/CUSTOMER_SUCCESS_HANDOFF_SOURCE_OF_TRUTH_V1_1.md",
    );

    expect(sourceOfTruth).toContain("Code source:");
    expect(sourceOfTruth).toContain(
      "- `lib/presentation/customer-success-handoff-surface-contract.ts`",
    );
  });

  it("keeps first-screen visibility rules explicit for required and supported fields", () => {
    const sourceOfTruth = read(
      "docs/product/CUSTOMER_SUCCESS_HANDOFF_SOURCE_OF_TRUTH_V1_1.md",
    );
    const detailView = read("features/customer-success-handoff/detail-view.tsx");
    const queueView = read("features/customer-success-handoff/queue-view.tsx");
    const roleShell = read("components/shared/role-conversation-detail-shell.tsx");
    const narrativeComponents = read("components/shared/narrative-components.tsx");

    for (const snippet of [
      "The first screen must keep these items visible without opening the evidence drawer:",
      "- current `judgement`",
      "- current `reason`",
      "- `why it matters`",
      "- `action summary`",
      "- `decision request`",
      "- `boundary`",
      "- `evidence summary`",
      "- `worker summary`",
      "- `next action`",
      "- `risk cue`",
      "- current `stage`",
      "Where supported fields are present in the current scenario, their summary cues should also remain visible on the first screen, including:",
      "- current `sendability`",
      "- current `fallback`",
      "- current `ownership`",
    ]) {
      expect(sourceOfTruth).toContain(snippet);
    }

    for (const snippet of [
      "DecisionSummaryCard",
      "EvidenceSummaryCard",
      "hideSummaryItems",
      "formatCustomerSuccessHandoffDetailModel",
      "decisionItems={displayModel.decisionItems}",
      "firstScreenEvidenceItems={",
      "displayModel.protocol.pageEvidenceSummary",
    ]) {
      expect(
        [detailView, queueView, roleShell, narrativeComponents].join("\n"),
      ).toContain(snippet);
    }
  });

  it("keeps secondary summary rules explicit and subordinate to the main judgement", () => {
    const sourceOfTruth = read(
      "docs/product/CUSTOMER_SUCCESS_HANDOFF_SOURCE_OF_TRUTH_V1_1.md",
    );

    for (const snippet of [
      "Secondary summary may carry compact status framing that supports the main judgement but must not replace it.",
      "Where applicable, this may include:",
      "- stage label",
      "- ownership label",
      "- audience label",
      "- sendability label",
      "- fallback label",
      "- review pressure",
    ]) {
      expect(sourceOfTruth).toContain(snippet);
    }
  });

  it("keeps the source-of-truth document authoritative over the companion v1.1 spec", () => {
    const sourceOfTruth = read(
      "docs/product/CUSTOMER_SUCCESS_HANDOFF_SOURCE_OF_TRUTH_V1_1.md",
    );
    const spec = read(
      "docs/product/CUSTOMER_SUCCESS_ISSUE_ESCALATION_QUEUE_V1_1_SPEC.md",
    );

    for (const snippet of [
      "`issue / escalation` rules and `success queue / success inbox` thin integration semantics are defined in the companion v1.1 spec.",
      "This document remains the baseline authority for:",
      "- system positioning",
      "- frozen contract fields",
      "- placement rules",
      "- stage model",
      "- recommendation / commitment guardrails",
      "Where the companion v1.1 spec and this document interact, this document wins on baseline positioning and contract interpretation.",
    ]) {
      expect(sourceOfTruth).toContain(snippet);
    }

    expect(spec).toContain(
      "Where this companion v1.1 spec and `CUSTOMER_SUCCESS_HANDOFF_SOURCE_OF_TRUTH_V1_1.md` interact, the source-of-truth document wins on baseline positioning and contract interpretation.",
    );
  });

  it("keeps thin queue and inbox clarified as a derived operational projection only", () => {
    const spec = read(
      "docs/product/CUSTOMER_SUCCESS_ISSUE_ESCALATION_QUEUE_V1_1_SPEC.md",
    );
    const queueRoute = read("app/(workspace)/customer-success/page.tsx");
    const queueModel = read("features/customer-success-handoff/queue-model.ts");
    const queueView = read("features/customer-success-handoff/queue-view.tsx");

    for (const snippet of [
      "`success queue / success inbox` is a derived operational surface.",
      "It is not a canonical system of record.",
      "These are the minimal projected fields for v1.1.",
      "- `stage`",
      "- `judgement`",
      "- `owner`",
      "- `nextAction`",
      "- `risk`",
      "- `evidence`",
      "- `decisionRequest`",
      "- `boundary`",
      "- prioritization",
      "- visibility",
      "- thin routing cues",
      "- operational triage",
      "- workflow engine semantics",
      "- SLA engine semantics",
      "- permissions expansion",
      "- default auto-send",
      "- default auto-commit",
    ]) {
      expect(spec).toContain(snippet);
    }

    expect(queueView).toContain(
      "key={`${section.label}-${item.href}-${item.label}-${index}`}",
    );
    expect(queueRoute).toContain("visibleInboxThreadIds");
    expect(queueRoute).toContain("queueData.successInboxThreads.filter");
    expect(queueRoute).toContain("getInboxData(workspace.id");

    expect(queueModel).toContain("fallbackCustomerSuccessStageLabel");
    expect(queueModel).not.toContain("queueItem?.stageLabel ?? thread.opportunity.stage");
    for (const snippet of [
      "buildQueueVariantSummary",
      "buildOwnershipPressureLabel",
      "buildQueueReadinessCue",
      "Current judgement",
      "Variant cue",
      "Decision posture",
      "Ownership pressure",
      "item.readinessLabel",
      "item.readinessTone",
    ]) {
      expect([queueModel, queueView].join("\n")).toContain(snippet);
    }
  });

  it("keeps shared attention cues and review-surface labels aligned", () => {
    const detailModel = read("features/customer-success-handoff/detail-model.ts");
    const detailView = read("features/customer-success-handoff/detail-view.tsx");
    const queueModel = read("features/customer-success-handoff/queue-model.ts");
    const queueView = read("features/customer-success-handoff/queue-view.tsx");
    const roleShell = read("components/shared/role-conversation-detail-shell.tsx");

    for (const snippet of [
      "Prepared review surface",
      "authorityState",
      "attentionState",
      "helm-prepared",
      "user-reviewed",
      "user-backed",
      "watching",
      "pushing",
      "waiting",
      "blocked",
      "review-before-send",
      "Since last seen",
      "Why this is back now",
      "Prepared actions",
      "Your decisions now",
      "Progress trace",
      "buildWatchState",
      "resurfaceReasonItems",
      "lastSeenSummary",
      "stillWaitingLabel",
      "stillBlockedLabel",
      "Why this is back now",
      "Still waiting on",
      "Still blocked by",
      "currentUserId",
      "progressTraceItems",
      "authorityLabel",
      "attentionLabel",
      "progressLabel",
      "data-customer-success-visible-agent",
      "data-customer-success-shared-attention",
    ]) {
      expect(
        [detailModel, detailView, queueModel, queueView, roleShell].join("\n"),
      ).toContain(snippet);
    }
  });

  it("extracts conservative shared agent primitives and adopts them on review-request detail without customer-success drift", () => {
    const sharedPrimitives = read("lib/presentation/agent-primitives.ts");
    const customerSuccessDetailModel = read(
      "features/customer-success-handoff/detail-model.ts",
    );
    const customerSuccessDetailView = read(
      "features/customer-success-handoff/detail-view.tsx",
    );
    const customerSuccessQueueModel = read(
      "features/customer-success-handoff/queue-model.ts",
    );
    const customerSuccessInternalActions = read(
      "features/customer-success-handoff/internal-actions.ts",
    );
    const reviewRequestDetailModel = read(
      "features/inbox-followup-review-request/detail-model.ts",
    );
    const reviewRequestDetailView = read(
      "features/inbox-followup-review-request/detail-view.tsx",
    );
    const successCheckDetailModel = read("features/success-check/detail-model.ts");
    const successCheckDetailView = read("features/success-check/detail-view.tsx");
    const successCheckRoute = read("app/(workspace)/success-checks/[id]/page.tsx");
    const expansionReviewDetailModel = read(
      "features/expansion-review/detail-model.ts",
    );
    const expansionReviewDetailView = read(
      "features/expansion-review/detail-view.tsx",
    );
    const expansionReviewRoute = read(
      "app/(workspace)/expansion-reviews/[id]/page.tsx",
    );
    const roleShell = read("components/shared/role-conversation-detail-shell.tsx");
    const sharedDetailView = read(
      "components/shared/agent-surface-detail-view.tsx",
    );
    const conversationChainDetailView = read(
      "features/conversation-chain-extension/detail-view.tsx",
    );
    const sharedQueueCardView = read("components/shared/agent-queue-card.tsx");
    const narrativeComponents = read("components/shared/narrative-components.tsx");

    for (const snippet of [
      "AgentAuthorityState",
      "AgentAttentionState",
      "AgentPolicyCue",
      "AgentSurfaceSections",
      "formatAgentAuthorityState",
      "toneForAgentAuthorityState",
      "formatAgentAttentionState",
      "toneForAgentAttentionState",
      "Shared agent primitives stay surface-agnostic",
      "do not add workflow, send, or commitment authority by themselves",
    ]) {
      expect(sharedPrimitives).toContain(snippet);
    }

    for (const snippet of [
      "@/lib/presentation/agent-primitives",
      "AgentSurfaceSections",
      "formatAgentAuthorityState",
      "formatAgentAttentionState",
      "toneForAgentAuthorityState",
      "toneForAgentAttentionState",
    ]) {
      expect(
        [
          customerSuccessDetailModel,
          customerSuccessQueueModel,
          customerSuccessInternalActions,
          reviewRequestDetailModel,
          reviewRequestDetailView,
          successCheckDetailModel,
          successCheckDetailView,
          expansionReviewDetailModel,
          expansionReviewDetailView,
          sharedDetailView,
          roleShell,
          narrativeComponents,
        ].join("\n"),
      ).toContain(snippet);
    }

    for (const snippet of [
      "AgentSurfaceDetailView",
      "RoleConversationDetailShellProps",
      "AgentStatusChips",
      "AgentOptionalSummarySection",
      "AgentResurfaceSection",
      "AgentProgressTraceSection",
      "wrapperDataAttributes",
      "AgentQueueCardView",
      "AgentQueueCardHeader",
      "AgentQueueCardStatusChips",
      "AgentQueueCardResurfaceSummary",
      "AgentQueueCardProgressSummary",
    ]) {
      expect(
        [
          sharedDetailView,
          sharedQueueCardView,
          roleShell,
          narrativeComponents,
          customerSuccessDetailView,
          reviewRequestDetailView,
          successCheckDetailView,
          expansionReviewDetailView,
        ].join("\n"),
      ).toContain(snippet);
    }

    for (const snippet of [
      "\"data-shared-agent-surface\": \"review-request-detail\"",
      "buildReviewRequestAgentSurface",
      "deriveReviewRequestAuthorityState",
      "deriveReviewRequestAttentionState",
      "This review line can stay prepared, summarized and visible here, but it still does not close review or send externally.",
      "This is back because the next outward move still needs explicit human review before anyone speaks with more certainty.",
      "A bounded review request surface is already prepared.",
      "firstScreenEvidenceItems={model.protocol.pageEvidenceSummary}",
      "progressTraceItems={model.progressTraceItems}",
      "review-before-send",
    ]) {
      expect([reviewRequestDetailModel, reviewRequestDetailView].join("\n")).toContain(
        snippet,
      );
    }

    expect(reviewRequestDetailModel).not.toContain("issue-follow-through");
    expect(reviewRequestDetailModel).not.toContain("escalation-follow-through");
    expect(narrativeComponents).toContain(
      "key={`${action.href}-${action.label}-${index}`}",
    );
    expect(sharedDetailView).toContain(
      "key={`${action.href}-${action.label}-${index}`}",
    );
    expect(conversationChainDetailView).toContain(
      "key={`${action.href}-${action.label}-${index}`}",
    );

    for (const snippet of [
      "\"data-shared-agent-surface\": \"success-check-detail\"",
      "buildSuccessCheckDetailPageModel",
      "SuccessCheckDetailView",
      "Since last seen",
      "Why this is back now",
      "Progress trace",
      "data-success-check-agent-surface",
    ]) {
      expect(
        [successCheckDetailModel, successCheckDetailView, successCheckRoute].join(
          "\n",
        ),
      ).toContain(snippet);
    }

    expect(successCheckDetailModel).not.toContain("issue-follow-through");
    expect(successCheckDetailModel).not.toContain("CustomerSuccessExternalDraftKind");

    for (const snippet of [
      "\"data-shared-agent-surface\": \"expansion-review-detail\"",
      "buildExpansionReviewDetailPageModel",
      "ExpansionReviewDetailView",
      "Since last seen",
      "Why this is back now",
      "Progress trace",
      "data-expansion-review-agent-surface",
      "commercial review",
    ]) {
      expect(
        [
          expansionReviewDetailModel,
          expansionReviewDetailView,
          expansionReviewRoute,
        ].join("\n"),
      ).toContain(snippet);
    }

    expect(expansionReviewDetailModel).not.toContain("issue-follow-through");
    expect(expansionReviewDetailModel).not.toContain("CustomerSuccessExternalDraftKind");
  });
});

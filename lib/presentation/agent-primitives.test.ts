import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("shared agent primitives baseline v1", () => {
  it("keeps the baseline and acceptance docs present and discoverable", () => {
    for (const relativePath of [
      "docs/product/SHARED_AGENT_PRIMITIVES_BASELINE_V1.md",
      "docs/reviews/SHARED_AGENT_SEMANTICS_ACCEPTANCE_REPORT.md",
      "docs/product/SHARED_AGENT_OPERATIONAL_SURFACE_BASELINE_V1.md",
      "docs/reviews/SHARED_AGENT_OPERATIONAL_SURFACE_ACCEPTANCE_REPORT.md",
      "docs/pilot/SHARED_AGENT_PILOT_READINESS_V1.md",
      "docs/pilot/SHARED_AGENT_PILOT_RUNBOOK_V1.md",
      "docs/pilot/SHARED_AGENT_PILOT_OBSERVATION_TEMPLATE_V1.md",
      "docs/reviews/SHARED_AGENT_PILOT_READINESS_REPORT.md",
      "docs/reviews/SHARED_AGENT_PILOT_SESSION_REPORT_TEMPLATE.md",
      "scripts/shared-agent-outcome-snapshot.ts",
    ]) {
      expect(existsSync(path.join(root, relativePath))).toBe(true);
    }

    const docsReadme = read("docs/README.md");
    expect(docsReadme).toContain("SHARED_AGENT_PRIMITIVES_BASELINE_V1.md");
    expect(docsReadme).toContain("SHARED_AGENT_SEMANTICS_ACCEPTANCE_REPORT.md");
    expect(docsReadme).toContain("SHARED_AGENT_OPERATIONAL_SURFACE_BASELINE_V1.md");
    expect(docsReadme).toContain(
      "SHARED_AGENT_OPERATIONAL_SURFACE_ACCEPTANCE_REPORT.md",
    );
    expect(docsReadme).toContain("SHARED_AGENT_PILOT_READINESS_V1.md");
    expect(docsReadme).toContain("SHARED_AGENT_PILOT_RUNBOOK_V1.md");
    expect(docsReadme).toContain("SHARED_AGENT_PILOT_OBSERVATION_TEMPLATE_V1.md");
    expect(docsReadme).toContain("SHARED_AGENT_PILOT_READINESS_REPORT.md");
    expect(docsReadme).toContain("SHARED_AGENT_PILOT_SESSION_REPORT_TEMPLATE.md");
    expect(docsReadme).toContain("shared-agent-outcome-snapshot.ts");
    expect(docsReadme).toContain(
      "customer success 仍是 richest proving ground，review-request detail 是 first thin adjacent adoption，success-check detail 是 second thin adjacent adoption，expansion-review detail 是 third thin adjacent adoption",
    );
    expect(docsReadme).toContain(
      "shared operational queue/card layer 目前只在 customer success queue/cards 上得到证明",
    );
    expect(docsReadme).toContain(
      "shared agent pilot readiness 现在只回答“当前 surface 是否足够支持人工 pilot 评估”和“现有 signal 到底能测什么”",
    );
  });

  it("freezes shared primitives as neutral and conservative", () => {
    const baseline = read("docs/product/SHARED_AGENT_PRIMITIVES_BASELINE_V1.md");
    const operationalBaseline = read(
      "docs/product/SHARED_AGENT_OPERATIONAL_SURFACE_BASELINE_V1.md",
    );
    const sharedPrimitives = read("lib/presentation/agent-primitives.ts");

    for (const snippet of [
      "AgentAuthorityState",
      "AgentAttentionState",
      "AgentPolicyCue",
      "AgentTag",
      "AgentSurfaceSections",
      "presentation/model-layer shared baseline",
      "customer success = richest proving ground",
      "review-request detail = first thin adjacent adoption",
      "success-check detail = second thin adjacent adoption",
      "expansion-review detail = third thin adjacent adoption",
      "identity/header composition",
      "shared status chips",
      "shared resurfacing section",
      "shared thin progress trace rendering",
      "should not be conflated with the shared operational queue/card layer",
      "Operational queue/card composition now has its own customer-success-first baseline",
      "local judgement / review posture copy that does not map cleanly across surfaces",
      "do not create a canonical shared agent root object",
      "do not create workflow-engine semantics",
      "do not create send authority",
      "review-before-send does not mean safe-to-send by default",
    ]) {
      expect([baseline, operationalBaseline, sharedPrimitives].join("\n")).toContain(
        snippet,
      );
    }
  });

  it("freezes the operational queue/card layer as customer-success-first only", () => {
    const operationalBaseline = read(
      "docs/product/SHARED_AGENT_OPERATIONAL_SURFACE_BASELINE_V1.md",
    );
    const operationalAcceptance = read(
      "docs/reviews/SHARED_AGENT_OPERATIONAL_SURFACE_ACCEPTANCE_REPORT.md",
    );
    const sharedQueueCardView = read("components/shared/agent-queue-card.tsx");

    for (const snippet of [
      "customer-success-first baseline for the shared agent queue/card display/composition layer",
      "customer success queue/cards are the first and only proven operational adoption so far",
      "no second operational adoption is claimed",
      "shared operational display layer, not a repo-wide operational semantics layer",
      "AgentQueueCardView",
      "AgentQueueCardHeader",
      "AgentQueueCardStatusChips",
      "AgentQueueCardResurfaceSummary",
      "AgentQueueCardProgressSummary",
      "AgentQueueCardCopyBlock",
      "AgentQueueCardMetaGrid",
      "display/composition only",
      "does not create a queue system of record",
      "does not create workflow semantics",
      "does not create prioritization, assignment, or SLA semantics",
      "does not create send authority",
      "does not create commitment authority",
      "local blocked / waiting phrasing",
      "local footer actions",
      "Why No Second Operational Adoption Was Added",
    ]) {
      expect(
        [operationalBaseline, operationalAcceptance, sharedQueueCardView].join("\n"),
      ).toContain(snippet);
    }
  });

  it("keeps pilot readiness and outcome snapshot grounded in existing signals only", () => {
    const pilotBaseline = read("docs/pilot/SHARED_AGENT_PILOT_READINESS_V1.md");
    const pilotReport = read("docs/reviews/SHARED_AGENT_PILOT_READINESS_REPORT.md");
    const snapshotScript = read("scripts/shared-agent-outcome-snapshot.ts");

    for (const snippet of [
      "customer success detail = richest proving ground",
      "review-request detail = first thin adjacent adoption",
      "success-check detail = second thin adjacent adoption",
      "expansion-review detail = third thin adjacent adoption",
      "customer success queue/cards = first operational proving ground",
      "authority cue presence",
      "attention cue presence",
      "progress trace availability",
      "internal action approval / execution cue presence",
      "prepared external draft cue presence",
      "review outcome / send handoff / manual send recording cue presence",
      "post-send outcome cue presence",
      "operational queue/card shared cue presence",
      "actual user time saved",
      "actual collaborator response lift",
      "not measurable yet",
      "Read-only snapshot from existing code and contract signals only.",
      "manual pilot evaluation",
      "Customer success queue/cards",
      "not-in-scope",
      "not-yet-measurable",
    ]) {
      expect([pilotBaseline, pilotReport, snapshotScript].join("\n")).toContain(
        snippet,
      );
    }
  });

  it("keeps the manual pilot package explicit, observation-driven and non-telemetry-backed", () => {
    const runbook = read("docs/pilot/SHARED_AGENT_PILOT_RUNBOOK_V1.md");
    const observationTemplate = read(
      "docs/pilot/SHARED_AGENT_PILOT_OBSERVATION_TEMPLATE_V1.md",
    );
    const sessionReportTemplate = read(
      "docs/reviews/SHARED_AGENT_PILOT_SESSION_REPORT_TEMPLATE.md",
    );
    const docsReadme = read("docs/README.md");

    for (const snippet of [
      "manual pilot sessions on the currently proven shared agent surfaces",
      "pre-session snapshot run",
      "detail-surface walkthrough",
      "operational queue/card walkthrough",
      "collaborator-reading pass",
      "snapshot output attached or copied",
      "clear",
      "partly clear",
      "unclear",
      "grounded measurable coverage",
      "manual observation only",
      "not measurable yet",
      "go:",
      "no-go:",
      "conditional-go:",
      "runbook 用于执行真实 manual pilot",
    ]) {
      expect(
        [runbook, observationTemplate, sessionReportTemplate, docsReadme].join(
          "\n",
        ),
      ).toContain(snippet);
    }
  });

  it("keeps shared agent display helpers slot-based and neutral", () => {
    const sharedDetailView = read(
      "components/shared/agent-surface-detail-view.tsx",
    );
    const sharedQueueCardView = read("components/shared/agent-queue-card.tsx");
    const roleShell = read("components/shared/role-conversation-detail-shell.tsx");
    const narrativeComponents = read("components/shared/narrative-components.tsx");
    const customerSuccessView = read(
      "features/customer-success-handoff/detail-view.tsx",
    );
    const reviewRequestView = read(
      "features/inbox-followup-review-request/detail-view.tsx",
    );
    const successCheckView = read("features/success-check/detail-view.tsx");
    const expansionReviewView = read("features/expansion-review/detail-view.tsx");

    for (const snippet of [
      "AgentSurfaceDetailView",
      "RoleConversationDetailShellProps",
      "wrapperDataAttributes",
      "AgentStatusChips",
      "AgentOptionalSummarySection",
      "AgentResurfaceSection",
      "AgentProgressTraceSection",
      "AgentQueueCardView",
      "AgentQueueCardHeader",
      "AgentQueueCardStatusChips",
      "AgentQueueCardResurfaceSummary",
      "AgentQueueCardProgressSummary",
      "data-agent-status-chips",
      "data-agent-resurface-section",
      "data-agent-queue-card-view",
      "data-agent-queue-card-status-chips",
      "data-agent-queue-card-resurface-summary",
      "data-agent-queue-card-progress-summary",
    ]) {
      expect(
        [
          sharedDetailView,
          sharedQueueCardView,
          roleShell,
          narrativeComponents,
          customerSuccessView,
          reviewRequestView,
          successCheckView,
          expansionReviewView,
        ].join("\n"),
      ).toContain(snippet);
    }

    expect(sharedDetailView).not.toContain("issue-follow-through");
    expect(sharedDetailView).not.toContain("CustomerSuccessExternalDraftKind");
    expect(sharedDetailView).not.toContain("manual-send-recorded");
    expect(sharedQueueCardView).not.toContain("issue-follow-through");
    expect(sharedQueueCardView).not.toContain("CustomerSuccessExternalDraftKind");
    expect(sharedQueueCardView).not.toContain("manual-send-recorded");
  });

  it("keeps customer-success-only semantics out of the shared baseline and thin adjacent adoptions", () => {
    const baseline = read("docs/product/SHARED_AGENT_PRIMITIVES_BASELINE_V1.md");
    const acceptance = read(
      "docs/reviews/SHARED_AGENT_SEMANTICS_ACCEPTANCE_REPORT.md",
    );
    const reviewRequestModel = read(
      "features/inbox-followup-review-request/detail-model.ts",
    );
    const successCheckModel = read("features/success-check/detail-model.ts");
    const successCheckView = read("features/success-check/detail-view.tsx");
    const successCheckRoute = read("app/(workspace)/success-checks/[id]/page.tsx");
    const expansionReviewModel = read("features/expansion-review/detail-model.ts");
    const expansionReviewView = read("features/expansion-review/detail-view.tsx");
    const expansionReviewRoute = read(
      "app/(workspace)/expansion-reviews/[id]/page.tsx",
    );

    for (const snippet of [
      "customer success stage model",
      "issue / escalation semantic meaning",
      "`processAdvisory` categories",
      "internal action classes",
      "external draft classes",
      "review outcome / send handoff / manual send recorded cues",
      "post-send outcome classes",
      "local judgement / review posture copy that does not map cleanly across surfaces",
      "review-request detail is the first thin adjacent adoption",
      "success-check detail is the second thin adjacent adoption",
      "expansion-review detail is the third thin adjacent adoption",
      "Customer success detail still reads as the richest full agent layer.",
      "Review-request detail still reads as a thinner adjacent adoption.",
      "Success-check detail still reads as a second thin adjacent adoption rather than a customer success clone.",
      "Expansion-review detail now reads as a third thin adjacent adoption rather than a customer success clone.",
    ]) {
      expect([baseline, acceptance].join("\n")).toContain(snippet);
    }

    expect(reviewRequestModel).not.toContain("issue-follow-through");
    expect(reviewRequestModel).not.toContain("escalation-follow-through");
    expect(reviewRequestModel).not.toContain("CustomerSuccessExternalDraftKind");
    expect(reviewRequestModel).not.toContain("CustomerSuccessPostSendOutcomeCue");

    for (const snippet of [
      "buildSuccessCheckDetailPageModel",
      "SuccessCheckDetailView",
      "\"data-shared-agent-surface\": \"success-check-detail\"",
      "AgentAuthorityState",
      "AgentAttentionState",
      "AgentPolicyCue",
      "Since last seen",
      "Why this is back now",
      "Progress trace",
    ]) {
      expect([successCheckModel, successCheckView, successCheckRoute].join("\n")).toContain(
        snippet,
      );
    }

    expect(successCheckRoute).not.toContain("CustomerSuccessHandoffDetailView");
    expect(successCheckRoute).not.toContain("buildSuccessCheckPageModel");
    expect(successCheckModel).not.toContain("issue-follow-through");
    expect(successCheckModel).not.toContain("escalation-follow-through");
    expect(successCheckModel).not.toContain("CustomerSuccessExternalDraftKind");
    expect(successCheckModel).not.toContain("CustomerSuccessPostSendOutcomeCue");

    for (const snippet of [
      "buildExpansionReviewDetailPageModel",
      "ExpansionReviewDetailView",
      "\"data-shared-agent-surface\": \"expansion-review-detail\"",
      "AgentAuthorityState",
      "AgentAttentionState",
      "AgentPolicyCue",
      "Since last seen",
      "Why this is back now",
      "Progress trace",
      "Commercial review",
    ]) {
      expect(
        [expansionReviewModel, expansionReviewView, expansionReviewRoute].join("\n"),
      ).toContain(snippet);
    }

    expect(expansionReviewRoute).not.toContain("CustomerSuccessHandoffDetailView");
    expect(expansionReviewRoute).not.toContain("buildExpansionReviewPageModel");
    expect(expansionReviewModel).not.toContain("issue-follow-through");
    expect(expansionReviewModel).not.toContain("escalation-follow-through");
    expect(expansionReviewModel).not.toContain("CustomerSuccessExternalDraftKind");
    expect(expansionReviewModel).not.toContain("CustomerSuccessPostSendOutcomeCue");
  });
});

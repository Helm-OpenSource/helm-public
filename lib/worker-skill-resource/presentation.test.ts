import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createEvidencePayloadGroups,
  createWorkerSkillResourcePageSupport,
} from "@/lib/worker-skill-resource/presentation";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("worker skill resource page support", () => {
  it("builds ordered real evidence payload groups before contract-only fallback groups", () => {
    const groups = createEvidencePayloadGroups({
      english: true,
      replayItems: [
        {
          itemId: "replay-a",
          label: "Replay A",
          href: "/meetings/meeting_a",
          summary: "Replay summary A",
        },
        {
          itemId: "replay-a",
          label: "Replay A",
          href: "/meetings/meeting_a",
          summary: "Replay summary A duplicate",
        },
        {
          itemId: "replay-b",
          label: "Replay B",
          href: "/meetings/meeting_b",
        },
      ],
      auditItems: [
        {
          itemId: "audit-a",
          label: "Audit A",
          href: "/memory?objectType=OPPORTUNITY&objectId=opp_a",
        },
      ],
      memoryItems: [],
      handoffItems: [
        {
          itemId: "handoff-a",
          label: "Handoff A",
          href: "/approvals?approvalId=approval_a",
        },
      ],
    });

    expect(groups).toEqual([
      {
        groupId: "replay_payload",
        label: "Replay payload",
        items: [
          {
            itemId: "replay-a",
            label: "Replay A",
            href: "/meetings/meeting_a",
            summary: "Replay summary A",
          },
          {
            itemId: "replay-b",
            label: "Replay B",
            href: "/meetings/meeting_b",
          },
        ],
      },
      {
        groupId: "audit_payload",
        label: "Audit payload",
        items: [
          {
            itemId: "audit-a",
            label: "Audit A",
            href: "/memory?objectType=OPPORTUNITY&objectId=opp_a",
          },
        ],
      },
      {
        groupId: "handoff_payload",
        label: "Handoff payload",
        items: [
          {
            itemId: "handoff-a",
            label: "Handoff A",
            href: "/approvals?approvalId=approval_a",
          },
        ],
      },
    ]);
  });

  it("derives dashboard reporting support from the shared Sprint 2 contract", () => {
    const support = createWorkerSkillResourcePageSupport({
      pageId: "dashboard",
      english: true,
      supplementalEvidenceGroups: createEvidencePayloadGroups({
        english: true,
        replayItems: [
          {
            itemId: "dashboard-replay",
            label: "Real dashboard replay payload.",
            href: "/meetings/demo",
          },
        ],
        auditItems: [
          {
            itemId: "dashboard-audit",
            label: "Real dashboard audit payload.",
            href: "/memory?objectType=OPPORTUNITY&objectId=opp_demo",
          },
        ],
      }),
      supplementalEvidenceSummary: ["Dynamic operating counts stay visible."],
      supplementalLinks: [
        {
          label: "Open weekly report",
          href: "/reports",
        },
      ],
    });

    expect(support.contractFlowIds).toEqual([
      "founder-risk-clarification",
      "proposal-shaping-review",
      "review-note-preparation",
    ]);
    expect(support.contractWorkerIds).toEqual(
      expect.arrayContaining([
        "founder-assistant-worker",
        "sales-assistant-worker",
        "delivery-assistant-worker",
      ]),
    );
    expect(support.contractSkillIds).toEqual(
      expect.arrayContaining([
        "risk-clarification-skill",
        "proposal-shaping-skill",
        "review-note-skill",
      ]),
    );
    expect(support.contractResourceIds).toEqual(
      expect.arrayContaining([
        "risk-signal-resource",
        "docs-query-resource",
        "proposal-context-resource",
        "review-queue-resource",
      ]),
    );
    expect(support.pageWorkerSummary[0]).toContain("Founder Assistant Worker");
    expect(support.pageWorkerSummary[0]).toContain("proposal shaping");
    expect(support.pageWorkerAssignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assignmentId: "founder-assistant-worker",
        }),
        expect.objectContaining({
          assignmentId: "sales-assistant-worker",
        }),
      ]),
    );
    expect(support.pageEvidenceSummary).toEqual(
      expect.arrayContaining([
        "Dynamic operating counts stay visible.",
        expect.stringContaining("risk signals"),
        expect.stringContaining("review, approval, replay, audit, memory, boundary"),
      ]),
    );
    expect(support.pageEvidenceGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupId: "replay_payload",
          label: "Replay payload",
        }),
        expect.objectContaining({
          groupId: "audit_payload",
          label: "Audit payload",
        }),
        expect.objectContaining({
          groupId: "contract_flows",
          label: "Contract flows",
        }),
        expect.objectContaining({
          groupId: "resource_bindings",
          label: "Bounded resources",
        }),
        expect.objectContaining({
          groupId: "control_plane_checks",
          label: "Control-plane checks",
        }),
      ]),
    );
    expect(support.pageEvidenceGroups[0]?.groupId).toBe("replay_payload");
    expect(support.pageEvidenceGroups[0]?.items[0]).toEqual(
      expect.objectContaining({
        itemId: "dashboard-replay",
        href: "/meetings/demo",
      }),
    );
    expect(support.pageEvidenceLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ href: "/reports" }),
        expect.objectContaining({ href: "/memory" }),
        expect.objectContaining({ href: "/approvals" }),
        expect.objectContaining({ href: "/opportunities" }),
      ]),
    );
  });

  it("keeps opportunity and approval surfaces pinned to the contract helper", () => {
    const opportunitiesSupport = createWorkerSkillResourcePageSupport({
      pageId: "opportunities",
      english: false,
    });
    const approvalsSupport = createWorkerSkillResourcePageSupport({
      pageId: "approvals",
      english: true,
    });

    expect(opportunitiesSupport.contractFlowIds).toEqual([
      "sales-followup-draft",
      "sales-objection-response",
      "proposal-shaping-review",
    ]);
    expect(opportunitiesSupport.pageWorkerSummary[0]).toContain("销售助理");
    expect(opportunitiesSupport.pageWorkerSummary[0]).toContain("异议处理");
    expect(opportunitiesSupport.pageWorkerAssignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assignmentId: "sales-assistant-worker",
        }),
      ]),
    );
    expect(approvalsSupport.contractFlowIds).toEqual([
      "sales-objection-response",
      "proposal-shaping-review",
      "review-note-preparation",
    ]);
    expect(approvalsSupport.pageEvidenceSummary).toEqual(
      expect.arrayContaining([
        expect.stringContaining("review queue"),
        expect.stringContaining("review, approval, replay, audit"),
      ]),
    );
    expect(approvalsSupport.pageEvidenceGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupId: "fallback_paths",
        }),
      ]),
    );
  });

  it("keeps Chinese approval support copy free of internal contract terms", () => {
    const support = createWorkerSkillResourcePageSupport({
      pageId: "approvals",
      english: false,
    });
    const visibleCopy = [
      ...support.pageWorkerSummary,
      ...support.pageEvidenceSummary,
      ...support.pageWorkerAssignments.flatMap((item) => [
        item.summary,
        ...(item.chips ?? []),
        ...(item.items ?? []),
      ]),
      ...support.pageEvidenceGroups.flatMap((group) => [
        group.label,
        ...group.items.map((item) =>
          typeof item === "string"
            ? item
            : [item.label, item.summary].filter(Boolean).join(" "),
        ),
      ]),
    ].join("\n");

    expect(visibleCopy).toContain("复核");
    expect(visibleCopy).toContain("方案整形");
    expect(visibleCopy).toContain("客户可见措辞必须保持发送前复核");
    expect(visibleCopy).toContain("可以准备客户可读草稿");
    expect(visibleCopy).toContain("先读取商业上下文");
    expect(visibleCopy).not.toMatch(
      /review-before-send|customer-visible|non-commitment-only|review-first|May prepare|May update|Read commercial context|Read boundary, package|Read proposal and package|proposal draft|governance notes|customer-ready commitment|当前接入的 flow|默认 skill|review 包|proposal 上下文|review 队列|contract 证据/,
    );
  });

  it("pins representative pages and checks to the shared contract presentation helper", () => {
    // Dashboard is composed of a thin orchestrator plus dedicated builders
    // under features/dashboard/. The shared-contract wiring is verified
    // against that bundle rather than the page file alone.
    const dashboard = [
      "app/(workspace)/dashboard/page.tsx",
      "features/dashboard/view-model.ts",
      "features/dashboard/evidence-groups.ts",
      "features/dashboard/header-briefing.ts",
    ]
      .map((p) => read(p))
      .join("\n");
    const opportunities = read("features/opportunities/opportunities-client.tsx");
    const approvals = read("features/approvals/approvals-client.tsx");
    const memory = read("features/memory/memory-client.tsx");
    const pageSectionAnchors = read("lib/presentation/page-section-anchors.ts");
    const selfCheck = read("scripts/helm-self-check.ts");
    const boundaryCheck = read("scripts/decision-first-boundary-check.ts");

    for (const content of [dashboard, opportunities, approvals]) {
      expect(content).toContain("createWorkerSkillResourcePageSupport");
      expect(content).toContain("createEvidencePayloadGroups");
      expect(content).toContain("pageWorkerAssignments");
      expect(content).toContain("pageEvidenceGroups");
    }

    expect(dashboard).toContain('pageId: "dashboard"');
    expect(opportunities).toContain('pageId: "opportunities"');
    expect(approvals).toContain('pageId: "approvals"');
    expect(approvals).toContain("approvalId=");
    expect(approvals).toContain("APPROVAL_PAGE_ANCHORS");
    expect(opportunities).toContain("OPPORTUNITY_PAGE_ANCHORS");
    expect(opportunities).toContain("scrollToWindowHashTarget");
    expect(memory).toContain("MEMORY_PAGE_ANCHORS");
    expect(pageSectionAnchors).toContain("approval-source-context");
    expect(pageSectionAnchors).toContain("opportunity-briefing");
    expect(pageSectionAnchors).toContain("memory-audit-replay");
    expect(pageSectionAnchors).toContain("buildApprovalItemAnchor");
    expect(pageSectionAnchors).toContain("buildOpportunityItemAnchor");
    expect(pageSectionAnchors).toContain("buildMemoryItemAnchor");
    expect(selfCheck).toContain("worker skill resource page support");
    expect(selfCheck).toContain("page section anchors");
    expect(boundaryCheck).toContain("worker skill resource page support");
    expect(boundaryCheck).toContain("section anchor");
  });
});

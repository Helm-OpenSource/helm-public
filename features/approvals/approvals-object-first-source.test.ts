import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { splitSystemJudgementBlocks } from "@/lib/presentation/system-judgement-blocks";

const source = readFileSync("features/approvals/approvals-client.tsx", "utf8");
const { outside, count } = splitSystemJudgementBlocks(
  "features/approvals/approvals-client.tsx",
  source,
);

function sliceBetween(start: string, end: string) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  expect(from, start).toBeGreaterThanOrEqual(0);
  expect(to, end).toBeGreaterThan(from);
  return source.slice(from, to);
}

describe("approvals page object-first source contract", () => {
  it("orders the page by source, not CSS order classes, with one closing judgement block", () => {
    expect(source).not.toMatch(/\border-(?:\d+|last)\b/);
    expect(count).toBe(1);
    const block = source.indexOf("data-system-judgement");
    expect(source.indexOf("data-approval-draft-focus")).toBeLessThan(
      source.indexOf('id="approval-queue"'),
    );
    expect(source.indexOf('id="approval-queue"')).toBeLessThan(
      source.indexOf("data-approval-draft-body"),
    );
    expect(source.indexOf("data-approval-draft-body")).toBeLessThan(block);
    expect(source.indexOf('data-testid="approval-load-disclosure"')).toBeLessThan(block);
    expect(source.indexOf('id="meeting-follow-through-review"')).toBeLessThan(block);
  });

  it("keeps the boundary bar, focus judgement and reporting panels inside the judgement block", () => {
    for (const marker of [
      "<BoundaryBar",
      "<CustomerAssetFocusStrip",
      "<ReportingProtocolPanel",
      "<ProactiveMechanismPanel",
      "<BusinessLoopGapReadoutLines",
      "data-approval-focus-judgement",
    ]) {
      expect(outside, marker).not.toContain(marker);
    }
    expect(source).toContain("<BoundaryBar");
    expect(source).toContain("<ReportingProtocolPanel");
    expect(source).toContain("<BusinessLoopGapReadoutLines");
    // Outside the block the readout is only defined, never consumed.
    expect(outside.match(/businessLoopGapReadout/g)).toHaveLength(1);
  });

  it("shows the draft body, initiator and origin thread on queue cards instead of system reasoning", () => {
    const queueCards = sliceBetween(
      "filtered.map((task) => {",
      "<EmptyState",
    );

    expect(queueCards).toContain("data-approval-draft-body={task.id}");
    expect(queueCards).toContain("getApprovalDraftText(task)");
    expect(queueCards).toContain("<ApprovalProvenance task={task} english={english} />");
    expect(queueCards).toContain("formatApprovalDecisionNote(task, english, approvalText)");
    expect(queueCards).not.toContain("task.reasoning");
    expect(queueCards).not.toContain("recommendationLog.explanation");
    expect(source).toContain('data-approval-origin-thread="true"');
    expect(source).toContain("href={`/inbox/${task.originThread.id}`}");
    expect(source).toContain("task.actionItem.createdBy?.name");
  });

  it("puts the full action text first in the drawer and folds reason chain, why-now and risk", () => {
    const drawer = sliceBetween("<SheetContent", "</SheetContent>");
    const fullText = drawer.indexOf("APPROVAL_PAGE_ANCHORS.fullActionContent");
    const reasonChain = drawer.indexOf('data-approval-drawer-reason-chain="true"');
    const whyNow = drawer.indexOf("id={APPROVAL_PAGE_ANCHORS.aiReasoning}");
    const riskNote = drawer.indexOf("id={APPROVAL_PAGE_ANCHORS.riskNote}");
    const decisionButtons = drawer.indexOf('english ? "Approve for execution" : "批准待执行"');

    expect(fullText).toBeGreaterThan(-1);
    for (const index of [reasonChain, whyNow, riskNote]) {
      expect(index).toBeGreaterThan(fullText);
      expect(index).toBeGreaterThan(decisionButtons);
      expect(drawer.lastIndexOf("<details", index)).toBeGreaterThan(
        drawer.lastIndexOf("</details>", index),
      );
    }
    expect(drawer).toContain('data-approval-decision-record="true"');
    expect(drawer).toContain("formatApprovalDecisionNote(selected, english, approvalText)");
    expect(drawer).not.toContain("data-system-judgement");
  });

  it("drops the header description and the queue-control explainers", () => {
    expect(source).not.toContain("pageStory.description");
    expect(source).not.toContain("Start with the draft most likely to affect a customer.");
    expect(source).not.toContain("Read the queue by urgency, channel and execution mode");
    expect(source).not.toContain('"Action state"');
    expect(source).not.toContain("Reason chain first view");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("features/approvals/approvals-client.tsx", "utf8");

describe("approval drawer accessibility source contract", () => {
  it("names the review drawer close control for Computer Use and screen readers", () => {
    expect(source).toContain("closeLabel={english ? \"Close approval drawer\" : \"关闭复核抽屉\"}");
  });

  it("clears the deep-link approval state when the drawer closes", () => {
    expect(source).toContain("const closeSelectedApproval = useCallback");
    expect(source).toContain("new URLSearchParams(window.location.search)");
    expect(source).toContain("params.delete(\"approvalId\")");
    expect(source).toContain("params.delete(\"evidenceOpen\")");
    expect(source).toContain("query ? `${pathname}?${query}` : pathname");
    expect(source).toContain("onOpenChange={(open) => !open && closeSelectedApproval()}");
  });

  it("keeps the selected approval id in the URL while the drawer is open", () => {
    expect(source).toContain("setSelectedApprovalId(target.id);");
    expect(source).toContain("setPreviewApprovalId(target.id);");
    expect(source).toContain("params.set(\"approvalId\", target.id)");
    expect(source).toContain("APPROVAL_PAGE_ANCHORS.preview");
  });

  it("keeps empty approval evidence copy explanatory instead of showing zero-count data noise", () => {
    expect(source).toContain("function formatApprovalEvidencePreview");
    expect(source).toContain("formatApprovalEvidencePreview(task, english)");
    expect(source).toContain("function formatApprovalRecommendationLogEvidence");
    expect(source).toContain("暂无结构化事实、承诺或阻塞引用");
    expect(source).toContain("暂无结构化引用；先看解释和来源上下文");
    expect(source).not.toContain("`${task.recommendationFacts.length} 条事实");
    expect(source).not.toContain("`依据：事实 ${safeParseCount");
  });

  it("opens supporting decision details only when returning from memory evidence", () => {
    expect(source).toContain("initialEvidencePanelOpen: boolean");
    expect(source).toContain("const [decisionSupportOpen, setDecisionSupportOpen]");
    expect(source).toContain("initialEvidencePanelOpen,");
    expect(source).not.toContain("setDecisionSupportOpen(true);");
    expect(source).toContain("setDecisionSupportOpen(false);");
    expect(source).toContain("open={decisionSupportOpen}");
    expect(source).toContain(
      "setDecisionSupportOpen(event.currentTarget.open)",
    );
  });

  it("keeps queue-card selection separate from opening the review drawer", () => {
    expect(source).toContain("const [previewApprovalId, setPreviewApprovalId]");
    expect(source).toContain('data-approval-queue-preview-button="true"');
    expect(source).toContain("setPreviewApprovalId(task.id);");
    expect(source).toContain("open={Boolean(selected)}");
    expect(source).toContain('data-approval-open-drawer-from-preview="true"');
    expect(source).toContain("const openApprovalDrawer = useCallback");
    expect(source).toContain("setSelectedApprovalId(approval.id);");
    expect(source).toContain("window.history.replaceState(");
    expect(source).toContain("buildApprovalDrawerHref(approval.id)");
    expect(source).toContain("onClick={() => openApprovalDrawer(previewed)}");
  });
});

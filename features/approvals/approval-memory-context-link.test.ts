import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("features/approvals/approvals-client.tsx", "utf8");

describe("approval memory context link source contract", () => {
  it("routes approval evidence links to the current object's memory timeline", () => {
    expect(source).toContain(
      "const approvalMemoryEvidenceHref = approvalEvidenceFocus",
    );
    expect(source).toContain("buildApprovalMemoryHref(approvalEvidenceFocus)");
    expect(source).toContain(
      "const approvalReturnParam = `&approvalId=${encodeURIComponent(approval.id)}`;",
    );
    expect(source).toContain(
      "`/memory?from=approvals&approvalId=${encodeURIComponent(approval.id)}`",
    );
    expect(source).toContain("&from=approvals");
    expect(source).toMatch(
      /label: english \? "Open memory evidence" : "打开记忆依据",\s+href: approvalMemoryEvidenceHref,/,
    );
    expect(source).toMatch(
      /title: english\s+\?\s+"Check evidence before changing execution posture"[\s\S]*?href: approvalMemoryEvidenceHref,/,
    );
    expect(source).toMatch(
      /label: english \? "Evidence focus" : "证据焦点"[\s\S]*?href: approvalMemoryEvidenceHref,/,
    );
  });

  it("keeps active review request evidence aligned to the chosen approval candidate", () => {
    expect(source).toContain(
      "const approvalCandidateMemoryHref = approvalCandidate",
    );
    expect(source).toContain("buildApprovalMemoryHref(approvalCandidate)");
    expect(source).toMatch(
      /label: english \? "Open evidence" : "打开证据",\s+href: approvalCandidateMemoryHref,/,
    );
    expect(source).toMatch(
      /label: english \? "Open memory timeline" : "打开记忆时间线",\s+href: approvalCandidateMemoryHref,/,
    );
  });

  it("keeps the drawer decision-support evidence count actionable", () => {
    expect(source).toContain('data-approval-drawer-evidence-link="true"');
    expect(source).toContain("href={buildApprovalMemoryHref(selected)}");
    expect(source).toContain('english ? "Evidence timeline" : "证据时间线"');
    expect(source).toContain('english ? "Open evidence" : "打开证据"');
  });
});

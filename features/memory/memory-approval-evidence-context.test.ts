import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const memoryClientSource = readFileSync(
  "features/memory/memory-client.tsx",
  "utf8",
);
const memoryPageSource = readFileSync("app/(workspace)/memory/page.tsx", "utf8");
const memoryLoaderSource = readFileSync("features/memory/page-loader.ts", "utf8");

describe("memory approval evidence context source contract", () => {
  it("accepts approval-origin context without reusing the memory source filter", () => {
    expect(memoryPageSource).toContain("from?: string");
    expect(memoryPageSource).toContain("approvalId?: string");
    expect(memoryPageSource).toContain("entryContext={entryContext}");
    expect(memoryPageSource).toContain("returnToApprovalId={returnToApprovalId}");
    expect(memoryLoaderSource).toMatch(
      /const entryContext:[\s\S]*?from === "approvals" \? "APPROVAL_EVIDENCE" : null/,
    );
    expect(memoryLoaderSource).toContain("const returnToApprovalId =");
    expect(memoryLoaderSource).toContain("entryContext,");
    expect(memoryLoaderSource).toContain("returnToApprovalId,");
    expect(memoryClientSource).toContain(
      'entryContext: "APPROVAL_EVIDENCE" | null',
    );
    expect(memoryClientSource).toContain("returnToApprovalId: string | null");
    expect(memoryClientSource).toContain('params.set("from", "approvals")');
    expect(memoryClientSource).toContain(
      'params.set("approvalId", returnToApprovalId)',
    );
  });

  it("puts the approval evidence handoff inside the timeline anchor landing", () => {
    expect(memoryClientSource).toContain(
      "data-memory-approval-evidence-context",
    );
    expect(memoryClientSource).toContain(
      'isApprovalEvidenceEntry ? "true" : "false"',
    );
    expect(memoryClientSource).toContain(
      'isApprovalEvidenceEntry ? "approval" : "info"',
    );
    expect(memoryClientSource).toContain("buildApprovalEvidenceReturnHref");
    expect(memoryClientSource).toContain(
      '`/approvals?approvalId=${encodeURIComponent(approvalId)}&evidenceOpen=1#approval-preview`',
    );
    expect(memoryClientSource).toContain("import Link from \"next/link\"");
    expect(memoryClientSource).toContain("<Link href={approvalEvidenceReturnHref}>");
    expect(memoryClientSource).toContain('"/approvals#approval-queue"');
    expect(memoryClientSource).toContain(
      'returnToApprovalId',
    );
    expect(memoryClientSource).toMatch(
      /<div[\s\S]*id=\{MEMORY_PAGE_ANCHORS\.timeline\}[\s\S]*data-memory-approval-evidence-context/,
    );
  });

  it("keeps object-scoped memory links attached to the linked business object", () => {
    expect(memoryClientSource).toContain("buildObjectScopedMemoryLabel");
    expect(memoryClientSource).toContain("buildObjectScopedMemoryHref");
    expect(memoryClientSource).toContain('return `/opportunities?opportunityId=${objectId}`');
    expect(memoryClientSource).toContain(
      "objectScopedMemoryHref ? (",
    );
  });
});

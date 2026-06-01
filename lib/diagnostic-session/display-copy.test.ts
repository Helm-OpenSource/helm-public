import { describe, expect, it } from "vitest";
import {
  formatDiagnosticSessionStatusBadgeVariant,
  formatDiagnosticSessionStatusLabel,
  formatFirstLoopTypeLabel,
} from "./display-copy";

describe("formatFirstLoopTypeLabel", () => {
  it("returns bilingual labels", () => {
    expect(formatFirstLoopTypeLabel("LEAD_FOLLOW_UP", false)).toBe("线索跟进");
    expect(formatFirstLoopTypeLabel("CUSTOMER_REVIEW", true)).toBe(
      "Customer review",
    );
    expect(formatFirstLoopTypeLabel("RENEWAL_EXPANSION", false)).toBe(
      "续费 / 扩容",
    );
  });
});

describe("formatDiagnosticSessionStatusLabel", () => {
  it("returns bilingual labels for all 5 statuses", () => {
    expect(formatDiagnosticSessionStatusLabel("DRAFT", false)).toBe("草稿");
    expect(formatDiagnosticSessionStatusLabel("REVIEWED", true)).toBe("Reviewed");
    expect(formatDiagnosticSessionStatusLabel("FIRST_LOOP_SELECTED", false)).toBe(
      "已选定首个闭环",
    );
    expect(formatDiagnosticSessionStatusLabel("BLOCKED", true)).toBe("Blocked");
    expect(formatDiagnosticSessionStatusLabel("SUPERSEDED", false)).toContain(
      "替代",
    );
  });
});

describe("formatDiagnosticSessionStatusBadgeVariant", () => {
  it("maps progress states to info / approval / success", () => {
    expect(formatDiagnosticSessionStatusBadgeVariant("DRAFT")).toBe("info");
    expect(formatDiagnosticSessionStatusBadgeVariant("REVIEWED")).toBe(
      "approval",
    );
    expect(formatDiagnosticSessionStatusBadgeVariant("FIRST_LOOP_SELECTED")).toBe(
      "success",
    );
  });

  it("maps BLOCKED to warning and SUPERSEDED to neutral", () => {
    expect(formatDiagnosticSessionStatusBadgeVariant("BLOCKED")).toBe("warning");
    expect(formatDiagnosticSessionStatusBadgeVariant("SUPERSEDED")).toBe("neutral");
  });
});

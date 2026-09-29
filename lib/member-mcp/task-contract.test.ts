import { describe, expect, it } from "vitest";

import {
  MEMBER_TASK_REPORT_BLOCK_OPEN,
  buildMemberTaskReportPayload,
  memberTaskObjectRef,
  validateMemberTaskReport,
  type MemberTaskReportInput,
} from "@/lib/member-mcp/task-contract";

const report = (overrides: Partial<MemberTaskReportInput> = {}): MemberTaskReportInput => ({
  taskRef: "act_1",
  outcome: "done",
  actionTaken: "回访 12 户",
  evidenceRefs: ["case:1001", "call:attempt_abc"],
  note: "",
  ...overrides,
});

describe("member task report contract", () => {
  it("accepts opaque evidence refs and rejects urls, duplicates and control characters", () => {
    expect(validateMemberTaskReport(report())).toBeNull();
    expect(validateMemberTaskReport(report({ evidenceRefs: ["https://x.example/a"] }))).toBe("evidence_ref_invalid");
    expect(validateMemberTaskReport(report({ evidenceRefs: ["free text"] }))).toBe("evidence_ref_invalid");
    expect(validateMemberTaskReport(report({ evidenceRefs: ["case:1", "case:1"] }))).toBe("duplicate_evidence_ref");
    expect(validateMemberTaskReport(report({ evidenceRefs: Array.from({ length: 11 }, (_, i) => `case:${i}`) }))).toBe("too_many_evidence_refs");
    expect(validateMemberTaskReport(report({ actionTaken: "a\u0007b" }))).toBe("action_taken_invalid");
    expect(validateMemberTaskReport(report({ actionTaken: "  " }))).toBe("action_taken_invalid");
  });

  it("builds a deterministic signal payload that reuses frozen signal kinds", () => {
    const one = buildMemberTaskReportPayload({ report: report(), taskTitle: "工作包", decisionRef: "dr_1" });
    const two = buildMemberTaskReportPayload({ report: report(), taskTitle: "工作包", decisionRef: "dr_1" });
    expect(one).toEqual(two);
    expect(one.kind).toBe("progress");
    expect(one.detail.startsWith(`${MEMBER_TASK_REPORT_BLOCK_OPEN}\n`)).toBe(true);
    expect(one.relatedEvidenceRefs).toEqual([]);
    expect(buildMemberTaskReportPayload({ report: report({ outcome: "blocked" }), taskTitle: "t", decisionRef: "d" }).kind).toBe("blocker");
    expect(buildMemberTaskReportPayload({ report: report({ outcome: "not_started" }), taskTitle: "t", decisionRef: "d" }).kind).toBe("blocker");
    expect(buildMemberTaskReportPayload({ report: report({ note: "说明" }), taskTitle: "t", decisionRef: "d" }).detail.endsWith("\n说明")).toBe(true);
  });

  it("anchors reports to the packet's ActionItem", () => {
    expect(memberTaskObjectRef("act_1")).toBe("action-item:act_1");
  });
});

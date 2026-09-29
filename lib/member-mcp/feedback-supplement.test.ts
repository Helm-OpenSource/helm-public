import { describe, expect, it } from "vitest";

import {
  MEMBER_FEEDBACK_COUNT_KEYS,
  MEMBER_FEEDBACK_SUPPLEMENT_ENABLED_ENV,
  MEMBER_FEEDBACK_SUPPLEMENT_KEY,
  createMemberFeedbackSupplement,
  fieldReportKindOf,
  projectMemberFeedbackCounts,
  type MemberFeedbackReceiptView,
} from "@/lib/member-mcp/feedback-supplement";
import { buildFieldReportPayload } from "@/lib/member-mcp/tools";

const window = { workspaceId: "w1", windowStart: new Date("2026-09-29T00:00:00Z"), windowEnd: new Date("2026-09-30T00:00:00Z") };
const on = { [MEMBER_FEEDBACK_SUPPLEMENT_ENABLED_ENV]: "true" };

function report(id: string, memberRef: string, kind: "seat_feedback" | "data_quality", extra: Partial<MemberFeedbackReceiptView> = {}): MemberFeedbackReceiptView {
  const built = buildFieldReportPayload({ kind, title: "今日接通偏低", metrics: [], text: "机密的现场描述" }, []);
  if (!built.ok) throw new Error(built.message);
  return { id, memberRef, kind: built.payload.kind, payloadJson: JSON.stringify(built.payload), supersedesReceiptRef: null, ...extra };
}

function signal(id: string, memberRef: string, kind: string, detail = "阻碍：系统登录慢"): MemberFeedbackReceiptView {
  return { id, memberRef, kind, payloadJson: JSON.stringify({ kind, summary: "s", detail }), supersedesReceiptRef: null };
}

describe("member feedback supplement", () => {
  it("counts volume by type and reporting members, nothing else", () => {
    const counts = projectMemberFeedbackCounts([
      report("r1", "u1", "seat_feedback"),
      report("r2", "u2", "data_quality"),
      signal("s1", "u1", "blocker"),
      signal("s2", "u3", "progress"),
    ]);
    expect(counts).toMatchObject({
      field_reports_total: 2,
      field_reports_seat_feedback: 1,
      field_reports_data_quality: 1,
      signals_total: 2,
      signals_blocker: 1,
      signals_progress: 1,
      reporting_members: 3,
    });
    expect(Object.keys(counts).sort()).toEqual([...MEMBER_FEEDBACK_COUNT_KEYS].sort());
    // No content-derived text or values can appear: every value is a count.
    expect(JSON.stringify(counts)).not.toContain("机密");
    expect(Object.values(counts).every((value) => Number.isInteger(value))).toBe(true);
  });

  it("counts a correction once", () => {
    const counts = projectMemberFeedbackCounts([
      signal("s1", "u1", "blocker"),
      { ...signal("s2", "u1", "blocker"), supersedesReceiptRef: "s1" },
    ]);
    expect(counts.signals_blocker).toBe(1);
  });

  it("treats a malformed or unknown report block as a plain signal", () => {
    expect(fieldReportKindOf("```helm-field-report/v1\n{\"kind\":\"payroll\"}\n```")).toBeNull();
    expect(fieldReportKindOf("```helm-field-report/v1\nnot json\n```")).toBeNull();
    expect(fieldReportKindOf("```helm-field-report/v1\n{\"kind\":\"seat_feedback\"}")).toBeNull();
    expect(fieldReportKindOf("```helm-field-report/v1\n{\"kind\":\"seat_feedback\",\"metrics\":[]}\n```\n文字")).toBe("seat_feedback");
  });

  it("is off by default and contributes nothing", async () => {
    const port = createMemberFeedbackSupplement(async () => [signal("s1", "u1", "blocker")], {});
    expect(await port(window)).toEqual([]);
  });

  it("reports unknown, never zero, when the read fails or is truncated", async () => {
    const failing = createMemberFeedbackSupplement(async () => { throw new Error("db down"); }, on);
    const [failed] = await failing(window);
    expect(failed?.key).toBe(MEMBER_FEEDBACK_SUPPLEMENT_KEY);
    expect(Object.values(failed?.counts ?? {}).every((value) => value === null)).toBe(true);
    const many = Array.from({ length: 5001 }, (_, index) => signal(`s${index}`, "u1", "progress"));
    const [truncated] = await createMemberFeedbackSupplement(async () => many, on)(window);
    expect(truncated?.counts.signals_total).toBeNull();
  });

  it("reads the window it is given when enabled", async () => {
    const seen: unknown[] = [];
    const port = createMemberFeedbackSupplement(async (input) => { seen.push(input); return [signal("s1", "u1", "blocker")]; }, on);
    const [entry] = await port(window);
    expect(entry?.counts.signals_blocker).toBe(1);
    expect(seen[0]).toMatchObject({ workspaceId: "w1", windowStart: window.windowStart, windowEnd: window.windowEnd });
  });
});

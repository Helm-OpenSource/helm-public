import { describe, expect, it } from "vitest";
import { buildMobileCommandReadModelFromItems } from "./mobile-command-read-model";
import type { MustPushItem } from "../types";

function item(input: Partial<MustPushItem> & Pick<MustPushItem, "id" | "type" | "severity" | "score">): MustPushItem {
  return {
    title: `${input.id} title`,
    reason: `${input.id} reason`,
    primaryAction: {
      label: "Open",
      href: `/${input.id}`,
      mode: "open_page",
    },
    ...input,
  };
}

describe("buildMobileCommandReadModelFromItems", () => {
  it("returns a bounded empty-state model when there are no Must Push items", () => {
    const model = buildMobileCommandReadModelFromItems([], 4, true);

    expect(model.mustPushItems).toEqual([]);
    expect(model.totalCount).toBe(0);
    expect(model.foldedCount).toBe(0);
    expect(model.hasCriticalFolded).toBe(false);
    expect(model.reviewCount).toBe(0);
    expect(model.outcomeCheckpointCount).toBe(0);
    expect(model.outcomeLedger.items).toEqual([]);
    expect(model.outcomeLedger.nextReviewHref).toBeNull();
    expect(model.outcomeLedger.reviewCue).toBeNull();
    expect(model.todaySummary).toBe("No urgent items today");
  });

  it("keeps the first screen to one primary plus three supporting items", () => {
    const model = buildMobileCommandReadModelFromItems([
      item({ id: "low", type: "meeting_follow_up", severity: "low", score: 10 }),
      item({ id: "critical", type: "stalled_opportunity", severity: "critical", score: 20 }),
      item({ id: "waiting", type: "customer_waiting", severity: "high", score: 15 }),
      item({ id: "review", type: "blocked_decision", severity: "high", score: 30 }),
      item({ id: "proof", type: "proof_or_review_required", severity: "medium", score: 90 }),
    ]);

    expect(model.mustPushItems.map((entry) => entry.id)).toEqual([
      "critical",
      "waiting",
      "review",
      "proof",
    ]);
    expect(model.totalCount).toBe(5);
    expect(model.foldedCount).toBe(1);
    expect(model.hasCriticalFolded).toBe(false);
    expect(model.outcomeCheckpointCount).toBe(4);
    expect(model.outcomeLedger.items).toHaveLength(4);
  });

  it("adds outcome checkpoints to displayed Must Push items", () => {
    const model = buildMobileCommandReadModelFromItems([
      item({ id: "review", type: "blocked_decision", severity: "high", score: 80 }),
      item({ id: "waiting", type: "customer_waiting", severity: "high", score: 70 }),
    ]);

    expect(model.outcomeCheckpointCount).toBe(2);
    expect(model.mustPushItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "waiting",
          outcomeCheckpoint: expect.objectContaining({
            label: "结果回收",
            dueHint: "24 小时内回看",
            expectedSignal: expect.stringContaining("等待状态"),
            reviewHref: "/approvals?source=mobile&itemId=waiting&posture=outcome_review",
            status: "not_collected",
          }),
        }),
      ]),
    );
  });

  it("preserves explicit outcome checkpoint metadata", () => {
    const model = buildMobileCommandReadModelFromItems([
      item({
        id: "custom",
        type: "meeting_follow_up",
        severity: "medium",
        score: 40,
        outcomeCheckpoint: {
          label: "自定义回收",
          dueHint: "本周五回看",
          expectedSignal: "客户复盘记录",
          reviewHref: "/approvals?source=mobile&itemId=custom&posture=custom_outcome",
          status: "review_pending",
        },
      }),
    ]);

    expect(model.mustPushItems[0]?.outcomeCheckpoint).toEqual({
      label: "自定义回收",
      dueHint: "本周五回看",
      expectedSignal: "客户复盘记录",
      reviewHref: "/approvals?source=mobile&itemId=custom&posture=custom_outcome",
      status: "review_pending",
    });
    expect(model.outcomeLedger.items[0]).toEqual(
      expect.objectContaining({
        mustPushId: "custom",
        posture: "review_due",
        reviewHref: "/approvals?source=mobile&itemId=custom&posture=custom_outcome",
      }),
    );
  });

  it("builds a review-safe outcome ledger from displayed checkpoints", () => {
    const model = buildMobileCommandReadModelFromItems([
      item({
        id: "pending",
        type: "customer_waiting",
        severity: "high",
        score: 80,
        outcomeCheckpoint: {
          label: "结果回收",
          dueHint: "明早回看",
          expectedSignal: "客户是否已回复",
          reviewHref: "/approvals?source=mobile&itemId=pending&posture=outcome_review",
          status: "review_pending",
        },
      }),
      item({
        id: "accepted",
        type: "meeting_follow_up",
        severity: "medium",
        score: 40,
        outcomeCheckpoint: {
          label: "结果回收",
          dueHint: "已回收",
          expectedSignal: "复盘纪要已确认",
          reviewHref: "/approvals?source=mobile&itemId=accepted&posture=outcome_review",
          status: "accepted",
        },
      }),
    ]);

    expect(model.outcomeLedger).toEqual(
      expect.objectContaining({
        dueCount: 1,
        reviewPendingCount: 1,
        blockedCount: 0,
        nextReviewHref: "/approvals?source=mobile&itemId=pending&posture=outcome_review",
        reviewCue: expect.objectContaining({
          mustPushId: "pending",
          question: "已回收的信号是否足以关闭、降级或升级这件事？",
          evidenceToCheck: expect.arrayContaining([
            "时间要求：明早回看",
            "预期信号：客户是否已回复",
          ]),
          allowedDecisions: ["继续回收信号", "进入人工复核", "降级或标记阻塞"],
          boundaryNote: "这个提示只准备人工复核，不自动关闭事项或确认外部成功。",
        }),
        summary: "1 项结果待复核",
        boundaryNote: "结果回收台账只提示下一次复核，不自动确认结果、写回外部系统或承诺客户结果。",
      }),
    );
    expect(model.outcomeLedger.items.map((entry) => entry.mustPushId)).toEqual([
      "pending",
      "accepted",
    ]);
  });

  it("rewrites unsafe caller-provided outcome checkpoint hrefs to the safe internal default", () => {
    const unsafeHrefs = [
      "https://example.com/outcome",
      "//evil.com/outcome",
      "/api/outcome",
      "/\\evil.com",
      "/\\\\evil.com",
      "javascript:alert(1)",
      "/path\nfoo",
      "/path\rfoo",
      "/path\0foo",
      "/path\x7Ffoo",
    ];

    const safeDefault = "/approvals?source=mobile&itemId=unsafe&posture=outcome_review";

    for (const unsafe of unsafeHrefs) {
      const model = buildMobileCommandReadModelFromItems([
        item({
          id: "unsafe",
          type: "customer_waiting",
          severity: "high",
          score: 80,
          outcomeCheckpoint: {
            label: "结果回收",
            dueHint: "明早回看",
            expectedSignal: "客户是否已回复",
            reviewHref: unsafe,
            status: "review_pending",
          },
        }),
      ]);

      const mustPushHref = model.mustPushItems[0]?.outcomeCheckpoint?.reviewHref;
      expect(mustPushHref).toBe(safeDefault);
      expect(mustPushHref).not.toBe(unsafe);

      const ledgerHref = model.outcomeLedger.items[0]?.reviewHref;
      expect(ledgerHref).toBe(safeDefault);
      expect(ledgerHref).not.toBe(unsafe);

      expect(model.outcomeLedger.nextReviewHref).toBe(safeDefault);
      expect(model.outcomeLedger.nextReviewHref).not.toBe(unsafe);
    }
  });

  it("only marks critical overflow when a critical item is actually folded", () => {
    const items = [
      item({ id: "critical-a", type: "stalled_opportunity", severity: "critical", score: 30 }),
      item({ id: "critical-b", type: "overdue_commitment", severity: "critical", score: 20 }),
      item({ id: "high", type: "meeting_follow_up", severity: "high", score: 10 }),
    ];

    expect(buildMobileCommandReadModelFromItems(items, 2).hasCriticalFolded).toBe(false);
    expect(buildMobileCommandReadModelFromItems(items, 1).hasCriticalFolded).toBe(true);
  });

  it("surfaces folded customer waiting items as critical overflow cues", () => {
    const model = buildMobileCommandReadModelFromItems(
      [
        item({ id: "critical-a", type: "stalled_opportunity", severity: "critical", score: 30 }),
        item({ id: "critical-b", type: "overdue_commitment", severity: "critical", score: 20 }),
        item({ id: "critical-c", type: "proof_or_review_required", severity: "critical", score: 10 }),
        item({ id: "critical-d", type: "meeting_follow_up", severity: "critical", score: 5 }),
        item({ id: "review", type: "blocked_decision", severity: "high", score: 30 }),
        item({ id: "internal", type: "meeting_follow_up", severity: "high", score: 25 }),
        item({ id: "waiting", type: "customer_waiting", severity: "high", score: 1 }),
      ],
      4,
    );

    expect(model.mustPushItems.map((entry) => entry.id)).not.toContain("waiting");
    expect(model.hasCriticalFolded).toBe(true);
  });

  it("counts review-required boundaries across the full item set", () => {
    const model = buildMobileCommandReadModelFromItems([
      item({ id: "review", type: "blocked_decision", severity: "high", score: 80 }),
      item({
        id: "proof",
        type: "proof_or_review_required",
        severity: "medium",
        score: 60,
        boundaryNote: {
          type: "review_required",
          message: "Proof must be reviewed before any external write.",
        },
      }),
    ]);

    expect(model.reviewCount).toBe(2);
    expect(model.outcomeCheckpointCount).toBe(2);
    expect(model.todaySummary).toBe("今天先复核 review");
  });

  it("generates the first-screen summary in English when requested", () => {
    const model = buildMobileCommandReadModelFromItems(
      [
        item({
          id: "atlas",
          type: "blocked_decision",
          severity: "high",
          score: 80,
          title: "Atlas needs your review",
        }),
      ],
      4,
      true,
    );

    expect(model.todaySummary).toBe("Review Atlas first today");
  });
});

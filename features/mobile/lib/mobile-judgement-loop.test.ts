import { describe, it, expect } from "vitest";
import {
  buildMobileJudgementLoop,
  containsUnsafeMobileCopy,
  MOBILE_BANNED_ACTION_WORDS,
} from "./mobile-judgement-loop";
import type { MustPushItem } from "../types";

const baseItem = (overrides: Partial<MustPushItem> = {}): MustPushItem => ({
  id: "item-001",
  type: "stalled_opportunity",
  title: "商机停滞超 14 天",
  reason: "该商机上次推进记录距今已超两周，存在丢单风险。",
  primaryAction: {
    label: "查看商机",
    href: "/opportunities/opp-001",
    mode: "open_object",
  },
  severity: "high",
  score: 75,
  ...overrides,
});

describe("containsUnsafeMobileCopy", () => {
  it("flags banned words", () => {
    expect(containsUnsafeMobileCopy("立即发送给客户")).toBe(true);
    expect(containsUnsafeMobileCopy("auto-submit the form")).toBe(true);
  });

  it("passes safe text", () => {
    expect(containsUnsafeMobileCopy("进入复核")).toBe(false);
    expect(containsUnsafeMobileCopy("查看证据")).toBe(false);
  });

  it("MOBILE_BANNED_ACTION_WORDS is non-empty", () => {
    expect(MOBILE_BANNED_ACTION_WORDS.length).toBeGreaterThan(0);
  });
});

describe("buildMobileJudgementLoop — empty", () => {
  it("returns empty state when no items", () => {
    const result = buildMobileJudgementLoop({ items: [] });
    expect(result.state).toBe("empty");
    expect(result.item).toBeNull();
    expect(result.actions).toHaveLength(0);
    expect(result.evidence).toBeNull();
  });
});

describe("buildMobileJudgementLoop — normal", () => {
  it("maps high-score item to normal", () => {
    const result = buildMobileJudgementLoop({ items: [baseItem()] });
    expect(result.state).toBe("normal");
    expect(result.item?.id).toBe("item-001");
  });

  it("includes review, evidence, and desktop actions", () => {
    const result = buildMobileJudgementLoop({ items: [baseItem()] });
    const hrefs = result.actions.map((a) => a.href);
    expect(hrefs.some((h) => h.startsWith("/approvals?source=mobile"))).toBe(true);
    expect(hrefs.some((h) => h === "#mobile-evidence")).toBe(true);
    expect(hrefs.some((h) => h === "/opportunities/opp-001")).toBe(true);
  });

  it("no action label contains banned words", () => {
    const result = buildMobileJudgementLoop({ items: [baseItem()] });
    for (const action of result.actions) {
      expect(containsUnsafeMobileCopy(action.label)).toBe(false);
    }
  });

  it("headline and subtext do not contain unsafe status words", () => {
    const result = buildMobileJudgementLoop({ items: [baseItem()] });
    expect(containsUnsafeMobileCopy(result.headline)).toBe(false);
    expect(containsUnsafeMobileCopy(result.subtext)).toBe(false);
  });

  it("includes outcome recovery action when an outcome checkpoint is present", () => {
    const result = buildMobileJudgementLoop({
      items: [
        baseItem({
          outcomeCheckpoint: {
            label: "结果回收",
            dueHint: "72 小时内回看",
            expectedSignal: "机会是否恢复节奏",
            reviewHref: "/approvals?source=mobile&itemId=item-001&posture=outcome_review",
            status: "not_collected",
          },
        }),
      ],
    });

    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "进入结果回收",
          href: "/approvals?source=mobile&itemId=item-001&posture=outcome_review",
          variant: "secondary",
        }),
      ]),
    );
  });

  it("does not expose unsafe outcome checkpoint hrefs as actions", () => {
    const unsafeHrefs = [
      "https://example.com/outcome",
      "//evil.com/outcome",
      "/api/outcome",
      "/\\evil.com",
      "/\\\\evil.com",
      "/javascript:alert(1)",
      "/path\nfoo",
      "/path\rfoo",
      "/path\0foo",
      "/path\x7Ffoo",
    ];

    for (const unsafeHref of unsafeHrefs) {
      const result = buildMobileJudgementLoop({
        items: [
          baseItem({
            outcomeCheckpoint: {
              label: "结果回收",
              dueHint: "72 小时内回看",
              expectedSignal: "机会是否恢复节奏",
              reviewHref: unsafeHref,
              status: "not_collected",
            },
          }),
        ],
      });

      expect(result.actions.map((action) => action.href)).not.toContain(unsafeHref);
      expect(result.actions.map((action) => action.label)).not.toContain("进入结果回收");
    }
  });

  it("renders English outcome action copy when requested", () => {
    const result = buildMobileJudgementLoop({
      english: true,
      items: [
        baseItem({
          outcomeCheckpoint: {
            label: "Outcome check",
            dueHint: "Check again within 72h",
            expectedSignal: "Whether momentum resumed",
            reviewHref: "/approvals?source=mobile&itemId=item-001&posture=outcome_review",
            status: "not_collected",
          },
        }),
      ],
    });

    expect(result.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Track outcome" }),
      ]),
    );
  });
});

describe("buildMobileJudgementLoop — evidence_insufficient", () => {
  it("maps proof_or_review_required type", () => {
    const result = buildMobileJudgementLoop({
      items: [baseItem({ type: "proof_or_review_required" })],
    });
    expect(result.state).toBe("evidence_insufficient");
  });

  it("maps score < 50", () => {
    const result = buildMobileJudgementLoop({
      items: [baseItem({ score: 30 })],
    });
    expect(result.state).toBe("evidence_insufficient");
  });

  it("includes posture=evidence_insufficient in href", () => {
    const result = buildMobileJudgementLoop({
      items: [baseItem({ score: 30 })],
    });
    const hrefs = result.actions.map((a) => a.href);
    expect(hrefs.some((h) => h.includes("posture=evidence_insufficient"))).toBe(true);
  });

  it("uses review-first copy without unsafe status words", () => {
    const result = buildMobileJudgementLoop({
      items: [baseItem({ score: 30 })],
    });
    expect(result.subtext).toContain("人工复核");
    expect(containsUnsafeMobileCopy(result.subtext)).toBe(false);
  });
});

describe("buildMobileJudgementLoop — cross_tenant_denied", () => {
  const crossTenantItem = () =>
    baseItem({ boundaryNote: { type: "out_of_scope", message: "跨租户" } });

  it("maps out_of_scope boundary note", () => {
    const result = buildMobileJudgementLoop({ items: [crossTenantItem()] });
    expect(result.state).toBe("cross_tenant_denied");
  });

  it("item is null — must not leak item identity", () => {
    const result = buildMobileJudgementLoop({ items: [crossTenantItem()] });
    expect(result.item).toBeNull();
  });

  it("evidence is null — must not leak evidence", () => {
    const result = buildMobileJudgementLoop({ items: [crossTenantItem()] });
    expect(result.evidence).toBeNull();
  });

  it("actions only safe internal routes — no review or evidence hrefs", () => {
    const result = buildMobileJudgementLoop({ items: [crossTenantItem()] });
    const hrefs = result.actions.map((a) => a.href);
    // Must not include any item-specific, review, or evidence hrefs
    expect(hrefs.some((h) => h.includes("approvals"))).toBe(false);
    expect(hrefs.some((h) => h.includes("evidence"))).toBe(false);
    expect(hrefs.some((h) => h === "/opportunities/opp-001")).toBe(false);
    // Must only be safe internal paths
    for (const h of hrefs) {
      expect(h).toMatch(/^\//);
      expect(h).not.toMatch(/^\/\//);
    }
  });

  it("actions lead to home or workspace home", () => {
    const result = buildMobileJudgementLoop({ items: [crossTenantItem()] });
    const hrefs = result.actions.map((a) => a.href);
    expect(hrefs).toContain("/mobile");
    expect(hrefs).toContain("/dashboard");
  });

  it("does not use unsafe status words in cross-tenant copy", () => {
    const result = buildMobileJudgementLoop({ items: [crossTenantItem()] });
    expect(result.subtext).toContain("安全返回入口");
    expect(containsUnsafeMobileCopy(result.headline)).toBe(false);
    expect(containsUnsafeMobileCopy(result.subtext)).toBe(false);
  });
});

describe("MOBILE_BANNED_ACTION_WORDS — Chinese danger words", () => {
  const dangerWords = ["确认", "同意", "完成", "已发送", "已答复", "批准", "承诺",
    "自动发送", "自动审批", "自动写回", "通知客户", "发送邮件", "搞定"];

  for (const word of dangerWords) {
    it(`flags "${word}"`, () => {
      expect(containsUnsafeMobileCopy(word)).toBe(true);
    });
  }
});

describe("desktop-open href safety", () => {
  it("includes desktop-open for valid internal href", () => {
    const result = buildMobileJudgementLoop({ items: [baseItem()] });
    const hrefs = result.actions.map((a) => a.href);
    expect(hrefs.some((h) => h === "/opportunities/opp-001")).toBe(true);
  });

  it("excludes desktop-open for external http href", () => {
    const result = buildMobileJudgementLoop({
      items: [baseItem({ primaryAction: { label: "查看", href: "https://evil.com", mode: "open_page" } })],
    });
    const hrefs = result.actions.map((a) => a.href);
    expect(hrefs.some((h) => h === "https://evil.com")).toBe(false);
  });

  it("excludes desktop-open for protocol-relative href", () => {
    const result = buildMobileJudgementLoop({
      items: [baseItem({ primaryAction: { label: "查看", href: "//evil.com", mode: "open_page" } })],
    });
    const hrefs = result.actions.map((a) => a.href);
    expect(hrefs.some((h) => h === "//evil.com")).toBe(false);
  });

  it("excludes desktop-open for mailto href", () => {
    const result = buildMobileJudgementLoop({
      items: [baseItem({ primaryAction: { label: "查看", href: "mailto:x@y.com", mode: "open_page" } })],
    });
    const hrefs = result.actions.map((a) => a.href);
    expect(hrefs.some((h) => h === "mailto:x@y.com")).toBe(false);
  });

  it("excludes desktop-open for /api/* href", () => {
    const result = buildMobileJudgementLoop({
      items: [baseItem({ primaryAction: { label: "查看", href: "/api/internal/items/opp-001", mode: "open_page" } })],
    });
    const hrefs = result.actions.map((a) => a.href);
    expect(hrefs.some((h) => h === "/api/internal/items/opp-001")).toBe(false);
  });

  it("excludes desktop-open for any /api/ prefixed href", () => {
    for (const apiHref of ["/api/", "/api/v1/opportunities", "/api/mobile/push"]) {
      const result = buildMobileJudgementLoop({
        items: [baseItem({ primaryAction: { label: "查看", href: apiHref, mode: "open_page" } })],
      });
      const hrefs = result.actions.map((a) => a.href);
      expect(hrefs.some((h) => h === apiHref)).toBe(false);
    }
  });

  it("all model action hrefs are safe GET/navigation-only paths", () => {
    const models = [
      buildMobileJudgementLoop({ items: [baseItem()] }),
      buildMobileJudgementLoop({ items: [baseItem({ score: 30 })] }),
      buildMobileJudgementLoop({
        items: [baseItem({ boundaryNote: { type: "out_of_scope", message: "跨租户" } })],
      }),
    ];

    for (const model of models) {
      for (const action of model.actions) {
        const h = action.href;
        const isFragment = h.startsWith("#");
        const isSafeInternal =
          h.startsWith("/") && !h.startsWith("//") && !h.startsWith("/api/") && !/^\/[a-z]+:/i.test(h);
        expect(isFragment || isSafeInternal).toBe(true);
      }
    }
  });
});

describe("evidence safety — no original quote", () => {
  it("sourceHint does not echo back item.reason verbatim as a quote marker", () => {
    const item = baseItem();
    const result = buildMobileJudgementLoop({ items: [item] });
    // evidence.sourceHint must be a source pointer, not the raw original text
    expect(result.evidence?.sourceHint).not.toContain("距今");
  });

  it("helmInterpretation is the item reason (interpretation, not fabricated quote)", () => {
    const item = baseItem();
    const result = buildMobileJudgementLoop({ items: [item] });
    // helmInterpretation carries the reason as Helm's interpretation — this is allowed
    expect(result.evidence?.helmInterpretation).toBe(item.reason);
  });

  it("evidence has no 'originalQuote' field", () => {
    const item = baseItem();
    const result = buildMobileJudgementLoop({ items: [item] });
    expect(result.evidence).not.toHaveProperty("originalQuote");
  });
});

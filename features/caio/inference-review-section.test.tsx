import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CaioInferenceJudgementProjection, CaioInferenceReviewReadout } from "@/lib/caio-inference/readout";

import { InferenceReviewSection, isMostlyNonChinese } from "./inference-review-section";

const judgement = (overrides: Partial<CaioInferenceJudgementProjection> = {}): CaioInferenceJudgementProjection => ({
  taskClass: "hourly_diagnosis",
  windowStart: "2026-09-28T09:00:00.000Z",
  windowEnd: "2026-09-28T10:00:00.000Z",
  completedAt: "2026-09-28T10:49:11.000Z",
  confidenceBand: "low",
  facts: ["本窗口 6 次采样中，拨号与接通均为 0。"],
  inferences: [],
  risks: [{ statement: "4 个开关中 3 个未落实。", severity: "medium" }],
  unknowns: ["看门狗告警读数未知。"],
  suggestions: [{ kind: "dry_run_request", summary: "只读核对开关状态。" }],
  ...overrides,
});

const readout = (j: CaioInferenceJudgementProjection | null): CaioInferenceReviewReadout => ({
  available: true,
  workerState: "idle",
  jobs: [{ taskClass: "hourly_diagnosis", status: "completed", windowStart: "2026-09-28T09:00:00.000Z", windowEnd: "2026-09-28T10:00:00.000Z", attempt: 1, rejectionCode: null, completedAt: null }],
  latestJudgement: j,
});

const render = (r: CaioInferenceReviewReadout, english = false) =>
  renderToStaticMarkup(<InferenceReviewSection readout={r} english={english} />);

describe("InferenceReviewSection", () => {
  it("shows the confidence band, task class and job status in Chinese", () => {
    const html = render(readout(judgement()));
    expect(html).toContain("置信 低");
    expect(html).not.toContain("置信 low");
    expect(html).toContain("小时复盘 · 已完成");
    expect(render(readout(judgement({ confidenceBand: "mixed" })))).toContain("置信 不一");
    expect(render(readout(judgement({ confidenceBand: "unknown" })))).toContain("置信 未知");
  });

  it("keeps English labels for the English view", () => {
    const html = render(readout(judgement()), true);
    expect(html).toContain("Confidence Low");
    expect(html).toContain("Hourly review · Completed");
  });

  it("marks a legacy English judgement instead of rewriting it", () => {
    const legacy = judgement({
      facts: ["The aggregate lifecycle summary for the window shows zero cases."],
      risks: [],
      unknowns: ["Whether the provider callback is delayed."],
      suggestions: [],
    });
    const html = render(readout(legacy));
    expect(html).toContain("英文旧版输出");
    expect(html).toContain("The aggregate lifecycle summary");
    expect(render(readout(judgement()))).not.toContain("英文旧版输出");
  });

  it("detects mostly non-Chinese text but not Chinese text with ids and numbers", () => {
    expect(isMostlyNonChinese(["The window shows zero cases."])).toBe(true);
    expect(isMostlyNonChinese(["anson.reach.dial-attempts 在本窗口为 0，与上一小时相同。"])).toBe(false);
    expect(isMostlyNonChinese([])).toBe(false);
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CaioOperatingAttentionReadout } from "@/lib/caio-operating-context/readout";

import { OperatingAttentionSection } from "./operating-attention-section";

const tick = (stale: boolean) => ({ bucketStart: "2026-09-16T02:10:00.000Z", status: "COMPLETED" as const, stale });
const render = (readout: CaioOperatingAttentionReadout, english = false) =>
  renderToStaticMarkup(<OperatingAttentionSection readout={readout} english={english} />);

describe("OperatingAttentionSection", () => {
  it("never renders an unreadable state as empty", () => {
    const html = render({ available: false });
    expect(html).toContain("暂不可读");
    expect(html).not.toContain("未发现");
  });

  it("says nothing was found only when the tick is fresh and every reading is known", () => {
    expect(render({ available: true, lastTick: tick(false), openCandidates: [], unknownTemplates: [], lastSnapshot: null })).toContain("本轮快检未发现待关注项");
    const stale = render({ available: true, lastTick: tick(true), openCandidates: [], unknownTemplates: [], lastSnapshot: null });
    expect(stale).toContain("已停滞");
    expect(stale).not.toContain("未发现待关注项");
    expect(render({ available: true, lastTick: null, openCandidates: [], unknownTemplates: [], lastSnapshot: null })).toContain("快检尚未运行");
  });

  it("lists unknown readings as unknown rather than zero", () => {
    const html = render({ available: true, lastTick: tick(false), openCandidates: [], unknownTemplates: [{ templateId: "queue", domain: "operations", errorCode: "observation_gate_rejected" }], lastSnapshot: null });
    expect(html).toContain("读取未知");
    expect(html).toContain("queue");
    expect(html).toContain("observation_gate_rejected");
  });

  it("renders candidates with closed severity labels and no evidence refs", () => {
    const html = render({
      available: true, lastTick: tick(false), unknownTemplates: [], lastSnapshot: null,
      openCandidates: [{ detectorId: "dead-letter-surge", titleZh: "死信激增", titleEn: "Dead-letter surge", severity: "critical", reasonCode: "dead_letters_over_threshold", hitCount: 3, firstSeenAt: "2026-09-16T01:00:00.000Z", lastSeenAt: "2026-09-16T02:10:00.000Z" }],
    });
    expect(html).toContain("严重");
    expect(html).toContain("死信激增");
    expect(html).toContain("待关注 1 项");
    expect(html).not.toContain("caio-metric:");
    expect(render({ available: true, lastTick: tick(false), unknownTemplates: [], openCandidates: [], lastSnapshot: null }, true)).toContain("found nothing to attend to");
  });

  it.each([
    ["PROJECTED", "经营上下文快照已生成（对象 2、信号 3）"],
    ["NO_SIGNALS", "本轮无命中，未生成快照"],
    ["REJECTED", "快照未通过合同校验"],
  ] as const)("shows the %s snapshot status", (status, text) => {
    const html = render({
      available: true, lastTick: tick(false), openCandidates: [], unknownTemplates: [],
      lastSnapshot: { status, createdAt: "2026-09-16T02:10:31.000Z", objectCount: 2, signalCount: 3 },
    });
    expect(html).toContain(text);
  });
});

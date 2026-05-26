import { afterEach, describe, expect, it, vi } from "vitest";
import { sendBiReportToDingTalkGroupWebhook } from "@/lib/bi-report-skill/delivery/dingtalk-group-webhook";
import { resolveBiReportTargetKey } from "@/lib/bi-report-skill/delivery/target-resolver";

describe("bi report DingTalk group webhook delivery", () => {
  const originalWebhookEnv = process.env.BI_REPORT_DINGTALK_FINANCE_OPS_WEBHOOK_URL;
  const originalFetch = global.fetch;

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
    if (originalWebhookEnv === undefined) {
      delete process.env.BI_REPORT_DINGTALK_FINANCE_OPS_WEBHOOK_URL;
    } else {
      process.env.BI_REPORT_DINGTALK_FINANCE_OPS_WEBHOOK_URL = originalWebhookEnv;
    }
  });

  it("resolves env-backed target keys", () => {
    process.env.BI_REPORT_DINGTALK_FINANCE_OPS_WEBHOOK_URL = "https://example.com/webhook";
    expect(resolveBiReportTargetKey("env:BI_REPORT_DINGTALK_FINANCE_OPS_WEBHOOK_URL")).toBe(
      "https://example.com/webhook",
    );
  });

  it("returns dry-run preview without calling fetch", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as typeof fetch;

    const result = await sendBiReportToDingTalkGroupWebhook({
      targetType: "webhook",
      targetKey: "env:BI_REPORT_DINGTALK_FINANCE_OPS_WEBHOOK_URL",
      message: "hello",
      dryRun: true,
    });

    expect(result.status).toBe("SKIPPED");
    expect(result.responseBody).toBe("dry-run");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends a real webhook request when dryRun is false", async () => {
    process.env.BI_REPORT_DINGTALK_FINANCE_OPS_WEBHOOK_URL = "https://example.com/webhook";
    global.fetch = vi.fn().mockResolvedValue(
      new Response('{"errcode":0,"errmsg":"ok"}', {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ) as typeof fetch;

    const result = await sendBiReportToDingTalkGroupWebhook({
      targetType: "webhook",
      targetKey: "env:BI_REPORT_DINGTALK_FINANCE_OPS_WEBHOOK_URL",
      message: "hello",
      dryRun: false,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.com/webhook",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(result.status).toBe("SENT");
  });
});

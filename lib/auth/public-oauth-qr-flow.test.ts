import { describe, expect, it } from "vitest";
import {
  consumePublicOauthQrFlow,
  createPublicOauthQrFlow,
  readPublicOauthQrFlowStatus,
  resolvePublicOauthQrFlow,
} from "@/lib/auth/public-oauth-qr-flow";

describe("public oauth qr flow", () => {
  it("creates a pending flow and resolves it to matched with one-time completion", async () => {
    const now = new Date("2026-04-17T10:00:00.000Z");
    const created = await createPublicOauthQrFlow({
      provider: "dingtalk",
      now,
    });

    expect(
      await readPublicOauthQrFlowStatus({
        flowId: created.flowId,
        ownerKey: created.ownerKey,
        now,
      }),
    ).toEqual({
      status: "pending",
    });

    await resolvePublicOauthQrFlow({
      flowId: created.flowId,
      provider: "dingtalk",
      now,
      resolution: {
        status: "matched",
        preferredLocale: "zh-CN",
        userId: "user-1",
        profile: {
          name: "Owner",
          phone: "+8613800138000",
          avatar: "https://example.com/avatar.png",
        },
      },
    });

    const resolved = await readPublicOauthQrFlowStatus({
      flowId: created.flowId,
      ownerKey: created.ownerKey,
      now,
    });

    expect(resolved.status).toBe("matched");
    if (resolved.status !== "matched") {
      throw new Error("expected matched flow status");
    }

    const consumed = await consumePublicOauthQrFlow({
      flowId: created.flowId,
      ownerKey: created.ownerKey,
      completionToken: resolved.completionToken,
      now,
    });
    expect(consumed.ok).toBe(true);
    if (consumed.ok) {
      expect(consumed.resolution.status).toBe("matched");
    }

    expect(
      (await readPublicOauthQrFlowStatus({
        flowId: created.flowId,
        ownerKey: created.ownerKey,
        now,
      })).status,
    ).toBe("not-found");
  });

  it("rejects invalid flow owners", async () => {
    const created = await createPublicOauthQrFlow({
      provider: "dingtalk",
      now: new Date("2026-04-17T10:00:00.000Z"),
    });

    expect(
      (await readPublicOauthQrFlowStatus({
        flowId: created.flowId,
        ownerKey: "invalid-owner",
      })).status,
    ).toBe("invalid-owner");
  });

  it("expires stale flows", async () => {
    const now = new Date("2026-04-17T10:00:00.000Z");
    const created = await createPublicOauthQrFlow({
      provider: "dingtalk",
      now,
    });

    expect(
      (await readPublicOauthQrFlowStatus({
        flowId: created.flowId,
        ownerKey: created.ownerKey,
        now: new Date("2026-04-17T10:11:00.000Z"),
      })).status,
    ).toBe("expired");
  });
});

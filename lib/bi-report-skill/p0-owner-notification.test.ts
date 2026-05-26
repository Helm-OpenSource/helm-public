import { describe, expect, it } from "vitest";
import {
  normalizeP0OwnerNotificationTarget,
  resolveP0OwnerNotificationTargetKey,
} from "@/lib/bi-report-skill/p0-owner-notification";

describe("resolveP0OwnerNotificationTargetKey", () => {
  it("prefers supervisor mapping notificationTargetKey", () => {
    const targetKey = resolveP0OwnerNotificationTargetKey({
      ownerEmail: "Owner@Example.com",
      signalRouting: {
        strategy: "seat_supervisor_mapping",
        supervisorMappings: [
          {
            userEmail: "owner@example.com",
            notificationTargetKey: "unionId:u-1",
          },
        ],
      },
    });
    expect(targetKey).toBe("unionId:u-1");
  });

  it("falls back to env when mapping is missing", () => {
    process.env.BI_REPORT_P0_OWNER_NOTIFICATION_TARGET_KEY = "unionId:env-u";
    const targetKey = resolveP0OwnerNotificationTargetKey({
      ownerEmail: "owner@example.com",
      signalRouting: {
        strategy: "seat_supervisor_mapping",
        supervisorMappings: [],
      },
    });
    expect(targetKey).toBe("unionId:env-u");
    delete process.env.BI_REPORT_P0_OWNER_NOTIFICATION_TARGET_KEY;
  });

  it("normalizes webhook: targetKey to group webhook channel", () => {
    expect(normalizeP0OwnerNotificationTarget("webhook:env:TEST")).toEqual({
      channel: "DINGTALK_GROUP_WEBHOOK",
      targetKey: "env:TEST",
    });
  });
});

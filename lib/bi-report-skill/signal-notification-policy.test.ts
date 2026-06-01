import { afterEach, describe, expect, it } from "vitest";

import { isBiReportSignalNotificationSendEnabled } from "./signal-notification-policy";

const legacyTenantEnv = ["GUANG", "PU_BI_SIGNAL_NOTIFICATION_SEND_ENABLED"].join("");

describe("bi report signal notification policy", () => {
  afterEach(() => {
    delete process.env.BI_REPORT_SIGNAL_NOTIFICATION_SEND_ENABLED;
    delete process.env[legacyTenantEnv];
  });

  it("uses the generic public-safe send flag", () => {
    process.env.BI_REPORT_SIGNAL_NOTIFICATION_SEND_ENABLED = "true";

    expect(isBiReportSignalNotificationSendEnabled()).toBe(true);
  });

  it("keeps the existing tenant-private send flag as a compatibility alias", () => {
    process.env[legacyTenantEnv] = "true";

    expect(isBiReportSignalNotificationSendEnabled()).toBe(true);
  });
});

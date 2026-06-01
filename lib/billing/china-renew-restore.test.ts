import { describe, expect, it } from "vitest";
import { AccessState } from "@prisma/client";
import {
  getChinaCheckoutActionLabel,
  getChinaDuplicateCheckoutMessage,
  getChinaRefreshMissingOrderMessage,
  getChinaRefreshResultMessage,
  getChinaRenewRestoreIntent,
  getChinaRenewRestoreSummary,
} from "@/lib/billing/china-renew-restore";
import { PAYMENT_PROVIDER } from "@/lib/billing/runtime-constants";

describe("china renew / restore ops helper", () => {
  it("maps lifecycle states into purchase / renew / restore / reactivate intents", () => {
    expect(getChinaRenewRestoreIntent(AccessState.TRIALING)).toBe("PURCHASE");
    expect(getChinaRenewRestoreIntent(AccessState.GRACE)).toBe("RENEW");
    expect(getChinaRenewRestoreIntent(AccessState.READ_ONLY)).toBe("RESTORE");
    expect(getChinaRenewRestoreIntent(AccessState.CANCELED)).toBe("REACTIVATE");
    expect(getChinaRenewRestoreIntent(AccessState.ACTIVE)).toBe("HOLD");
  });

  it("returns state-aware checkout labels for China rails", () => {
    expect(
      getChinaCheckoutActionLabel({
        accessState: AccessState.GRACE,
        provider: PAYMENT_PROVIDER.ALIPAY,
        english: false,
      }),
    ).toBe("用支付宝续费恢复");

    expect(
      getChinaCheckoutActionLabel({
        accessState: AccessState.READ_ONLY,
        provider: PAYMENT_PROVIDER.WECHAT_PAY,
        english: true,
      }),
    ).toBe("Restore access with WeChat Pay");
  });

  it("keeps active China organizations out of duplicate checkout language", () => {
    expect(getChinaDuplicateCheckoutMessage({ english: true })).toContain("avoids duplicate purchase");
    expect(getChinaRenewRestoreSummary({ accessState: AccessState.ACTIVE, english: false }).currentBoundary).toContain(
      "不应该为了确认状态而重复购买",
    );
  });

  it("explains refresh fallback for grace and read_only states", () => {
    expect(
      getChinaRefreshMissingOrderMessage({
        accessState: AccessState.GRACE,
        english: false,
      }),
    ).toContain("先发起续费");

    expect(
      getChinaRefreshMissingOrderMessage({
        accessState: AccessState.READ_ONLY,
        english: true,
      }),
    ).toContain("Start restore first");
  });

  it("returns success and pending refresh result messages without replacing lifecycle truth", () => {
    expect(
      getChinaRefreshResultMessage({
        accessState: AccessState.ACTIVE,
        provider: PAYMENT_PROVIDER.ALIPAY,
        providerStatus: "TRADE_SUCCESS",
        english: false,
      }),
    ).toContain("已刷新到可用状态");

    expect(
      getChinaRefreshResultMessage({
        accessState: AccessState.GRACE,
        provider: PAYMENT_PROVIDER.WECHAT_PAY,
        providerStatus: "USERPAYING",
        english: true,
      }),
    ).toContain("will stay grace");
  });
});

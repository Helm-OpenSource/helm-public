import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { verifyStripeWebhookSignature } from "@/lib/billing/stripe";

describe("stripe webhook verification", () => {
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;

  afterEach(() => {
    if (originalSecret) {
      process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
    } else {
      delete process.env.STRIPE_WEBHOOK_SECRET;
    }
  });

  it("accepts a valid v1 signature", () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
    const payload = JSON.stringify({ id: "evt_123", type: "checkout.session.completed" });
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;
    const signature = createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET)
      .update(signedPayload, "utf8")
      .digest("hex");

    expect(() =>
      verifyStripeWebhookSignature({
        payload,
        signatureHeader: `t=${timestamp},v1=${signature}`,
      }),
    ).not.toThrow();
  });

  it("rejects an invalid signature", () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";

    expect(() =>
      verifyStripeWebhookSignature({
        payload: "{}",
        signatureHeader: "t=1,v1=deadbeef",
        toleranceSeconds: Number.MAX_SAFE_INTEGER,
      }),
    ).toThrow();
  });
});

import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  readBoundedAgoraWebhookBody,
  verifyAgoraWebhookSignature,
} from "@/lib/integrations/agora-field-capture/agora-webhook";

describe("Agora webhook signature", () => {
  it("verifies HMAC SHA-256 against the unparsed request body", () => {
    const rawBody = Buffer.from(
      '{"eventType":10,"noticeId":"notice-1","payload":{"agentId":"agent-1"}}',
    );
    const secret = "webhook-secret";
    const signature = createHmac("sha256", secret).update(rawBody).digest("hex");

    expect(
      verifyAgoraWebhookSignature({ rawBody, secret, signatureV2: signature }),
    ).toBe(true);
    expect(
      verifyAgoraWebhookSignature({
        rawBody: Buffer.from(`${rawBody.toString("utf8")} `),
        secret,
        signatureV2: signature,
      }),
    ).toBe(false);
  });

  it("rejects missing and malformed signatures without throwing", () => {
    expect(
      verifyAgoraWebhookSignature({
        rawBody: Buffer.from("{}"),
        secret: "secret",
        signatureV2: null,
      }),
    ).toBe(false);
    expect(
      verifyAgoraWebhookSignature({
        rawBody: Buffer.from("{}"),
        secret: "secret",
        signatureV2: "not-hex",
      }),
    ).toBe(false);
  });

  it("reads webhook streams with a hard byte limit", async () => {
    const accepted = new Request("http://localhost/webhook", {
      method: "POST",
      body: Buffer.from('{"ok":true}'),
    });
    await expect(readBoundedAgoraWebhookBody(accepted, 64)).resolves.toEqual(
      Buffer.from('{"ok":true}'),
    );

    const rejected = new Request("http://localhost/webhook", {
      method: "POST",
      body: Buffer.alloc(65, 1),
    });
    await expect(readBoundedAgoraWebhookBody(rejected, 64)).rejects.toThrow(
      "exceeds 64 bytes",
    );
  });
});

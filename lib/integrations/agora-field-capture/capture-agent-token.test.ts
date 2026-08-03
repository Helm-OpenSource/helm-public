import { describe, expect, it } from "vitest";
import {
  hashCaptureAgentToken,
  issueCaptureAgentToken,
  parseCaptureAgentToken,
  verifyCaptureAgentToken,
} from "@/lib/integrations/agora-field-capture/capture-agent-token";

describe("capture agent token", () => {
  it("issues a lookup prefix plus a high-entropy secret and stores only a hash", () => {
    const bytes = Buffer.alloc(48, 7);
    const issued = issueCaptureAgentToken((size) => bytes.subarray(0, size));

    expect(issued.token).toMatch(/^helm_capture_[A-Za-z0-9_-]{16}_[A-Za-z0-9_-]{43}$/);
    expect(issued.tokenPrefix).toHaveLength(16);
    expect(issued.tokenHash).toBe(hashCaptureAgentToken(issued.token));
    expect(issued.tokenHash).not.toContain(issued.token);
    expect(parseCaptureAgentToken(issued.token)).toEqual({
      tokenPrefix: issued.tokenPrefix,
      token: issued.token,
    });
  });

  it("verifies the whole token and rejects malformed or modified values", () => {
    const issued = issueCaptureAgentToken();

    expect(verifyCaptureAgentToken(issued.token, issued.tokenHash)).toBe(true);
    expect(
      verifyCaptureAgentToken(`${issued.token.slice(0, -1)}x`, issued.tokenHash),
    ).toBe(false);
    expect(parseCaptureAgentToken("Bearer not-a-capture-token")).toBeNull();
    expect(parseCaptureAgentToken("helm_capture_short_secret")).toBeNull();
  });
});

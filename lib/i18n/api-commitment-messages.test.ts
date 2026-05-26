import { describe, expect, it } from "vitest";
import { resolveCommitmentApiMessage } from "@/lib/i18n/api-commitment-messages";

describe("commitment API messages", () => {
  it("resolves status fallback messages from workspace default locale", () => {
    expect(resolveCommitmentApiMessage("en-US", "missingRequiredFields")).toBe(
      "Missing required fields",
    );
    expect(resolveCommitmentApiMessage("zh-CN", "missingRequiredFields")).toBe("参数不完整");
    expect(resolveCommitmentApiMessage("en-us", "missingRequiredFields")).toBe("参数不完整");

    expect(resolveCommitmentApiMessage("en-US", "updateFailed")).toBe(
      "Failed to update commitment",
    );
    expect(resolveCommitmentApiMessage("zh-CN", "updateFailed")).toBe("更新承诺失败");
    expect(resolveCommitmentApiMessage(null, "updateFailed")).toBe("更新承诺失败");
  });
});

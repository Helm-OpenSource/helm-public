import { describe, expect, it } from "vitest";
import { resolveBlockerApiMessage } from "@/lib/i18n/api-blocker-messages";

describe("blocker API messages", () => {
  it("resolves create fallback messages from workspace default locale", () => {
    expect(resolveBlockerApiMessage("en-US", "missingRequiredFields")).toBe(
      "Missing required fields",
    );
    expect(resolveBlockerApiMessage("zh-CN", "missingRequiredFields")).toBe("参数不完整");
    expect(resolveBlockerApiMessage("en-us", "missingRequiredFields")).toBe("参数不完整");

    expect(resolveBlockerApiMessage("en-US", "createFailed")).toBe(
      "Failed to create blocker",
    );
    expect(resolveBlockerApiMessage("zh-CN", "createFailed")).toBe("创建阻塞失败");
    expect(resolveBlockerApiMessage(null, "createFailed")).toBe("创建阻塞失败");
  });
});

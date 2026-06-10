import { describe, expect, it } from "vitest";
import {
  getAliyunFounderDefaultCredentialsMissingMessage,
  getDingTalkAgentIdMissingMessage,
} from "@/features/connectors/action-copy";

describe("connector action copy", () => {
  it("localizes missing Aliyun founder default credentials for Chinese callers", () => {
    expect(getAliyunFounderDefaultCredentialsMissingMessage(false)).toBe(
      "ALIYUN_MAIL_FOUNDER_EMAIL / ALIYUN_MAIL_FOUNDER_PASSWORD 尚未配置。",
    );
  });

  it("preserves missing Aliyun founder default credentials English copy", () => {
    expect(getAliyunFounderDefaultCredentialsMissingMessage(true)).toBe(
      "ALIYUN_MAIL_FOUNDER_EMAIL / ALIYUN_MAIL_FOUNDER_PASSWORD is not configured.",
    );
  });

  it("localizes missing DingTalk app agent id for Chinese callers", () => {
    expect(getDingTalkAgentIdMissingMessage(false)).toBe(
      "DINGTALK_AGENT_ID 尚未配置",
    );
  });

  it("preserves missing DingTalk app agent id English copy", () => {
    expect(getDingTalkAgentIdMissingMessage(true)).toBe(
      "DINGTALK_AGENT_ID is not configured",
    );
  });
});
